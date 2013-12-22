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

/*
var db = require('../db')();
var schema = require('../schema');
var users = require('../users');
var uuid = require('node-uuid');
var crypto = require('crypto');

var user1_id = uuid.v4();

// asdf hashed with asdf as salt
var password_data = crypto.pbkdf2Sync('asdf', 'asdf', 10000, 512).toString('base64');

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
      users.users.get({user_id: user1.user_id}).then(function(user) {
        assert.equal(user.user_id, user1.user_id);
        assert.equal(user.email, user1.email);
        done();
      }, function (err) {
        done(err);
      });
    });

    it('should return undefined for unknown user', function(done) {
      users.users.get({user_id: uuid.v4()}).then(function(user) {
        assert(!user);
        done();
      }, function (err) {
        done(err);
      });
    });
  });

  describe('get_by_email', function() {
    it('should retrieve test user', function(done) {
      users.users.get(user1.email).then(function(user) {
        assert.equal(user.user_id, user1.user_id);
        assert.equal(user.email, user1.email);
        done();
      }, function (err) {
        done(err);
      });
    });

    it('should return undefined for unknown user', function(done) {
      users.users.get(user1.email + 'A').then(function(user) {
        assert(!user);
        done();
      }, function (err) {
        done(err);
      });
    });

    it('should support deleting a user', function(done) {
      var deleter = {
        email: 'deleter@a.com',
        name: 'deleterName',
        password: 'asdf'
      };
      var id;
      users.create_user(deleter)
      .then(function(user_id) {
        assert(user_id);
        id = user_id;
        return users.users.delete('deleter@a.com');
      }).then(function() {
        return users.users.get('deleter@a.com');
      }).then(function(result) {
        assert(!result);
        done();
      }).fail(function(err) {
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
*/
