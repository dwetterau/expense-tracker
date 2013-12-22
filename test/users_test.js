process.env.NODE_ENV = 'testing';
var assert = require('assert');
var users = require('../users');
var schema = require('../schema');
var crypto = require('crypto');

// asdf hashed with asdf as salt
var password_data = crypto.pbkdf2Sync('asdf', 'asdf', 10000, 512).toString('base64');

var user1 = {
  email: 'a@a.com',
  name: 'user1Name',
  password: password_data,
  salt: 'asdf',
};

describe('users', function() {
  before(function(done) {
    var u = new users.User(user1);
    u.save().then(function() {
      done();
    }, function(err) {
      console.error('error creating users', err);
    });
  });

  describe('create user', function() {
    it('should create a user successfully', function(done) {
      var test_user = {
        email: 'test2@test.com',
        password: 'PaSsWoRd',
        name: 'testname'
      };
      var u = new users.User(test_user);
      u.salt_and_hash().then(function() {
        return u.save();
      }).then(function(res) {
        assert(u.get('id'));
        done();
      }, function(err) {
        done(err);
      });
    });

    it('should not create a user with the same email', function(done) {
      var test_user = {
        email: user1.email, // Same email as user1
        password: 'PaSsWoRd',
        name: 'testname'
      };

      var u = new users.User(test_user);
      u.save().then(function() {
        done(new Error('allowed user to be created'));
      }, function(err) {
        assert(err);
        done();
      });
    });

  });

  describe('login', function() {
    it('should log in test user', function(done) {
      var u = new users.User({email: user1.email});
      u.fetch().then(function() {
        return u.login('asdf');
      }).then(function() {
        done();
      }, function(err) {
        done(err);
      });
    });

    it('should work using the convenience method', function(done) {
      users.User.login(user1.email, 'asdf').then(function() {
        done();
      }, function(err) {
        done(err);
      });
    });

    it('should not log in a test user with the wrong password', function(done) {
      users.User.login(user1.email, 'wrong').then(function() {
        done('Allowed login with bad password');
      }, function(err) {
        assert.equal(err.message, 'Invalid email or password');
        done();
      });
    });

    it('should not log in unknown user', function(done) {
      users.User.login('a' + user1.email, 'asdf').then(function() {
        done(new Error('allowed user to login'));
      }, function(err) {
        assert.equal(err.message, 'Invalid email or password');
        done();
      });
    });

  });

});
