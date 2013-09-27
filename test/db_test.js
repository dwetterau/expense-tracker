process.env.NODE_ENV = 'testing';
var assert = require('assert');
var db = require('../db')();
var schema = require('../schema');
var Q = require('q');
var uuid = require('node-uuid');
Q.longStackSupport = true;

describe('database', function() {
  before(function(done) {
    this.timeout(30000);
    db.setup().then(function(){
      return schema.create_new_table(schema.schemas.users);
    }).then(function() {
      done();
    }, function(err) {
      done(err);
    });
  });

  describe('insert', function() {
    it('will correctly insert data', function(done) {
      var data = { email: 'email_data',
                   password: 'password_data',
                   salt: 'salt_data',
                   user_id: uuid.v4(),
                   name: 'name_data'
                 };
      db.insert('users', data).then(function() {
        return db.execute_cql('SELECT * FROM users WHERE email=?',
                              ['email_data']);
      }).then(function(results) {
        var row = results.rows[0];
        assert.equal(row.get('email'), 'email_data');
        assert.equal(row.get('password'), 'password_data');
        assert.equal(row.get('salt'), 'salt_data');
        assert.equal(row.get('name'), 'name_data');
        done();
      }).fail(function(err) {
        done(err);
      });
    });
  });

  after(function(done) {
    this.timeout(0);
    var drop_users = db.execute_cql("DROP COLUMNFAMILY users");
    Q.all([drop_users]).then(function() {
      done();
    }, function(err) {
      done(err);
    });
  });
});
