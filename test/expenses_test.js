process.env.NODE_ENV = 'testing';
var assert = require('assert');
var db = require('../db')();
var expenses = require('../expenses');
var schema = require('../schema');
var users = require('../users');
var uuid = require('node-uuid');
var Q = require('q');
// TODO: refactor all of this stuff into a common test file
Q.longStackSupport = true;

var user1_id = uuid.v4();
var user2_id = uuid.v4();
var expense1_id = uuid.v4();
var expense2_id = uuid.v4();

var user1 = {
  email: 'a@a.com',
  password: 'password',
  name: 'testMan1',
  user_id: user1_id
};

var user2 = {
  email: 'b@b.com',
  password: 'password',
  name: 'testMan2',
  user_id: user2_id
};

var expense1 = {
  expense_id: expense1_id,
  value: 1,
  participants: {hint: 'map',
                 value: {}
                },
  title: 'Test title1',
  description: 'test description1',
  owner: user1_id
};
expense1.participants.value[user1_id] = expenses.states.OWNED;

var expense2 = {
  expense_id: expense2_id,
  value: 2,
  participants: {hint: 'map',
                 value: {}
                },
  title: 'Test title2',
  description: 'test description2',
  owner: user1_id
};
expense2.participants.value[user1_id] = expenses.states.OWNED;
expense2.participants.value[user2_id] = expenses.states.WAITING;

describe('expenses', function() {
  before(function(done) {
    this.timeout(30000);
    db.setup().then(function() {
      return schema.create_new_table(schema.schemas.users);
    }).then(function() {
      return schema.create_new_table(schema.schemas.expenses);
    }).then(function() {
      return schema.create_new_table(schema.schemas.expense_status);
    }).then(function(){
      return Q.all([ db.insert('users', user1),
                     db.insert('users', user2),
                     db.insert('expenses', expense1),
                     db.insert('expenses', expense2)
                   ]);
    }).then(function() {
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
  describe('store_expense', function() {
    it('won\'t store the expense because the user can\'t be found', function(done) {
      var test_expense = {
        value: 0,
        participants: ['c@c.com'], // Some random email
        title: 'title',
        description: 'description',
      };
      expenses.store_expense(test_expense).then(function() {
        throw new Error('Should not have allowed expense to be created');
      }, function(err) {
        assert.equal(err.message, "User: c@c.com does not exist.");
      }).then(function() {
        done();
      }, function(err) {
        done(err);
      });
    });

    it('should be stored correctly', function(done) {
      var test_expense = {
        value: 0,
        participants: ['a@a.com'], // user1
        title: 'test title',
        description: 'test description',
        receipt_image: undefined,
        owner: user1_id
      };
      expenses.store_expense(test_expense).then(function(expense_id) {
        assert(expense_id);
        return db.execute_cql('SELECT * from expenses where expense_id=?',
                              [expense_id]);
      }).then(function(result) {
        var row = result.rows[0];
        assert.equal(row.get('value'), 0);
        assert.equal(row.get('title'), 'test title');
        assert.equal(row.get('description'), 'test description');
        var expected_participants = {};
        expected_participants[user1_id] = expenses.states.OWNED;
        assert.deepEqual(row.get('participants'), expected_participants);
      }).then(function() {
        done();
      }, function(err) {
        done(err);
      });
    });
  });

  describe('get_expense', function() {

    it('will return undefined if no expense is found', function(done) {
      // Random expense_id, user1
      expenses.get_expense(uuid.v4(), user1_id).then(function(template_data) {
        assert(!template_data);
        done();
      }, function(err) {
        done(err);
      });
    });

    it('will return undefined if user not in participants', function(done) {
      // expense1_id, random user
      expenses.get_expense(expense1_id, uuid.v4()).then(function(template_data) {
        assert(!template_data);
        done();
      }, function(err) {
        done(err);
      });
    });

    it('will retrieve the expense successfully', function(done) {
      expenses.get_expense(expense1_id, user1_id).then(function(template_data) {
        assert.equal(template_data.expense_id,expense1_id);
        assert.equal(template_data.title, expense1.title);
        assert.equal(template_data.description, expense1.description);
        assert.equal(template_data.value, expense1.value);
        assert(!template_data.receipt_image);
        assert.equal(template_data.participants_status[0].email, user1.email);
        assert.equal(template_data.participants_status[0].status, expenses.states.OWNED);
        done();
      }).fail(function(err) {
        done(err);
      });
    });
  });

  describe('pay expense', function() {
    it('will pay the expense if the user is the owner', function(done) {
      expenses.mark_paid(expense2_id, user1_id, user2_id)
        .then(function() {
          done();
        }, function(err) {
          done(err);
        });
      after(function(done) {
        // unmark the expense as paid
        db.insert('expenses', expense2)
          .then(function() {
            done();
          }, function(err) {
            console.warn('could not reset expense2!' + err);
            done();
          });
      });
    });

    it('will not pay the expense if the user is not the owner', function(done) {
      expenses.mark_paid(expense2_id, user2_id, user2_id)
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
