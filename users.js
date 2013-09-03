var Q = require('q');
var uuid = require('node-uuid');
var auth = require('./auth');
var execute_cql = require('./db').execute_cql;

function create_user_tables() {
  return execute_cql('CREATE TABLE users ( ' +
                     'email varchar PRIMARY KEY,' +
                     'password varchar,' +
                     'salt varchar,' +
                     'user_id uuid)')
    .then(function() {
      return execute_cql('CREATE INDEX users_user_id ' +
                         'ON users (user_id)');
    });
}

function get_user(user_id) {
  return execute_cql(
    'SELECT email FROM users WHERE user_id=?', [user_id])
    .then(function(result) {
      return result.rows[0];
    });
}

function get_by_email(email) {
  return execute_cql(
      'SELECT * FROM users WHERE email=?', [email])
    .then(function(result) {
      return result.rows[0];
  });
}

function login(user) {
  return get_by_email(user.email).then(function(retrieved_user) {
    if (!retrieved_user) {
      throw new Error('Invalid email or password'); // Email not found
    }
    return auth.hash_password(user.password, retrieved_user.get('salt'))
        .then(function(hashed_password) {
      if (retrieved_user.get('password') == hashed_password) {
        return retrieved_user.get('user_id');
      } else {
        throw new Error('Invalid email or password'); // Actually just invalid password
      }
    });
  });
}

function create_user(user) {
  var salt = auth.generate_salt(128);
  return auth.hash_password(user.password, salt)
      .then(function(hashed_password) {
    var user_id = uuid.v4();
    return execute_cql(
        'SELECT email FROM users WHERE email=?',
        [user.email])
        .then(function(email_search) {
      if (email_search.rows.length > 0) {
        throw new Error('Email already in use');
      }
      return execute_cql(
          'INSERT INTO users' +
          '(email, password, salt, user_id)' +
          'VALUES (?, ?, ?, ?)',
          [user.email, hashed_password, salt, user_id])
          .then(function() {
        return user_id;
      });
    });
  });
}

function create_session(req, user_id, email) {
  req.session.user_id = user_id;
  req.session.email = email;
}

function delete_session(req) {
  delete req.session.user_id;
  delete req.session.email;
}

exports.create_user_tables = create_user_tables;
exports.create_session = create_session;
exports.delete_session = delete_session;
exports.get_by_email = get_by_email;
exports.get_user = get_user;
exports.login = login;
exports.create_user = create_user;
