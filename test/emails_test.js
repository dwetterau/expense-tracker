process.env.NODE_ENV = 'testing';
var assert = require('assert');
var db = require('../db')();
var schema = require('../schema');
var emails = require('../emails');
var uuid = require('node-uuid');

var email1_id = uuid.v4();
var email2_id = uuid.v4();

var email1 = {
  email_id : email1_id,
  sender: 'a@a.com',
  receiver: 'b@b.com',
  type: emails.email_types.NEW_EXPENSE_NOTIFICATION,
  data : {hint: 'map', value: {subject: 'some data'}},
  sent: false
};

var email2 = {
  email_id : email2_id,
  sender: 'b@b.com',
  receiver: 'a@a.com',
  type: emails.email_types.NEW_EXPENSE_NOTIFICATION,
  data : {subject: 'some data'}
};

describe('emails', function() {
  before(function(done) {
    db.setup().then(function() {
      return schema.create_new_table(schema.schemas.emails);
    }).then(function() {
        return db.insert('emails', email1);
      }).then(function() {
        // Table set up successfully
        done();
      }, function(err) {
        if (err.message.indexOf('Cannot add already existing column family') != -1) {
          console.warn("previous user table existed...", err);
          done();
        } else {
          done(err);
        }
      });
  });
  describe('create_email', function() {
    it('should create an email successfully', function(done) {
      var test_email = JSON.parse(JSON.stringify(email2));
      emails.create_email(test_email).then(function(email_id) {
        // Make sure this is a uuid
        assert.equal(email_id.length, 36);
        done();
      }, function(err) {
        done(err);
      });
    });
    it('should not create an email without a type', function(done) {
      var test_email = JSON.parse(JSON.stringify(email2));
      test_email.type = undefined;
      try {
        emails.create_email(test_email).then(function(email_id) {
          done(new Error('allowed email to be created'));
        });
      } catch(err) {
        assert.equal(err.message, 'Email must have type');
        done();
      }
    });
    it('should not create an email without a sender', function(done) {
      var test_email = JSON.parse(JSON.stringify(email2));
      test_email.sender = undefined;
      try {
        emails.create_email(test_email).then(function(email_id) {
          done(new Error('allowed email to be created'));
        });
      } catch(err) {
        assert.equal(err.message, 'Email must have sender / receiver');
        done();
      }
    });
    it('should not create an email without a receiver', function(done) {
      var test_email = JSON.parse(JSON.stringify(email2));
      test_email.receiver = undefined;
      try {
        emails.create_email(test_email).then(function(email_id) {
          done(new Error('allowed email to be created'));
        });
      } catch(err) {
        assert.equal(err.message, 'Email must have sender / receiver');
        done();
      }
    });
    it('should not create an email without data', function(done) {
      var test_email = JSON.parse(JSON.stringify(email2));
      test_email.data = undefined;
      try {
        emails.create_email(test_email).then(function(email_id) {
          done(new Error('allowed email to be created'));
        });
      } catch(err) {
        assert.equal(err.message, 'Email must have data');
        done();
      }
    });
    it('should not create an email without an id', function(done) {
      var test_email = JSON.parse(JSON.stringify(email2));
      test_email.email_id = undefined;
      try {
        emails.create_email(test_email).then(function(email_id) {
          done(new Error('allowed email to be created'));
        });
      } catch(err) {
        assert.equal(err.message, 'Email must have an id');
        done();
      }
    });
  });

  describe('get_unsent_emails', function() {
    it('should retrieve 2 unsent emails', function(done) {
      emails.get_unsent_emails().then(function(email_list) {
        assert.equal(email_list.length, 2);
        assert(email_list[0].email_id === email1_id || email_list[1].email_id === email1_id);
        assert(email_list[0].email_id === email2_id || email_list[1].email_id === email2_id);
        done();
      }, function(err) {
        done(err);
      });
    });
  });

  describe('sent_email', function() {
    it('should mark a found email as sent', function(done) {
      emails.sent_email(email1_id).then(function(expense_id) {
        return emails.get_unsent_emails();
      }).then(function(email_list) {
        assert.equal(email_list.length, 1);
        assert.equal(email_list[0].email_id, email2_id);
        done();
      }, function(err) {
        done(err);
      });
    });
  });

  after(function(done) {
    db.execute_cql("DROP COLUMNFAMILY emails").then(function() {
      done();
    }, function(err) {
      done(err);
    });
  });
});
