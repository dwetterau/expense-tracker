process.env.NODE_ENV = 'testing';
var assert = require('assert');
var Q = require('q');

var db = require('../db');
var schema = require('../schema');
var load_test_data = require('./load_test_data');
var test_data = require('./test_data');

var User = require('../users').User;
var expenses = require('../expenses');
var Expense = expenses.Expense;
var ExpenseStatus = expenses.ExpenseStatus;
// TODO: refactor all of this stuff into a common test file
Q.longStackSupport = true;

describe('expenses', function() {
  before(function(done) {
    this.timeout(1000000);
    load_test_data.install_test_data()
      .then(function() {
        done();
      }, function(err) {
        done(err);
      });
  });

  after(function(done) {
    load_test_data.reset().then(function() {
      done();
    }, function(err) {
      done(err);
    });
  });

  describe('participants', function() {
    it('should allow an owner to be retreived correctly', function(done) {
      var e = new Expense({title: 't',
                           value: 10,
                           owner_id: 1
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
                           owner_id: 1
                          });
      var es;
      e.save().then(function() {
        es = new ExpenseStatus({ user_id: 2,
                                 expense_id: e.id,
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
      var e = new Expense({ 'id': 1});
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
      var user1 = new User(test_data.users[0]);

      user1.related('owned_expenses').fetch().then(function() {
        var owned_expenses = user1.related('owned_expenses');
        var e1 = owned_expenses.get(1);
        var e3 = owned_expenses.get(3);
        assert(e1 && e3);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should get the participated expenses for a user correctly', function(done) {
      var user2 = new User(test_data.users[1]);

      var pe = user2.related('participant_expenses');
      pe.fetch().then(function() {
        var e1 = pe.get(1);
        assert(e1);
        assert.equal(e1.pivot.get('status'), expenses.expense_states.WAITING);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should get the paid expenses for a user correctly', function(done) {
      var user2 = new User(test_data.users[1]);

      var pe = user2.paid_expenses();
      pe.fetch().then(function() {
        var e3 = pe.get(3);
        assert(e3);
        // This should be undefined, as this should only get paid expenses
        var e1 = pe.get(1);
        assert(e1 === undefined);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should get the unpaid expenses for a user correctly', function(done) {
      var user2 = new User(test_data.users[1]);

      var ue = user2.unpaid_expenses();
      ue.fetch().then(function() {
        var e1 = ue.get(1);
        assert(e1);
        // This should be undefined, as this should only get paid expenses
        var e3 = ue.get(3);
        assert(e3 === undefined);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should get the finished expenses for a user correctly', function(done) {
      var user1 = new User(test_data.users[0]);

      var fe = user1.finished_expenses();
      fe.fetch().then(function() {
        // This should include expense3 but not expense1
        var e1 = fe.get(1);
        var e3 = fe.get(3);
        assert(e3);
        assert(e1 === undefined);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should get the unfinished expenses for a user correctly', function(done) {
      var user1 = new User(test_data.users[0]);

      var ue = user1.unfinished_expenses();
      ue.fetch().then(function() {
        // This should include expense1, but not expense3
        var e1 = ue.get(1);
        var e3 = ue.get(3);
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
      Expense.getWithPermissionCheck(1, 1)
      .then(function(result) {
        assert(result);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should allow participants to view expense', function(done) {
      Expense.getWithPermissionCheck(1, 2)
      .then(function(result) {
        assert(result);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should not allow unrelated participants to view expense', function(done) {
      Expense.getWithPermissionCheck(1, 12345)
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
                              owner_id: 1
                            });
      expense.save().then(function() {
        var status = new ExpenseStatus({
          user_id: 2,
          expense_id: expense.id,
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
      expense.mark_paid(1, 2).then(function() {
        var participant = expense.related('participants').at(0);
        assert.equal(participant.pivot.get('status'), expenses.expense_states.PAID);
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should not allow owner to mark random paid', function(done) {
      expense.mark_paid(1, 12345).then(function() {
        done('Marked random as paid??!?');
      }).catch(function(err) {
        assert.equal(err.message, 'User is not included on given expense');
        done();
      }).catch(function(err) {
        done(err);
      });
    });

    it('should not allow non-owner to mark self paid', function(done) {
      expense.mark_paid(2, 2).then(function() {
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
      e = new Expense({owner_id: 1,
                       title: 'expense title',
                       value: 1234});

      e.save().then(function() {
        var es = new ExpenseStatus({ user_id: 2,
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
      var user1 = new User(test_data.users[0]);

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
      var user2 = new User(test_data.users[1]);
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
