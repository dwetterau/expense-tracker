var assert = require('assert');
var db = require('../db');
var users = require('../users');
var uuid = require('node-uuid');

describe('users', function() {
  before(function(done) {
    db.set_client_testing();
    users.db.set_client_testing();
    db.setup().then(function() {
      return users.create_user_tables();
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
  var test_email = 'test2@test.com';
  var test_password = 'asdf';
  var test_user_id;
  describe('create_user', function() {
    it('should create a user successfully', function(done) {
      users.create_user({email: test_email, password: test_password}).then(function(user_id) {
        // Make sure this is a uuid
        assert.equal(user_id.length, 36);
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
        assert.equal(err.message, 'Email already in use');
        done();
      });
    });
  });
  describe('login', function() {
    it('should log in test user', function(done) {
      users.login({email: test_email, password: test_password}).then(function(user_id) {
        // Make sure this is a uuid
        assert.equal(user_id.length, 36);
        assert.equal(user_id, test_user_id);
        done();
      }, function(err) {
        done(err);
      });
    });
    it('should not log in test user with wrong password', function(done) {
      users.login({email: test_email, password: test_password + 'A'}).then(function(user_id) {
        done(new Error('allowed user to login'));
      }, function(err) {
        assert.equal(err.message, 'Invalid email or password');
        done();
      });
    });
    it('should not log in unknown user', function(done) {
      users.login({email: test_email + 'A', password: test_password}).then(function(user_id) {
        done(new Error('allowed user to login'));
      }, function(err) {
        assert.equal(err.message, 'Invalid email or password');
        done();
      });
    });
  });
  describe('get_user', function() {
    it('should retrieve test user', function(done) {
      users.get_user(test_user_id).then(function(user) {
        assert.equal(user.get('user_id'), test_user_id);
        assert.equal(user.get('email'), test_email);
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
        assert.equal(user.get('user_id'), test_user_id);
        assert.equal(user.get('email'), test_email);
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
