var execute_cql = require('./db').execute_cql;
var users = require('./users');
var Q = require('q');
var uuid = require('node-uuid');

function create_expense_tables() {
  return execute_cql('CREATE TABLE expenses ( expense_id uuid PRIMARY KEY, ' +
                     'value int, ' +
                     'participants set<uuid>)');
}


function store_expense(expense) {
  var id = uuid.v4();
  return Q.all(
    // Convert emails to uuids
    expense.participants.map(function(email) {
      return users.get_by_email(email).then(function(result) {
        return result.id;
      });
    })
  ).then(function(user_ids) {
    // TODO: make a better way around this
    var user_id_cql = '{' + user_ids.join(',') + '}';
    console.log('user_ids: ', user_id_cql);
    return execute_cql('INSERT INTO expenses ' +
                       '(expense_id, value, participants) ' +
                       'VALUES (?, ?, ?)',
                       [id, parseInt(expense.value), user_id_cql]);
  }).then(function() {
    return id;
  });
}

function get_expense(id) {
  return execute_cql('SELECT expense_id, value, participants ' +
                     'FROM expenses ' +
                     'WHERE expense_id=?', 
                     [id])
    .then(function(result) {
      var participants = result.rows[0].get('participants');
      var value = result.rows[0].get('value');
      return { participants: participants,
               value: value };
    });
}

exports.create_expense_tables = create_expense_tables;
exports.store_expense = store_expense;
exports.get_expense = get_expense;
