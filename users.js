var auth = require('./auth');
var db = require('./db')();
var uuid = require('node-uuid');
var Q = require('q');

function user_object(row) {
  return {
    name: row.get('name'),
    user_id: row.get('user_id'),
    email: row.get('email'),
  };
}

function get_user(user_id) {
  return db.execute_cql(
    'SELECT * FROM users WHERE user_id=?', [user_id])
    .then(function(result) {
      return result.rows[0];
    });
}

function get_by_email(email) {
  return db.execute_cql(
      'SELECT * FROM users WHERE email=?', [email])
    .then(function(result) {
      return result.rows[0];
  });
}

function login(user) {
  var retrieved_user;
  return get_by_email(user.email).then(function(result) {
    if (!result) {
      throw new Error('Invalid email or password'); // Email not found
    }
    retrieved_user = result;
    return auth.hash_password(user.password, retrieved_user.get('salt'));
  })
    .then(function(hashed_password) {
      if (retrieved_user.get('password') == hashed_password) {
        return { user_id: retrieved_user.get('user_id'),
                 name: retrieved_user.get('name'),
                 email: retrieved_user.get('email')
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
      return get_by_email(user.email);
    })
    .then(function(retrieved_user) {
      if (retrieved_user) {
        throw new Error('Email already in use');
      }
      user_id = uuid.v4();
      return db.execute_cql(
        'INSERT INTO users' +
          '(email, password, salt, user_id, name) ' +
          'VALUES (?, ?, ?, ?, ?)',
        [user.email, hashed_password, salt, user_id, user.name]);
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
exports.get_by_email = get_by_email;
exports.get_user = get_user;
exports.login = login;
exports.create_user = create_user;
exports.user_object = user_object;

// export for testing
exports.db = db;
