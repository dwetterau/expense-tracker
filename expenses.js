var db = require('./db')();
var Q = require('q');
var users = require('./users');
var uuid = require('node-uuid');
var dbobj = require('./dbobj');

// constants for expense state
var expense_states = {
  WAITING: 0,
  PAID: 1,
  OWNED: 2
};

var expenses = new dbobj.db_type();
expenses.columnfamily_name = 'expenses';
expenses.primary_key_name = 'expense_id';

// For some reason, map insertions don't work with the create check.
// Since we don't really need a create check, I'm going to skip it.
expenses.create_check = false;

expenses.user_to_db = function(user_data) {
  var participants = {};
  participants[user_data.owner.user_id] = expense_states.OWNED;
  user_data.paid.forEach(function(user_info) {
    participants[user_info.user_id] = expense_states.PAID;
  });

  user_data.waiting.forEach(function(user_info) {
    participants[user_info.user_id] = expense_states.WAITING;
  });

  var cql_particpants = {hint: 'map',
                         value: participants};
  // TODO: Abstract this sorta crap out with a library
  var db_data = {
    expense_id: user_data.expense_id,
    description: user_data.description,
    owner: user_data.owner.user_id,
    title: user_data.title,
    value: user_data.value,
    participants: cql_particpants
  };

  return Q(db_data);
};

expenses.db_to_user = function(db_data) {
  var row = db_data.rows[0];
  var user_data = {
    expense_id: row.expense_id,
    receipt_image: row.receipt_image,
    description: row.description,
    title: row.title,
    value: row.value,
    waiting: [],
    paid: [],
    participants: []
  };
  var user_get_promises = [];
  for (var user_id in row.participants) {
    user_get_promises.push(users.users.get({user_id: user_id}));
  }
  return Q.all(user_get_promises).then(function(users_data) {
    users_data.forEach(function(user_info) {
      user_data.participants.push(user_info);
      var status = row.participants[user_info.user_id];
      switch (status) {
      case expense_states.WAITING:
        user_data.waiting.push(user_info);
        break;
      case expense_states.PAID:
        user_data.paid.push(user_info);
        break;
      case expense_states.OWNED:
        user_data.owner = user_info;
        break;
      }
    });
    return user_data;
  });
};

expenses.modify = function(data, not_exists) {
  // Need to update statuses when things are modified as well.
  var condition = not_exists ? 'IF NOT EXISTS' : undefined;
  var statuses = [];
  data.waiting.forEach(function(user_info) {
    statuses.push({user_id: user_info.user_id,
                   expense_id: data.expense_id,
                   status: expense_states.WAITING
                  });
  });
  data.paid.forEach(function(user_info) {
    statuses.push({user_id: user_info.user_id,
                   expense_id: data.expense_id,
                   status: expense_states.PAID
                  });
  });
  statuses.push({user_id: data.owner.user_id,
                 expense_id: data.expense_id,
                 status: expense_states.OWNED
                });
  // Need to do a normal modify, then create all of the statuses
  return Object.getPrototypeOf(this).modify.call(this, data, not_exists)
    .then(function() {
      status_promises = statuses.map(function(status) {
        return db.insert('expense_status', status, condition);
      });
      return Q.all(status_promises);
    });
};

dbobj.deletable(expenses);

// Override the default delete to also delete linked statuses
var original_delete = expenses.delete;
expenses.delete = function(key_or_index) {
  // Need to delete the linked statuses, then delete the data
  return this.get(key_or_index).then(function(expense) {
    var status_update_data = expense.participants.map(function(participant) {
      return {user_id: participant.user_id,
              expense_id: expense.expense_id,
              deleted: 1
             };
    });
    var update_promises = status_update_data.map(function(update_data) {
      db.insert('expense_status', update_data);
    });
    return Q.all(update_promises);
  })
  .then(function() {
    // Delete the original expense
    return original_delete.call(this, key_or_index);
  });
};

function update_status(expense_id, user_id, status) {
  var status_update = db.execute_cql('UPDATE expense_status ' +
                                     'SET status=? ' +
                                     'WHERE expense_id=? and user_id=?',
                                     [status, expense_id, user_id ]);
  var expense_update = db.execute_cql('UPDATE expenses ' +
                                      ' SET participants[?] = ?' +
                                      'WHERE expense_id=?',
                                      [user_id, status, expense_id]);
  return Q.all([status_update, expense_update]);
}

function mark_paid(expense_id, owner_id, user_id) {
  return db.execute_cql('SELECT owner FROM expenses WHERE expense_id=?',
                        [expense_id])
    .then(function(result) {
      if (result.rows[0].get('owner') != owner_id) {
        throw Error("User: " + user_id + " not owner of expense.");
      }
      return update_status(expense_id, user_id, expense_states.PAID);
    });
}

function store_expense(expense) {
  var id = uuid.v1();
  var user_ids = [];
  return Q.all(
    // Convert emails to uuids
    expense.participants.map(function(email) {
      return users.users.get(email).then(function(result) {
        if (!result) {
          throw Error("User: " + email + " does not exist.");
        }
        return result.user_id;
      });
    })
  ).then(function(retrieved_ids) {
    user_ids = retrieved_ids;
  }).then(function() {
    var users_status = {};
    user_ids.forEach(function(user_id) {
      if (user_id == expense.owner) {
        users_status[user_id] = expense_states.OWNED;
      } else {
        users_status[user_id] = expense_states.WAITING;
      }
    });
    // Store user_status as a map
    var cql_users_status = {value: users_status,
                            hint: 'map'};
    var cql_expense_data = {
      expense_id: id,
      title: expense.title,
      value: parseInt(expense.value, 10),
      participants: cql_users_status,
      owner: expense.owner
    };
    if (expense.description) {
      cql_expense_data.description = expense.description;
    }
    if (expense.receipt_image) {
      cql_expense_data.receipt_image = expense.receipt_image;
    }
    return db.insert('expenses', cql_expense_data);
  }).then(function() {
    return Q.all(user_ids.map(function(user_id) {
      if (user_id == expense.owner) {
        return update_status(id, user_id, expense_states.OWNED);
      } else {
        return update_status(id, user_id, expense_states.WAITING);
      }
    }));
  }).then(function() {
    return id;
  });
}

function get_expense(id, user_id) {
  return db.execute_cql('SELECT * ' +
                        'FROM expenses ' +
                        'WHERE expense_id=?',
                        [id])
    .then(function(result) {
      if (!result.rows[0]) {
        // Didn't find the expense, return nothing
        return;
      }
      var row = result.rows[0];
      var participants_status = row.get('participants');
      if (!participants_status.hasOwnProperty(user_id)) {
        // User is not part of this expense, don't return it.
        return;
      }
      var owned = participants_status[user_id] === expense_states.OWNED;
      var template_data = {
        expense_id: row.get('expense_id'),
        title: row.get('title'),
        description: row.get('description'),
        receipt_image: row.get('receipt_image'),
        value: row.get('value')
      };
      var participant_uuids = [];
      for (var uuid in participants_status) {
        participant_uuids.push(uuid);
      }
      return Q.all(
        participant_uuids.map(
          function(uuid) {
            return users.users.get({user_id: uuid}).then(function(user) {
              var user_object = user;
              if (uuid == row.get('owner')) {
                template_data.owner = user_object;
                user_object.owner = true;
              } else {
                user_object.owner = false;
              }
              user_object.status = participants_status[uuid];
              user_object.paid = user_object.status != expense_states.WAITING;
              if (owned) {
                user_object.pay_link = "/expense/" + id + "/pay/" + uuid;
              }
              return user_object;
            });
          }
        )
      ).then(function(email_status) {
        template_data.participants_status = email_status;
        return template_data;
      });
    });
}

function get_user_expenses(user_id) {
  return db.execute_cql('SELECT expense_id ' +
                        'FROM expense_status ' +
                        'WHERE user_id=?',
                        [user_id])
    .then(function(result) {
      var expense_requests = result.rows.map(function(row) {
        return get_expense(row.get('expense_id'), user_id);
      });
      return Q.all(expense_requests).then(function(expense_templates) {
        //divide the expenses into three categories
        // 1: owned unfinished expenses: status = Owned
        // 2: waiting expenses
        // 3: finished expenses
        var owned_unfinished = [];
        var unfinished = [];
        var other = [];
        expense_templates.forEach(function(expense) {
          var done = true;
          var my_status;
          expense.participants_status.forEach(function(status) {
            done = done && status.status != expense_states.WAITING;
            if (status.user_id == user_id) {
              my_status = status.status;
            }
          });
          if (done) {
            //TODO split up finished expenses you owned and ones you didn't
            other.push(expense);
          } else {
            if (my_status == expense_states.OWNED) {
              // Owner and waiting on someone still
              owned_unfinished.push(expense);
            } else if (my_status == expense_states.WAITING) {
              // You still need to pay
              unfinished.push(expense);
            } else if (my_status == expense_states.PAID) {
              // You're done but it's still not over, put it in other
              other.push(expense);
            }
          }
        });
        return {
          owned_unfinished: owned_unfinished,
          unfinished: unfinished,
          other: other
        };
      });
    });
}

exports.store_expense = store_expense;
exports.get_expense = get_expense;
exports.get_user_expenses = get_user_expenses;
exports.update_status = update_status;
exports.states = expense_states;
exports.mark_paid = mark_paid;
exports.expenses = expenses;

// export for testing
exports.db = db;
