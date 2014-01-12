process.env.NODE_ENV = 'testing';
var assert = require('assert');

var db = require('../db');
var load_test_data = require('./load_test_data');
var test_server = require('./test_server');
var routes = require('../routes');
var test_data = require('./test_data');
var ExpenseStatus = require('../expenses').ExpenseStatus;

describe('api', function() {

  var appses = test_server.start_server();
  var app = appses[0];
  var server = appses[1];
  var make_request = test_server.make_request;

  before(function(done) {
    // Install test data, install routes, start server
    load_test_data.install_test_data().then(function() {
      routes.install_routes(app);
    }).then(function() {
      done();
    }).catch(function(err) {
      done(err);
    });
  });

  after(function(done) {
    server.close();
    load_test_data.reset().then(function() {
      done();
    }).catch(function(err) {
      done(err);
    });
  });

  describe('expenses', function() {

    it('should return an expense on /api/expense/1', function(done) {
      make_request('GET', '/api/expense/1').then(function(result) {
        assert(result);
        assert.equal(result.id, 1);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should create an expense on /api/create_expense', function(done) {
      make_request('POST', '/api/create_expense', {
        title: 'New Expense Title',
        value: 12,
        description: 'Arst',
        owner_id: 1,
        participants: []
      }).then(function(result) {
        assert(result);
        assert(result.id !== undefined);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should get all expenses on /api/expenses', function(done) {
      make_request('GET', '/api/expenses').then(function(result) {
        // test_data.json defines two expenses that user 1 is the owner of
        assert(result.owned_expenses.length >= 2);
        var expenses = {};
        result.owned_expenses.forEach(function(expense) {
          expenses[expense.id] = expense;
          assert.equal(expense.owner_id, 1);
        });

        assert(expenses[1]);
        assert.equal(expenses[1].description, 'test description1');
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should mark an appropriately owned expense as paid', function(done) {
      make_request('POST', '/api/expense/1/pay', {user_id: 2}).then(function(result) {
        assert.equal(result.status, 'ok');
        return make_request('GET', '/api/expense/1');
      }).then(function(expense) {
        assert.equal(expense.participants[0].status, 'Paid');
        // Clean up for future tests
        var status = new ExpenseStatus({ id: 1, status: 0});
        return status.save();
      }).then(function() {
        done();
      }, function(err) {
        done(err);
      });

    });

    it('should not mark an inappropriately owned expense as paid', function(done) {
      make_request('POST', '/api/expense/2/pay/1').then(function(result) {
        done(new Error('Request did not fail: ' + result));
      }, function(err) {
        done();
      });
    });
  });

  it('should retreive contacts correctly', function(done) {
    make_request('GET', '/api/contacts')
      .then(function(result) {
        assert.equal(result.length, 1);
        assert.equal(result[0].name, 'testMan2');
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should attach contacts correctly', function(done) {
    make_request('POST', '/api/add_contact', {email: 'user3@user3.com'})
      .then(function(result) {
        assert.equal(result.status, 'ok');
        return make_request('GET', '/api/contacts');
      }).then(function(contacts) {
        assert(contacts.length >= 1);
        var by_id = {};
        contacts.forEach(function(contact) {
          by_id[contact.id] = contact;
        });

        assert(by_id[2] !== undefined);
        assert.equal(by_id[2].email, 'user2@user2.com');
        done();
      }).catch(function(err) {
        done(err);
      });
  });

  it('should not attach non-existant contacts', function(done) {
    make_request('POST', '/api/add_contact', {email: 'arstarst'})
      .then(function(result) {
        done(new Error('request completed successfully: ' + JSON.stringify(result)));
      }, function(err) {
        done();
      });
  });

});
