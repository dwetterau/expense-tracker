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

var user1 = new User({
  email: 'user1@user1.com',
  password: 'password',
  name: 'testMan1',
});

var user2 = new User({
  email: 'user2@user2.com',
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

describe('expenses', function() {
  before(function(done) {
    this.timeout(1000000);
    Q.all([user1.save(), user2.save()])
      .then(function() {
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
        assert.equal(owner.get('email'), 'user1@user1.com');
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

  describe('Expense deletion', function() {
    var e;
    beforeEach(function(done) {
      e = new Expense({owner_id: user1.id,
                       title: 'expense title',
                       value: 1234});

      e.save().then(function() {
        var es = new ExpenseStatus({ user_id: user2.id,
                                     expense_id: e.id,
                                     status: expenses.expense_states.WAITING
                                   });
        return es.save();
      }).then(function() {
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should not return a deleted expense', function(done) {
      var v;
      e.destroy().then(function() {
        v = new Expense({id: e.id});
        return e.fetch();
      }).then(function() {
        assert.equal(v.get('title'), undefined);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should not return an owned deleted expense', function(done) {
      var owned;
      e.destroy().then(function() {
        owned = user1.owned_expenses();
        return owned.fetch();
      }).then(function() {
        assert.equal(owned.get(e.id), undefined);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should not return a participant deleted expense', function(done) {
      var part;
      e.destroy().then(function() {
        part = user2.participant_expenses();
        return part.fetch();
      }).then(function() {
        assert.equal(part.get(e.id), undefined);
        done();
      }).catch(function(err) {
        done(err);
      });
    });
  });

});
