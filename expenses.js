var execute_cql = require('./db').execute_cql;
var users = require('./users');
var Q = require('q');
var uuid = require('node-uuid');

function create_expense_tables() {
  return execute_cql('CREATE TABLE expenses (' +
                     'expense_id uuid PRIMARY KEY, ' +
                     'title text, ' +
                     'description text, ' +
                     'value int, ' +
                     'participants set<uuid>, ' +
                     'receipt_image uuid)');
}

function store_expense(expense) {
  var id = uuid.v4();
  console.log(expense.participants);
  return Q.all(
    // Convert emails to uuids
    expense.participants.map(function(email) {
      console.log(email);
      return users.get_by_email(email).then(function(result) {
        return result.id;
      });
    })
  ).then(function(user_ids) {
    // TODO: make a better way around this
    var user_id_cql = {value: user_ids, hint: 'set'};
    console.log(user_id_cql);
    console.log('executing');
    console.log('user_ids: ', user_id_cql);
    return execute_cql('INSERT INTO expenses ' +
                       '(expense_id, title, value, participants) ' +
                       'VALUES (?, ?, ?, ?)',
                       [id, expense.title, parseInt(expense.value, 10), user_id_cql]);
  }).then(function() {
    // TODO: abstract this out
    // this is messy
    if (expense.description) {
      return execute_cql('UPDATE expenses ' +
                         'SET description=? ' +
                         'WHERE expense_id=?',
                         [expense.description, id]
                        );
    }
  }).then(function() {
    return id;
  });
}

function get_expense(id) {
  return execute_cql('SELECT * ' +
                     'FROM expenses ' +
                     'WHERE expense_id=?', 
                     [id])
    .then(function(result) {
      var template_data = {};
      template_data.title = result.rows[0].get('title');
      template_data.description = result.rows[0].get('description');
      template_data.receipt_image = result.rows[0].get('receipt_image');
      template_data.participants = result.rows[0].get('participants');
      template_data.value = result.rows[0].get('value');
      return template_data;
    });
}

exports.create_expense_tables = create_expense_tables;
exports.store_expense = store_expense;
exports.get_expense = get_expense;
