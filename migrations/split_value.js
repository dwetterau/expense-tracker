var db = require('../db');
var knex = db.bookshelf.knex;
var Q = require('q');
var expenses = require('../expenses');
var User = require('../users').User;
var ExpenseStatus = expenses.ExpenseStatus;

var ExpenseCollection = db.bookshelf.Collection.extend({
  model: expenses.Expense
});

var ExpenseStatusCollection = db.bookshelf.Collection.extend({
  model: expenses.ExpenseStatus
});


exports.forward = function() {
  // Yikes! At this point value does not exist.
  // Have to monkey patch to avoid trouble.
  function modified_participants() {
    return this.belongsToMany(User, 'expense_status')
      .through(ExpenseStatus);
  }

  expenses.Expense.prototype.participants = modified_participants;

  var all_expenses = new ExpenseCollection();
  var all_statuses = new ExpenseStatusCollection();
  all_expenses.fetch({withRelated: ['participants']}).then(function() {
    return all_statuses.fetch();
  }).then(function() {
    return knex.schema.table('expense_status', function(table) {
      table.integer('value');
    });
  }).then(function() {
    return all_statuses.mapThen(function(status) {
      var expense_id = status.get('expense_id');
      var expense = all_expenses.get(expense_id);
      var total_value = expense.get('value');
      var participants = expense.related('participants');
      var individual_value = Math.ceil(total_value / participants.length);
      status.set('value', individual_value);
      return status.save();
    });
  }).then(function() {
    return knex.schema.table('expenses', function(table) {
      table.dropColumn('value');
    });
  }).then(function() {
    return knex.raw('ALTER TABLE expense_status ' +
                    'ALTER COLUMN value SET NOT NULL');
  }).catch(function(error) {
    console.error('An error occured', error);
  });
};

exports.backward = function() {
  var all_expenses = new ExpenseCollection();
  all_expenses.fetch({withRelated: ['participants']}).then(function() {
   return knex.schema.table('expenses', function(table) {
     table.integer('value');
   });
  }).then(function() {
    return all_expenses.mapThen(function(expense) {
      var total_value = expense.related('participants').map(function(participant) {
        return participant.pivot.get('value');
      }).reduce(function(a, b) { return a + b; }, 0);
      expense.set('value', total_value);
      return expense.save();
    });
  }).then(function() {
    return knex.schema.table('expense_status', function(table) {
      table.dropColumn('value');
    });
  }).then(function() {
    return knex.raw('ALTER TABLE expenses '+
                    'ALTER COLUMN value SET NOT NULL');
  }).catch(function(error) {
    console.error('An error occurred', error);
  });
};
