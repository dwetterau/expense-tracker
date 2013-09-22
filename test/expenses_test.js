var assert = require('assert');
var db = require('../db');
var expenses = require('../expenses');
var schema = require('../schema');
var users = require('../users');
var uuid = require('node-uuid');
var Q = require('q');
// TODO: This should be enabled for all tests
Q.longStackSupport = true;

describe('expenses', function() {
  before(function(done) {
    this.timeout(30000);
    db.set_client_testing();
    expenses.db.set_client_testing();
    users.db.set_client_testing();
    db.setup().then(function() {
      return schema.create_new_table(schema.schemas.users);
    }).then(function() {
      return schema.create_new_table(schema.schemas.expenses);
    }).then(function() {
      return schema.create_new_table(schema.schemas.expense_status);
    }).then(function() {
        // Table set up successfully
        done();
    }, function(err) {
      if (err.message.indexOf('Cannot add already existing column family') != -1) {
        console.warn("previous user or expense table existed...", err);
        done();
      } else {
        done(err);
      }
    });
  });
  // TODO: VOMIT! All of the data stuff that tests depend on should happen
  // in before, or otherwise somewhere else. Right now, these tests
  // must be run in a specific order in order to pass.

  // This gives a whole new meaning to the phrase "spaghetti code"
  var test_value = 1;
  var test_title = 'Test title';
  var test_description = 'test description';
  var test_email = 'a@a.com';
  var participant_email = 'b@b.com';
  var test_password = 'asdf';
  var test_expense = {
    value: test_value,
    participants: [test_email],
    title: test_title,
    description: test_description,
    receipt_image: undefined // no image
  };
  var participant_expense = {
    value: test_value,
    participants: [test_email, participant_email],
    title: test_title,
    description: test_description,
    receipt_image: undefined, // no image
    owner: test_user_id
  };
  var test_user_id;
  var test_participant_id;
  var test_expense_id;
  var test_participant_expense_id;
  describe('store_expense', function() {
    it('won\'t store the expense because the user can\'t be found', function(done) {
      expenses.store_expense(test_expense).then(function() {
        done(new Error('Should not have allowed expense to be created'));
      }, function(err) {
        assert.equal(err.message, "User: " + test_email + " does not exist.");
        done();
      });
    });
    it('should be stored correctly', function(done) {
      users.create_user({email: test_email, password: test_password, name:'testMan'})
        .then(function(user_id) {
          test_user_id = user_id;
          // TODO: VOMIT - see above
          test_expense.owner = user_id;
          participant_expense.owner = user_id;
          return expenses.store_expense(test_expense);
        })
        .then(function(expense_id) {
          assert.equal(expense_id.length, 36); // Make sure it's a uuid
          test_expense_id = expense_id;
          done();
        }, function(err) {
          done(err);
        });
    });
  });
  describe('get_expense', function() {
    it('will return undefined if no expense is found', function(done) {
      expenses.get_expense(uuid.v4(), test_user_id).then(function(template_data) {
        assert(!template_data);
        done();
      }, function(err) {
        done(err);
      });
    });
    it('will return undefined if user not in participants', function(done) {
      expenses.get_expense(test_expense_id, uuid.v4()).then(function(template_data) {
        assert(!template_data);
        done();
      }, function(err) {
        done(err);
      });
    });
    it('will retrieve the expense successfully', function(done) {
      expenses.get_expense(test_expense_id, test_user_id).then(function(template_data) {
        assert.equal(template_data.expense_id, test_expense_id);
        assert.equal(template_data.title, test_title);
        assert.equal(template_data.description, test_description);
        assert.equal(template_data.value, test_value);
        assert(!template_data.receipt_image);
        assert.equal(template_data.participants_status[0].email, test_email);
        assert.equal(template_data.participants_status[0].status, expenses.states.OWNED);
        done();
      }).fail(function(err) {
        done(err);
      });
    });
  });
  describe('pay expense', function() {
    it('will pay the expense if the user is the owner', function(done) {
      users.create_user({email: participant_email, password: test_password, name:'participantMan'})
        .then(function(participant_id) {
          test_participant_id = participant_id;
          return expenses.store_expense(participant_expense);
        })
        .then(function(expense_id) {
          test_participant_expense_id = expense_id;
          return expenses.mark_paid(expense_id, test_user_id, test_participant_id);
        })
      .then(function() {
        done();
      }, function(err) {
        done(err);
      });
    });
    it('will not pay the expense if the user is not the owner', function(done) {
      expenses.mark_paid(test_participant_expense_id, test_participant_id, test_participant_id)
        .then(function() {
          done('Fail - expense appears to have been marked paid by non owner');
        }, function(err) {
          // Err should say that the user is not the owner of the expense.
          assert.notEqual(err, undefined);
          done();
        });
    });
  });
  after(function(done) {
    this.timeout(0);
    var drop_users = db.execute_cql("DROP COLUMNFAMILY users");
    var drop_expenses = db.execute_cql("DROP COLUMNFAMILY expenses");
    var drop_statuses = db.execute_cql("DROP COLUMNFAMILY expense_status");
    Q.all([drop_users, drop_expenses, drop_statuses]).then(function() {
      done();
    }, function(err) {
      done(err);
    });
  });
});
