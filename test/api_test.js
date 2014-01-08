process.env.NODE_ENV = 'testing';
var assert = require('assert');
var http = require('http');
var express = require('express');
var app = express();
var routes = require('../routes');
var test_data = require('./test_data');
var Expense = require('../expenses').Expense;
var ExpenseStatus = require('../expenses').ExpenseStatus;
var Session = require('../bookshelf_session').Session;
var BookshelfStore = require('../bookshelf_session').BookshelfStore;
var expense_states = require('../expenses').expense_states;
var User = require('../users').User;
var Q = require('q');

app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(
  express.session({
       secret: 'secrets',
       store: new BookshelfStore()
  })
);

var port = 12345;

function install_test_data() {
  var constructors = {
    'expenses': Expense,
    'expense_status': ExpenseStatus,
    'users': User,
    'sessions': Session
  };
  var table_promises = [];
  for (var table_name in test_data) {
    if (!test_data.hasOwnProperty(table_name)) {
      continue;
    }

    var table_data = test_data[table_name];
    var constructor = constructors[table_name];

    var create_promises = table_data.map(function(data) {
      return new constructor(data).save(
        null,
        {method: 'insert'}
      );
    });

    table_promises.push(Q.all(create_promises));
  }

  return Q.all(table_promises);
}

function make_request(method, path, data) {
  var length = data ? JSON.stringify(data).length : 0;
  var options = {
    port: port,
    method: method,
    path: path,
    headers: {
      'Cookie': 'connect.sid=abcde',
      'Content-Length': length,
      'Content-Type': 'application/json'
    }
  };
  var def = Q.defer();
  var client_request = http.request(options, function(response_stream) {
    response_stream.on('data', function(data) {
      if (response_stream.statusCode >= 400) {
        var message = 'HTTP ' + response_stream.statusCode + ': ' + data;
        def.reject(new Error(message));
      } else {
        var json_data = JSON.parse(data);
        def.resolve(json_data);
      }
    });
  });

  if(data) {
    client_request.write(JSON.stringify(data));
  }
  client_request.end();

  return def.promise;
}

describe('api', function() {

  before(function(done) {
    // Install test data, install routes, start server
    install_test_data().then(function() {
      routes.install_routes(app);
      app.listen(port);
    }).then(function() {
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
      make_request('POST', '/api/expense/1/pay/2').then(function(result) {
        assert.equal(result.status, 'ok');
        return make_request('GET', '/api/expense/1');
      }).then(function(expense) {
        assert.equal(expense.participants[0].status, 'Paid');
        done();
      }).catch(function(err) {
        done(err);
      });

      // Reset expense status
      after(function(done) {
        var status = new ExpenseStatus({ id: 1, status: 0});
        status.save().then(function() {
          done();
        }, function(err) {
          done(err);
        });
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



  it('should attach contacts correctly', function(done) {
    make_request('POST', '/api/add_contact', {email: 'user2@user2.com'})
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
