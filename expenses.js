var db = require('./db');
var Q = require('q');
var users = require('./users');
var uuid = require('node-uuid');

// constants for expense state
var expense_states = {
  WAITING: 0,
  PAID: 1,
  OWNED: 2
};

function update_status(expense_id, user_id, status) {
  return db.execute_cql('UPDATE expense_status ' +
                     'SET status=? ' +
                     'WHERE expense_id=? and user_id=?',
                     [status, expense_id, user_id ]);
}

function store_expense(expense) {
  var id = uuid.v1();
  var user_ids = [];
  return Q.all(
    // Convert emails to uuids
    expense.participants.map(function(email) {
      return users.get_by_email(email).then(function(result) {
        if (!result) {
          throw Error("User: " + email + " does not exist.");
        }
        return result.get('user_id');
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
    return db.execute_cql('INSERT INTO expenses ' +
                          '(expense_id, title, value, participants, owner) ' +
                          'VALUES (?, ?, ?, ?, ?)',
                          [id,
                           expense.title,
                           parseInt(expense.value, 10),
                           cql_users_status,
                           expense.owner]);
  }).then(function() {
    // TODO: abstract this out
    // this is messy
    if (expense.description) {
      return db.execute_cql('UPDATE expenses ' +
                            'SET description=? ' +
                            'WHERE expense_id=?',
                            [expense.description, id]
                           );
    }
  }).then(function() {
    if (expense.receipt_image) {
      return db.execute_cql('UPDATE expenses ' +
                            'SET receipt_image=? ' +
                            'WHERE expense_id=?',
                            [expense.receipt_image, id]
                           );
    }
  }).then(function() {
    return user_ids.map(function(user_id) {
      if (user_id == expense.owner) {
        return update_status(id, user_id, expense_states.OWNED);
      } else {
        return update_status(id, user_id, expense_states.PAID);
      }
    });
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
            return users.get_user(uuid).then(function(user) {
              var user_object = users.user_object(user);
              if (uuid == row.get('owner')) {
                template_data.owner = user_object;
                user_object.owner = true;
              } else {
                user_object.owner = false;
              }
              user_object.status = participants_status[uuid];
              user_object.paid = user_object.status != expense_states.WAITING;
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
      return Q.all(expense_requests);
    });
}

exports.store_expense = store_expense;
exports.get_expense = get_expense;
exports.get_user_expenses = get_user_expenses;
exports.update_status = update_status;
exports.states = expense_states;

// export for testing
exports.db = db;
