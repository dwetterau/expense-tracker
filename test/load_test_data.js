var Q = require('q');

var db = require('../db');
var test_data = require('./test_data');

var models = [
  require('../expenses').Expense,
  require('../expenses').ExpenseStatus,
  require('../bookshelf_session').Session,
  require('../users').User,
  db.bookshelf.Model.extend({
    tableName: 'contacts'
  })
];

var table_names = models.map(function(model) {
  var instance = new model();
  return instance.tableName;
});

var constructors = {};
models.forEach(function(model) {
  var instance = new model();
  constructors[instance.tableName] = model;
});

exports.reset = function() {
  var promises = table_names.map(function(table_name) {
    return db.bookshelf.knex(table_name).del();
  });

  return Q.all(promises);
};

exports.install_test_data = function() {
  var table_promises = table_names.map(function(table_name) {
    var table_data = test_data[table_name];
    var constructor = constructors[table_name];

    var create_promises = table_data.map(function(table_datum) {
      return new constructor(table_datum).save(
        null,
        {method: 'insert'}
      );
    });

    return Q.all(create_promises);
  });

  return Q.all(table_promises);
};
