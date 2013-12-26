process.env.NODE_ENV = 'testing';
var assert = require('assert');
var emails = require('../emails');
var schema = require('../schema');

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
  data : JSON.stringify({subject: 'some data'})
};

describe('emails', function() {
  before(function(done) {
    var email = new emails.Email(email1);
    email.save().then(function() {
      done();
    }, function (err) {
      console.error('error creating email', err);
    })
  });

  describe('create_email', function() {
    it('should create an email successfully', function(done) {
      var test_email = JSON.parse(JSON.stringify(email2));
      var email = new emails.Email(test_email);
      email.save().then(function() {
        // Make sure this is a number
        assert(!isNaN(Number(email.get('id'))));
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
  });

//  describe('get_unsent_emails', function() {
//    it('should retrieve 2 unsent emails', function(done) {
//      emails.get_unsent_emails().then(function(email_list) {
//        assert.equal(email_list.length, 2);
//        assert(email_list[0].email_id === email1_id || email_list[1].email_id === email1_id);
//        assert(email_list[0].email_id === email2_id || email_list[1].email_id === email2_id);
//        done();
//      }, function(err) {
//        done(err);
//      });
//    });
//  });

//  describe('sent_email', function() {
//    it('should mark a found email as sent', function(done) {
//      var test_email = JSON.parse(JSON.stringify(email2));
//      test_email.type = undefined;
//      var email = new emails.Email(test_email);
//      try {
//        email.save().then(function() {
//          done(new Error('allowed email to be created'));
//        });
//      } catch(err) {
//        done();
//      }
//      emails.sent_email(email1_id).then(function(expense_id) {
//        return emails.get_unsent_emails();
//      }).then(function(email_list) {
//        assert.equal(email_list.length, 1);
//        assert.equal(email_list[0].email_id, email2_id);
//        done();
//      }, function(err) {
//        done(err);
//      });
//    });
//  });
});

