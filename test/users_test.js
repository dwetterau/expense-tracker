var assert = require('assert');
var db = require('../db');
var users = require('../users');
var uuid = require('node-uuid');

describe('users', function() {
  before(function(done) {
    db.set_client_testing();
    users.db.set_client_testing();
    db.setup().then(function() {
      users.create_user_tables().then(function() {
        // Table set up successfully
        done();
      }, function(err) {
        if (err.message.indexOf('Cannot add already existing column family') != -1) {
          console.warn("previous user table existed...");
          done();
        } else {
          done(err);
        }
      });
    }, function(err) {
      done(err);
    });
  });
  var test_email = 'test2@test.com';
  var test_password = 'asdf';
  var test_user_id;
  describe('create_user', function() {
    it('should create a user successfully', function(done) {
      users.create_user({email: test_email, password: test_password}).then(function(user_id) {
        // Make sure this is a uuid
        assert.equal(36, user_id.length);
        test_user_id = user_id;
        done();
      }, function(err) {
        done(err);
      });
    });
    it('should not create a user with the same email', function(done) {
      users.create_user({email: test_email, password: test_password}).then(function(user_id) {
        done(new Error('allowed user to be created'));
      }, function(err) {
        assert.equal('Email already in use', err.message);
        done();
      });
    });
  });
  describe('login', function() {
    it('should log in test user', function(done) {
      users.login({email: test_email, password: test_password}).then(function(user_id) {
        // Make sure this is a uuid
        assert.equal(36, user_id.length);
        assert.equal(test_user_id, user_id);
        done();
      }, function(err) {
        done(err);
      });
    });
    it('should not log in test user with wrong password', function(done) {
      users.login({email: test_email, password: test_password + 'A'}).then(function(user_id) {
        done(new Error('allowed user to login'));
      }, function(err) {
        assert.equal('Invalid email or password', err.message);
        done();
      });
    });
    it('should not log in unknown user', function(done) {
      users.login({email: test_email + 'A', password: test_password}).then(function(user_id) {
        done(new Error('allowed user to login'));
      }, function(err) {
        assert.equal('Invalid email or password', err.message);
        done();
      });
    });
  });
  describe('get_user', function() {
    it('should retrieve test user', function(done) {
      users.get_user(test_user_id).then(function(user) {
        assert.equal(test_user_id, user.get('user_id'));
        assert.equal(test_email, user.get('email'));
        done();
      }, function (err) {
        done(err);
      });
    });
    it('should return undefined for unknown user', function(done) {
      users.get_user(uuid.v4()).then(function(user) {
        assert(!user);
        done();
      }, function (err) {
        done(err);
      });
    });
  });
  describe('get_by_email', function() {
    it('should retrieve test user', function(done) {
      users.get_by_email(test_email).then(function(user) {
        assert.equal(test_user_id, user.get('user_id'));
        assert.equal(test_email, user.get('email'));
        done();
      }, function (err) {
        done(err);
      });
    });
    it('should return undefined for unknown user', function(done) {
      users.get_by_email(test_email + 'A').then(function(user) {
        assert(!user);
        done();
      }, function (err) {
        done(err);
      });
    });
  });
  after(function(done) {
    db.execute_cql("DROP COLUMNFAMILY users").then(function() {
      done();
    }, function(err) {
      done(err);
    });
  });
});
