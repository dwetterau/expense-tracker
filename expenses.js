var db = require('./db');
var User = require('./users').User;

// constants for expense state
var expense_states = {
  WAITING: 0,
  PAID: 1,
  OWNED: 2
};

var ExpenseStatus = db.bookshelf.Model.extend({
  tableName: 'expense_status',

  user: function() {
    return this.belongsTo(User);
  },

  expense: function() {
    return this.belongsTo(Expense);
  }
});

var Expense = db.bookshelf.Model.extend({
  tableName: 'expenses',

  hasTimestamps: ['created_at', 'updated_at'],

  owner: function() {
    return this.belongsTo(User, 'owner_id');
  },

  participants: function() {
    return this.belongsToMany(User, 'expense_status')
      .through(ExpenseStatus)
      .withPivot('status');
  },

  getWithAllParticipants: function() {
    return this.fetch({withRelated: ['owner', 'participants']});
  }

}, {
  getWithPermissionCheck: function(expense_id, user_id) {
    var e = new Expense({id: expense_id});
    return e.getWithAllParticipants().then(function() {
      if (user_id == e.related('owner').get('id')) {
        return e;
      } else if (e.related('participants').get(user_id)) {
        return e;
      } else {
        throw new Error('Insufficient permissions');
      }
    });
  }
}
);

exports.Expense = Expense;
exports.ExpenseStatus = ExpenseStatus;
exports.expense_states = expense_states;

function filter_participants(participants, status) {
  return participants.filter(function(participant) {
    return participant.pivot.get('status') == status;
  }).map(function(participant) {
    return participant.toJSON();
  });
}

exports.templateify = function(expense, user_id) {
  var data = expense.toJSON();
  data.waiting = filter_participants(expense.related('participants'),
                                     expense_states.WAITING);
  data.paid = filter_participants(expense.related('participants'),
                                  expense_states.PAID);

  data.owner = expense.related('owner').toJSON();

  data.is_owner = user_id == data.owner.id;

  return data;

};



/*var db = require('./db')();
var Q = require('q');
var users = require('./users');
var uuid = require('node-uuid');
var dbobj = require('./dbobj');


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
    owner: user_data.owner.user_id,
    title: user_data.title,
    value: user_data.value,
    participants: cql_particpants
  };

  if (user_data.receipt_image) {
    db_data.receipt_image = user_data.receipt_image;
  }

  if (user_data.description) {
    db_data.description = user_data.description;
  }

  return Q(db_data);
};

expenses.db_to_user = function(db_data) {
  var row = db_data.rows[0];
  var user_data = {
    expense_id: row.get('expense_id'),
    receipt_image: row.get('receipt_image'),
    description: row.get('description'),
    title: row.get('title'),
    value: row.get('value'),
    waiting: [],
    paid: [],
    participants: []
  };
  var user_get_promises = [];
  var participants = row.get('participants');
  for (var user_id in participants) {
    user_get_promises.push(users.users.get({user_id: user_id}));
  }
  return Q.all(user_get_promises).then(function(users_data) {
    users_data.forEach(function(user_info) {
      user_data.participants.push(user_info);
      var status = participants[user_info.user_id];
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

expenses.status_update_queries = function(data) {
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
  return statuses;
};


expenses.create = function(data, not_exists) {
  // Need to update statuses when things are modified as well.
  var condition = not_exists ? 'IF NOT EXISTS' : undefined;
  var statuses = this.status_update_queries(data);
  // Need to do a normal modify, then wait on all the statuses
  return Object.getPrototypeOf(this).modify.call(this, data, not_exists)
    .then(function() {
      var status_promises = statuses.map(function(status) {
        return db.insert('expense_status', status, condition);
      });
      return Q.all(status_promises);
    });
};

expenses.update = function(data) {
  var statuses = this.status_update_queries(data);
  return this.user_to_db(data).then(function(db_data) {
    return db.update(this.columnfamily_name, db_data, [this.primary_key_name]);
  }.bind(this)).then(function() {
    var status_promises = statuses.map(function(status) {
      return db.update('expense_status', status, ['user_id', 'expense_id']);
    });
    return Q.all(status_promises);
  });
};

dbobj.deletable(expenses);

// Override the default delete to also delete linked statuses
expenses.delete = function(key_or_index) {
  // Need to delete the linked statuses, then delete the data
  var expense_id;
  return this.get(key_or_index).then(function(expense) {
    expense_id = expense.expense_id;
    var update_promises = expense.participants.map(function(participant) {
      var update_data = {user_id: participant.user_id,
                         expense_id: expense.expense_id,
                         deleted: 1
                        };
      return db.insert('expense_status', update_data);
    });
    return Q.all(update_promises);
  })
  .then(function() {
    // Delete the original expense
    var update_obj = {
      deleted: 1,
      expense_id: expense_id
    };
    return db.update(expenses.columnfamily_name, update_obj, ['expense_id']);
  });
};

function mark_paid(expense_id, owner_id, user_id) {
  return expenses.get(expense_id)
    .then(function(expense) {
      if (expense.owner.user_id != owner_id) {
        throw Error("User: " + user_id + " not owner of expense.");
      }
      var waiting_index = expense.waiting.map(function(user) {
          return user.user_id;
      }).indexOf(user_id);

      if (waiting_index == -1) {
        throw Error("User: " + user_id + " not a participant of expense.");
      }

      var paid_user = expense.waiting[waiting_index];
      // Remove user from waiting
      expense.waiting[waiting_index] = expense.waiting[expense.waiting.length - 1];
      expense.waiting.length--;
      // Add user to paid
      expense.paid.push(paid_user);

      return expenses.update(expense);
    });
}

function get_expense(id, user_id) {
  return expenses.get(id).then(function(expense) {
    if (!expense) {
      // expense was deleted
      return expense;
    }
    var participant_ids = expense.participants.map(function(p) {
      return p.user_id;
    });
    if (participant_ids.indexOf(user_id) == -1) {
      return undefined;
    } else {
      if (expense.owner.user_id == user_id) {
        //TODO: Find a better home for this
        expense.is_owner = true;
      }
      return expense;
    }
  });
}

function lazy_delete_expense(id, user_id) {
  return expenses.get(id).then(function(expense) {
    if (expense.owner.user_id != user_id) {
      throw Error("User: " + user_id + " not owner of expense.");
    }
    return expenses.delete(id);
  })
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
      return Q.all(expense_requests).then(function(expenses) {
        //divide the expenses into three categories
        // 1: owned unfinished expenses: status = Owned
        // 2: waiting expenses
        // 3: finished expenses
        var owned_unfinished = [];
        var unfinished = [];
        var other = [];
        expenses.forEach(function(expense) {
          if (!expense) {
            // deleted expense...
            return;
          }
          if (expense.waiting.length === 0) {
            // If it's done, continue
            other.push(expense);
            return;
          }
          var waiting_ids = expense.waiting.map(function(user) {
            return user.user_id;
          });
          var paid_ids = expense.paid.map(function(user) {
            return user.user_id;
          });
          if (waiting_ids.indexOf(user_id) != -1) {
            unfinished.push(expense);
          } else if (paid_ids.indexOf(user_id) != -1) {
            other.push(expense);
          } else {
            owned_unfinished.push(expense);
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

exports.get_expense = get_expense;
exports.get_user_expenses = get_user_expenses;
exports.states = expense_states;
exports.mark_paid = mark_paid;
exports.lazy_delete_expense = lazy_delete_expense;
exports.expenses = expenses;

// export for testing
exports.db = db;
*/
