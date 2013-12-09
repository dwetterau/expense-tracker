var db = require('./db');
var auth = require('./auth');
var User = db.bookshelf.Model.extend({
  tableName: 'users',

  hasTimestamps: ['created_at', 'updated_at'],

  login: function(password) {
    return auth.hash_password(password, this.get('salt')).then(
      function(hashed_password) {
        if (this.get('password') == hashed_password) {
          return this;
        } else {
          throw new Error("Invalid email or password");
        }
      }.bind(this)
    );
  },

  salt_and_hash: function() {
    var salt = auth.generate_salt(128);
    this.set('salt', salt);
    return auth.hash_password(this.get('password'), salt)
      .then(function(hash_result) {
        this.set('password', hash_result);
      }.bind(this));
  }
}, {
  login: function(email, password) {
    var u = new User({email: email});
    return u.fetch().then(function() {
      return u.login(password);
    }).catch(function(err) {
      throw new Error("Invalid email or password");
    });
  }
});


exports.User = User;

/*var auth = require('./auth');
var db = require('./db')();
var dbobj = require('./dbobj');
var uuid = require('node-uuid');
var Q = require('q');*/


/*var users = new dbobj.db_type();
dbobj.deletable(users);
users.db_to_user = function(db_data) {
  var row = db_data.rows[0];
  if (row === undefined) {
    // This is compatible with current code,
    // not sure if good idea.
    return undefined;
  }
  return Q({
    name: row.get('name'),
    user_id: row.get('user_id'),
    email: row.get('email'),
    password: row.get('password'),
    salt: row.get('salt')
  });
};

users.columnfamily_name = 'users';
users.primary_key_name = 'email';
users.create_check = true;

function login(user) {
  var retrieved_user;
  return users.get(user.email).then(function(result) {
    if (!result) {
      throw new Error('Invalid email or password'); // Email not found
    }
    retrieved_user = result;
    return auth.hash_password(user.password, retrieved_user.salt);
  })
    .then(function(hashed_password) {
      if (retrieved_user.password == hashed_password) {
        return { user_id: retrieved_user.user_id,
                 name: retrieved_user.name,
                 email: retrieved_user.email
               };
      } else {
        throw new Error('Invalid email or password'); // Actually just invalid password
      }
    });
}

function create_user(user) {
  var salt = auth.generate_salt(128);
  var hashed_password;
  var user_id;
  return auth.hash_password(user.password, salt)
    .then(function(hash_result) {
      hashed_password = hash_result;
      return users.get(user.email);
    })
    .then(function(retrieved_user) {
      if (retrieved_user) {
        throw new Error('Email already in use');
      }
      user_id = uuid.v4();
      return users.create({
        email: user.email,
        password: hashed_password,
        salt: salt,
        user_id: user_id,
        name: user.name
      });
    })
    .then(function() {
      return user_id;
    });
}

function create_session(req, user) {
  req.session.user_id = user.user_id;
  req.session.email = user.email;
  req.session.name = user.name;
}

exports.create_session = create_session;
exports.login = login;
exports.create_user = create_user;
exports.users = users;

// export for testing
exports.db = db;
*/
