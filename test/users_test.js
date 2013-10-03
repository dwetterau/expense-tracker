var assert = require('assert');
process.env.NODE_ENV = 'testing';
var db = require('../db')();
var schema = require('../schema');
var users = require('../users');
var uuid = require('node-uuid');

var user1_id = uuid.v4();

// asdf hashed with asdf as salt
var password_data = "pKz/Wd//4nNCSr+4s2FnDSxe3Zhr15w8ZeBpHiryJSmeoGd/0HjfiJyjy1m+YPiE4vrpTC7WwgLue9wHYtWzxWK/vzJB7fxUqdNkfs4pHPf8BQ/qLlk8t/HbToZ4NEHzgKEABirQe9nGZY9K1RObbegbVUT9kvBwTMMvz0vK6kTeQcrXAsq3TbZmBwELGwphRAHogksBgdWUW+xWDV1oEkq2lEKmGambFodz2z54XvyVgbBYaaPZNTZ5IrWOgqQiWsmSyTnlv6b9YHiiOjRMOSmTMRqRB4c/f7gwRjumOtXKZ4gIDn1SKWu2ioZ6/oCiKCw2jvn3qiYiFnLg7B1myLRWDuRj/QwJJfQEpDupfEkW70v4kKrKtA0AeClHlwvUS1O1dzggEF9pi6ptiIDwqW1ZAeZwI7rJbZ6ISXBDmKwmb/v6oJs+Un8dqE9bf5R+7oEC64j5AOkT5N5AkcB1/blcGexFi0bTj6b2ZFHA2mhJW2R6j+XRAmye/ev+gDAUIXW0yTviiwArwwOnzgUyigXYAxUqf6ccAsfPs4ISsVwRQIcpHaF3nOqqFZFgG8Ppe3O0+nKv6WJgGhLjzRSONkNO9h1NCisKbThiu8RsKb1MpOvt34LsiFd/Ga7vd6jByh8vQIplMHyHCNkPCOs9ofIpZmQ8evQSDfqr/uT8M7M=";

var user1 = {
  email: 'a@a.com',
  name: 'user1Name',
  password: password_data,
  salt: 'asdf',
  user_id: user1_id
};

describe('users', function() {
  before(function(done) {
    db.setup().then(function() {
      return schema.create_new_table(schema.schemas.users);
    }).then(function() {
      return db.insert('users', user1);
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
  describe('create_user', function() {
    it('should create a user successfully', function(done) {
      var test_user = {
        email: 'test2@test.com',
        password: 'PaSsWoRd',
        name: 'testname'
      };
      users.create_user(test_user).then(function(user_id) {
        // Make sure this is a uuid
        assert.equal(user_id.length, 36);
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
      users.create_user(test_user).then(function() {
        done(new Error('allowed user to be created'));
      }, function(err) {
        assert.equal(err.message, 'Email already in use');
        done();
      });
    });
  });

  describe('login', function() {
    it('should log in test user', function(done) {
      users.login({email: user1.email, password: 'asdf'}).then(function(user) {
        assert.equal(user.user_id, user1.user_id);
        assert.equal(user.name, user1.name);
        assert.equal(user.email, user1.email);
        done();
      }, function(err) {
        done(err);
      });
    });

    it('should not log in test user with wrong password', function(done) {
      users.login({email: user1.email, password: 'asdff'}).then(function() {
        done(new Error('allowed user to login'));
      }, function(err) {
        assert.equal(err.message, 'Invalid email or password');
        done();
      });
    });

    it('should not log in unknown user', function(done) {
      users.login({email: 'a' + user1.email, password: 'asdf'}).then(function() {
        done(new Error('allowed user to login'));
      }, function(err) {
        assert.equal(err.message, 'Invalid email or password');
        done();
      });
    });
  });

  describe('get_user', function() {
    it('should retrieve test user', function(done) {
      users.get_user(user1.user_id).then(function(user) {
        assert.equal(user.get('user_id'), user1.user_id);
        assert.equal(user.get('email'), user1.email);
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
      users.get_by_email(user1.email).then(function(user) {
        assert.equal(user.get('user_id'), user1.user_id);
        assert.equal(user.get('email'), user1.email);
        done();
      }, function (err) {
        done(err);
      });
    });

    it('should return undefined for unknown user', function(done) {
      users.get_by_email(user1.email + 'A').then(function(user) {
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
