process.env.NODE_ENV = 'testing';
var assert = require('assert');
var db = require('../db');
var schema = require('../schema');
var uuid = require('node-uuid');
var Q = require('q');

var User = require('../users').User;
var expenses = require('../expenses');
var Expense = expenses.Expense;
var ExpenseStatus = expenses.ExpenseStatus;
// TODO: refactor all of this stuff into a common test file
Q.longStackSupport = true;

// var user1_id = uuid.v4();
// var user2_id = uuid.v4();
// var expense1_id = uuid.v4();
// var expense2_id = uuid.v4();

var user1 = new User({
  email: 'a@a.com',
  password: 'password',
  name: 'testMan1',
});

var user2 = new User({
  email: 'b@b.com',
  password: 'password',
  name: 'testMan2',
});

// Owned by 1, participation with 2 where 2 is WAITING
var expense1 = new Expense({
  value: 1,
  title: 'Test title1',
  description: 'test description1'
});

// This will connect user2 to expense1
var expensestatus1 = new ExpenseStatus({
  status: expenses.expense_states.WAITING
});

// Owned by 1
var expense2 = new Expense({
  value: 1,
  title: 'Test title2',
  description: 'test description2'
});

// Owned by 1, participation with 2 where 2 is PAID
var expense3 = new Expense({
  value: 1,
  title: 'Test title3',
  description: 'test description3'
});

var expensestatus3 = new ExpenseStatus({
  status: expenses.expense_states.PAID
});


/*var expense1 = {
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
*/

describe('expenses', function() {
  before(function(done) {
    this.timeout(1000000);
    Q.all([schema.create_users(),
           schema.create_expenses(),
           schema.create_expense_status()])
      .then(function() {
        return Q.all([user1.save(), user2.save()]);
      }).then(function() {
        expense1.set('owner_id', user1.get('id'));
        expense2.set('owner_id', user1.get('id'));
        expense3.set('owner_id', user1.get('id'));
        expensestatus1.set('user_id', user2.get('id'));
        expensestatus3.set('user_id', user2.get('id'));
        return Q.all([expense1.save(), expense2.save(), expense3.save()]);
      }).then(function() {
        expensestatus1.set('expense_id', expense1.get('id'));
        expensestatus3.set('expense_id', expense3.get('id'));
        return Q.all([expensestatus1.save(), expensestatus3.save()]);
      }).then(function() { done(); },
              function(err) { done(err); });
  });

  describe('participants', function() {
    it('should allow an owner to be retreived correctly', function(done) {
      var e = new Expense({title: 't',
                           value: 10,
                           owner_id: user1.get('id')
                          });

      e.save().then(function() {
        return e.related('owner').fetch();
      }).then(function() {
        var owner = e.related('owner');
        assert.equal(owner.get('email'), 'a@a.com');
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should allow a participant to be added correctly', function(done) {
      var e = new Expense({title: 't',
                           value: 10,
                           owner_id: user1.get('id')
                          });
      var es;
      e.save().then(function() {
        es = new ExpenseStatus({ user_id: user2.get('id'),
                                 expense_id: e.get('id'),
                                 status: expenses.expense_states.WAITING
                               });
        return es.save();
      }).then(function() {
        return e.related('participants').fetch();
      }).then(function() {
        var p = e.related('participants');
        assert.equal(p.length, 1);
        var status = p.at(0).pivot.get('status');
        assert.equal(status, expenses.expense_states.WAITING);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

  });

  describe('retrieving expenses', function() {
    it('should get the expense with users correctly', function(done) {
      var e = new Expense({ 'id': expense1.get('id')});
      e.getWithAllParticipants().then(function() {
        var owner = e.related('owner');
        assert.equal(owner.get('name'), 'testMan1');
        var participant = e.related('participants').at(0);
        assert.equal(participant.get('name'), 'testMan2');
        assert.equal(participant.status(), expenses.expense_states.WAITING);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should get the owned expenses for a user correctly', function(done) {
      user1.related('owned_expenses').fetch().then(function() {
        var owned_expenses = user1.related('owned_expenses');
        var e1 = owned_expenses.get(expense1.get('id'));
        var e2 = owned_expenses.get(expense2.get('id'));
        assert(e1 && e2);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should get the participated expenses for a user correctly', function(done) {
      var pe = user2.related('participant_expenses');
      pe.fetch().then(function() {
        var e1 = pe.get(expense1.get('id'));
        assert(e1);
        assert.equal(e1.pivot.get('status'), expenses.expense_states.WAITING);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should get the paid expenses for a user correctly', function(done) {
      var pe = user2.paid_expenses();
      pe.fetch().then(function() {
        var e3 = pe.get(expense3.get('id'));
        assert(e3);
        // This should be undefined, as this should only get paid expenses
        var e1 = pe.get(expense1.get('id'));
        assert(e1 === undefined);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should get the unpaid expenses for a user correctly', function(done) {
      var ue = user2.unpaid_expenses();
      ue.fetch().then(function() {
        var e1 = ue.get(expense1.get('id'));
        assert(e1);
        // This should be undefined, as this should only get paid expenses
        var e3 = ue.get(expense3.get('id'));
        assert(e3 === undefined);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should get the finished expenses for a user correctly', function(done) {
      var fe = user1.finished_expenses();
      fe.fetch().then(function() {
        // This should include expense3 but not expense1
        var e1 = fe.get(expense1.get('id'));
        var e3 = fe.get(expense3.get('id'));
        assert(e3);
        assert(e1 === undefined);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should get the unfinished expenses for a user correctly', function(done) {
      var ue = user1.unfinished_expenses();
      ue.fetch().then(function() {
        // This should include expense1, but not expense3
        var e1 = ue.get(expense1.get('id'));
        var e3 = ue.get(expense3.get('id'));
        assert(e1);
        assert(e3 === undefined);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

  });

  describe('Get with permission check', function() {
    it('should allow owners to view expense', function(done) {
      Expense.getWithPermissionCheck(expense1.get('id'), user1.get('id'))
      .then(function(result) {
        assert(result);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should allow participants to view expense', function(done) {
      Expense.getWithPermissionCheck(expense1.get('id'), user2.get('id'))
      .then(function(result) {
        assert(result);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should not allow unrelated participants to view expense', function(done) {
      Expense.getWithPermissionCheck(expense1.get('id'), 12345)
      .then(function(result) {
        done(new Error('Returned ' + result));
      }, function(err) {
        assert.equal(err.message, 'Insufficient permissions');
        done();
      });
    });
  });

  describe('Pay expense', function() {
    var expense;
    // Set up expense with user1 as owner and user2 as participant
    beforeEach(function(done) {
      expense = new Expense({ title: 'pay test',
                              value: 1,
                              description: 'pay test desc',
                              owner_id: user1.get('id')
                            });
      expense.save().then(function() {
        var status = new ExpenseStatus({
          user_id: user2.get('id'),
          expense_id: expense.get('id'),
          status: expenses.expense_states.WAITING
        });
        return status.save();
      }).then(function() {
        return expense.getWithAllParticipants();
      }).then(function() {
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should allow owner to mark user paid', function(done) {
      expense.mark_paid(user1.get('id'), user2.get('id')).then(function() {
        var participant = expense.related('participants').at(0);
        assert.equal(participant.pivot.get('status'), expenses.expense_states.PAID);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should not allow owner to mark random paid', function(done) {
      expense.mark_paid(user1.get('id'), 12345).then(function() {
        done('Marked random as paid??!?');
      }).catch(function(err) {
        assert.equal(err.message, 'User is not included on given expense');
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should not allow user to mark self paid', function(done) {
      expense.mark_paid(user2.get('id'), user2.get('id')).then(function() {
        done('Marked self as paid');
      }).catch(function(err) {
        assert.equal(err.message, 'User is not owner of this expense');
        done();
      }).catch(function(err) {
        done(err);
      });
    });
  });

});



/*

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

  describe('pay_expense', function() {
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

  describe('lazy_delete_expense', function() {
    it('will fail to delete expense for non-owner', function(done) {
      expenses.lazy_delete_expense(expense2_id, user2_id)
        .then(function() {
          done('Fail - should have not allowed the non-owner to delete the expense');
        }, function(err) {
          assert.notEqual(err, undefined);
          done();
        });
    });
    it('will delete expense for owner', function(done) {
      expenses.lazy_delete_expense(expense2_id, user1_id)
        .then(function() {
          done();
        }, function(err) {
          done(err);
        });
    });
    it('will return null for further expense queries', function(done) {
      expenses.get_expense(expense2_id, user1_id)
        .then(function(template_data) {
          assert(!template_data);
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
*/
