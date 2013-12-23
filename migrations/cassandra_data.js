var Client = require('node-cassandra-cql').Client;
var cql_client = new Client({
  hosts: ['localhost:9042'],
  keyspace: 'expense_tracker',
  version: '3.0.0',
  getAConnectionTimeout: 1000
});
var Q = require('q');
var execute_cql = Q.nbind(cql_client.execute, cql_client);

var expenses = require('../expenses');
var Expense = expenses.Expense;
var users = require('../users');
var User = users.User;
var ExpenseStatus = expenses.ExpenseStatus;


// Users
var uuid_to_user = {};
var users_done = execute_cql('SELECT * FROM users').then(function(result) {
  console.log('Saving users', result);
  users_saved = result.rows.map(function(row) {
    var u = new User({name: row.get('name'),
                      email: row.get('email'),
                      password: row.get('password'),
                      salt: row.get('salt')
                     });
    uuid_to_user[row.get('user_id')] = u;
    return u.save();
  });

  return Q.all(users_saved);
});



// Expenses
var uuid_to_expense = {};

var expenses_done = users_done.then(function() {
  return execute_cql('SELECT * FROM expenses').then(function(result) {
    console.log('Saving expenses', result);
    var rows_done = result.rows.map(function(row) {
      var owner = uuid_to_user[row.get('owner')];
      var e = new Expense({ title: row.get('title'),
                            value: row.get('value'),
                            description: row.get('description'),
                            owner_id: owner.id,
                          });
      uuid_to_expense[row.get('expense_id')] = e;
      return e.save();
    });
    return Q.all(rows_done);
  });
});


// ExpenseStatuses

var statuses_done = expenses_done.then(function() {
  return execute_cql('SELECT * FROM expense_status');
}).then(function(statuses) {
    console.log('Saving statuses', statuses);
  var rows_done = statuses.rows.map(function(row) {
    var user = uuid_to_user[row.get('user_id')];
    var expense = uuid_to_expense[row.get('expense_id')];
    if (user && expense) {
      var es = new ExpenseStatus({ user_id: user.id,
                                   expense_id: expense.id,
                                   status: row.get('status')
                                 });
      return es.save();
    } else {
      return Q();
    }
  });
  return Q.all(rows_done);
});

statuses_done.then(function() {
  console.log('Complete');
}).catch(function(err) {
  console.error('There was an error', err);
});
