process.env.NODE_ENV = 'testing';
var assert = require('assert');
var db = require('../db')();
var expenses = require('../expenses');
var schema = require('../schema');
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
    it('should be stored correctly', function(done) {
      var expense_id = uuid.v4();
      var test_expense = {
        expense_id: expense_id,
        value: 0,
        participants: [user1],
        waiting: [],
        paid: [],
        title: 'test title',
        description: 'test description',
        receipt_image: undefined,
        owner: user1
      };
      expenses.expenses.create(test_expense).then(function() {
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

    it('should store multiuser expenses correctly', function(done) {
      var expense_id = uuid.v4();
      var test_expense = {
        value: 0,
        participants: [user1, user2],
        title: 'test title',
        description: 'test description',
        receipt_image: undefined,
        owner: user1,
        waiting: [user2],
        paid: [],
        expense_id: expense_id
      };
      expenses.expenses.create(test_expense).then(function() {
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
        expected_participants[user2_id] = expenses.states.WAITING;
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
      expenses.expenses.get(uuid.v4()).then(function(expense) {
        assert(!expense);
        done();
      }, function(err) {
        done(err);
      });
    });

    it('will return undefined if user not in participants', function(done) {
      // expense1_id, random user
      expenses.get_expense(expense1_id, uuid.v4()).then(function(expense) {
        assert(!expense);
        done();
      }, function(err) {
        done(err);
      });
    });

    it('will retrieve the expense successfully', function(done) {
      expenses.get_expense(expense1_id, user1_id).then(function(expense) {
        assert.equal(expense.expense_id,expense1_id);
        assert.equal(expense.title, expense1.title);
        assert.equal(expense.description, expense1.description);
        assert.equal(expense.value, expense1.value);
        assert(!expense.receipt_image);
        assert.equal(expense.participants[0].email, user1.email);
        assert.equal(expense.owner.user_id, user1_id);
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
          // If successful, check that things were appropriately marked, then
          // unmark the expense as paid
          return expenses.expenses.get(expense2_id).then(function(expense) {
            assert.equal(expense.waiting.length, 0);
            assert.equal(expense.paid[0].user_id, user2_id);
          }).fin(function() {
            return db.insert('expenses', expense2);
          });
        })
        .then(function() {
          done();
        })
        .fail(function(err) {
          done(err);
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

  // TODO: Factor out some of this nonsense
  describe('delete expense', function() {
    it('will correctly delete the expense', function(done) {
      var expense_id = uuid.v4();
      var test_expense = {
        value: 0,
        participants: [user1, user2],
        title: 'test title',
        description: 'test description',
        receipt_image: undefined,
        owner: user1,
        waiting: [user2],
        paid: [],
        expense_id: expense_id
      };
      expenses.expenses.create(test_expense).then(function() {
        return expenses.expenses.delete(expense_id);
      }).then(function() {
        return db.execute_cql('SELECT * from expenses where expense_id=?', [expense_id]);
      }).then(function(result) {
        // Assert that the expense is still correctly there
        var row = result.rows[0];
        assert.equal(row.get('value'), 0);
        assert.equal(row.get('title'), 'test title');
        assert.equal(row.get('description'), 'test description');
        assert.equal(row.get('deleted'), 1);
        var expected_participants = {};
        expected_participants[user1_id] = expenses.states.OWNED;
        expected_participants[user2_id] = expenses.states.WAITING;
        assert.deepEqual(row.get('participants'), expected_participants);
        // Lookup via get, assert that it finds nothing
        return expenses.expenses.get(expense_id);
      }).then(function(result) {
        assert(result === undefined);
        // Lookup the statuses, make sure they're deleted
        return db.execute_cql('SELECT * FROM expense_status ' +
                              'where user_id=? AND expense_id=?',
                              [user1.user_id, expense_id]);
      }).then(function(result) {
        var row = result.rows[0];
        assert.equal(row.get('deleted'), 1);
      }).then(function() {
        done();
      }, function(err) {
        done(err);
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
