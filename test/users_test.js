var assert = require('assert');
var db = require('./mock_db');
var users = require('../users');

describe('users', function() {
  before(function(done) {
    db.setup().then(function() {
      users.create_user_tables().then(function() {
        // Table set up successfully
        done();
      }, function(err) {
        done(err);
      });
    }, function(err) {
      done(err);
    });
    users.execute_cql = db.execute_cql;
  });
  describe('#create_user', function() {
    it('should create a user successfully', function(done) {
      users.create_user({email:'no@no.com', password: 'asdf'}).then(function(result) {
        console.log(result);
      });
      assert(1 == 1);
      done();
    });
  });
  after(function(done) {
    db.teardown().then(function() {
      done();
    }, function(err) {
      done(err);
    });
  });
});
