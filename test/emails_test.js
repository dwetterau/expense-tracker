process.env.NODE_ENV = 'testing';
var assert = require('assert');
var emails = require('../emails');
var schema = require('../schema');
var Q = require('q');

var email1 = {
  sender: 'a@a.com',
  receiver: 'b@b.com',
  type: emails.email_types.NEW_EXPENSE_NOTIFICATION,
  data : JSON.stringify({subject: 'some data'}),
  sent: false
};

var email2 = {
  sender: 'b@b.com',
  receiver: 'a@a.com',
  type: emails.email_types.NEW_EXPENSE_NOTIFICATION,
  data : JSON.stringify({subject: 'some data'}),
  sent: false
};

// Email 3 has already been sent
var email3 = JSON.parse(JSON.stringify(email1));
email3.sent = true;

describe('emails', function() {
  before(function(done) {
    var email_1 = new emails.Email(email1);
    var email_2 = new emails.Email(email2);
    var email_3 = new emails.Email(email3);
    Q.all([email_1.save(), email_2.save(), email_3.save()]).then(function() {
      done();
    }, function (err) {
      console.error('error creating emails', err);
    })
  });

  describe('create_email', function() {
    it('should create an email successfully', function(done) {
      var test_email = JSON.parse(JSON.stringify(email2));
      var email = new emails.Email(test_email);
      email.save().then(function() {
        // Make sure this is a number (greater than 3)
        assert(email.get('id') > 3);
        done();
      }, function(err) {
        done(err);
      });
    });

    it('should not create an email without a type', function(done) {
      var test_email = JSON.parse(JSON.stringify(email2));
      test_email.type = undefined;
      var email = new emails.Email(test_email);
      email.save().then(function() {
        done(new Error('allowed email to be created'));
      }, function(err) {
        // There should be a constraint error
        done();
      });
    });
    it('should not create an email without a sender', function(done) {
      var test_email = JSON.parse(JSON.stringify(email2));
      test_email.sender = undefined;
      var email = new emails.Email(test_email);
      email.save().then(function() {
        done(new Error('allowed email to be created'));
      }, function(err) {
        // There should be a constraint error
        done();
      });
    });
    it('should not create an email without a receiver', function(done) {
      var test_email = JSON.parse(JSON.stringify(email2));
      test_email.receiver = undefined;
      var email = new emails.Email(test_email);
      email.save().then(function() {
        done(new Error('allowed email to be created'));
      }, function(err) {
        // There should be a constraint error
        done();
      });
    });
    it('should not create an email without data', function(done) {
      var test_email = JSON.parse(JSON.stringify(email2));
      test_email.data = undefined;
      var email = new emails.Email(test_email);
      email.save().then(function() {
        done(new Error('allowed email to be created'));
      }, function(err) {
        // There should be a constraint error
        done();
      });
    });
    it('should not create an email without a sent value', function(done) {
      var test_email = JSON.parse(JSON.stringify(email2));
      test_email.sent = undefined;
      var email = new emails.Email(test_email);
      email.save().then(function() {
        done(new Error('allowed email to be created'));
      }, function(err) {
        // There should be a constraint error
        done();
      });
    });
  });

  describe('get_unsent_emails', function() {
    it('should retrieve 2 unsent emails', function(done) {
      var unsent_emails = new emails.Emails();
      unsent_emails.get_unsent_emails().then(function() {
        // At time of writing, 1,2, and 4 are unsent, we just rely on 1 and 2 though
        assert(unsent_emails.length >= 2);
        assert(unsent_emails.get(1));
        assert(unsent_emails.get(2));
        assert(!unsent_emails.get(3));
        done();
      }, function(err) {
        done(err);
      });
    });
  });

  describe('sent_email', function() {
    it('should mark an unsent email as sent', function(done) {
      var email = new emails.Email(email1);
      var second_lookup = new emails.Email();
      email.fetch().then(function() {
        second_lookup.set('id', email.get('id'));
        return email.mark_sent();
      }).then(function() {
        return second_lookup.fetch();
      }).then(function() {
        assert(second_lookup.get('sent'));
        done();
      });
    });
    it('shouldn\'t mark a found email as sent more than once', function(done) {
      var email = new emails.Email({id: 1});
      email.fetch().then(function() {
        return email.mark_sent();
      }).then(function() {
          done(new Error('Shouldn\'t have marked as sent twice'));
      }, function(err) {
          done();
      });
    });
  });

  describe('integration', function() {
    it('should create and mark emails as sent', function(done) {
      // We're going to create a new unsent email, and mark as sent
      var email_desc = {
        sender: 'a@a.com',
        receiver: 'b@b.com',
        type: emails.email_types.NEW_EXPENSE_NOTIFICATION,
        data : JSON.stringify({subject: 'some data'}),
        sent: false
      };
      var email = new emails.Email(email_desc);
      var unsent_emails_before = new emails.Emails();
      var unsent_emails_after = new emails.Emails();
      email.save().then(function() {
        // email should have been saved now
        return unsent_emails_before.get_unsent_emails();
      }).then(function() {
        // make sure new email is in this list
        assert(unsent_emails_before.get(email.get('id')));
        // now mark this email as sent
        return email.mark_sent();
      }).then(function() {
        assert(email.get('sent'));
        // perform another query of unsent emails
        return unsent_emails_after.get_unsent_emails();
      }).then(function() {
        assert(unsent_emails_after.length < unsent_emails_before.length);
        assert(!unsent_emails_after.get(email.get('id')));
        done();
      });
    });
  });
});

