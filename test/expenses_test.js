var assert = require('assert');
var db = require('../db');
var expenses = require('../expenses');
var uuid = require('node-uuid');
var Q = require('q');

describe('expenses', function() {
  before(function(done) {
    db.set_client_testing();
    expenses.db.set_client_testing();
    db.setup().then(function() {
      expenses.create_expense_tables().then(function() {
        // Table set up successfully
        done();
      }, function(err) {
        if (err.message.indexOf('Cannot add already existing column family') != -1) {
          console.warn("previous user table existed...");
          done();
        } else {
          done(err);
        }
      });
    }, function(err) {
      done(err);
    });
  });
  after(function(done) {
    var drop_expenses = db.execute_cql("DROP COLUMNFAMILY expenses");
    var drop_statuses = db.execute_cql("DROP COLUMNFAMILY expense_status");
    Q.all([drop_expenses, drop_statuses]).then(function() {
      done();
    }, function(err) {
      done(err);
    })
  });
});
