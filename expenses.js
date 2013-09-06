var db = require('./db');
var Q = require('q');
var users = require('./users');
var uuid = require('node-uuid');

// constants for expense state
var expense_states = {
  WAITING: 0,
  PAID: 1
};

function create_expense_tables() {
  var create_expenses = db.execute_cql(
    'CREATE TABLE expenses (' +
      'expense_id uuid PRIMARY KEY, ' +
      'title text, ' +
      'description text, ' +
      'value int, ' +
      'participants map<uuid, int>, ' +
      'receipt_image uuid)'
  );
  var create_status = db.execute_cql(
    'CREATE TABLE expense_status (' +
      'user_id uuid, ' +
      'expense_id uuid, ' +
      'status int, ' +
      'PRIMARY KEY (user_id, expense_id))'
  );
  return Q.all([create_expenses, create_status]);
}

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
      users_status[user_id] = expense_states.WAITING;
    });
    // Store user_status as a map
    var cql_users_status = {value: users_status,
                            hint: 'map'};
    return db.execute_cql('INSERT INTO expenses ' +
                          '(expense_id, title, value, participants) ' +
                          'VALUES (?, ?, ?, ?)',
                          [id, expense.title, parseInt(expense.value), cql_users_status]);
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
      return update_status(id, user_id, 0);
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
      var template_data = {};
      template_data.expense_id = result.rows[0].get('expense_id');
      template_data.title = result.rows[0].get('title');
      template_data.description = result.rows[0].get('description');
      template_data.receipt_image = result.rows[0].get('receipt_image');
      var participants_status = result.rows[0].get('participants');
      if (!participants_status.hasOwnProperty(user_id)) {
        // User is not part of this expense, don't return it.
        return;
      }
      var participant_uuids = [];
      for (var uuid in participants_status) {
        participant_uuids.push(uuid);
      }
      template_data.value = result.rows[0].get('value');
      return Q.all(
        participant_uuids.map(
          function(uuid) {
            return users.get_user(uuid).then(function(user) {
              return {email: user.get('email'), status: participants_status[uuid]};
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

exports.create_expense_tables = create_expense_tables;
exports.store_expense = store_expense;
exports.get_expense = get_expense;
exports.get_user_expenses = get_user_expenses;
exports.update_status = update_status;
exports.states = expense_states;

// export for testing
exports.db = db;
