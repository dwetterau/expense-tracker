var crypto = require('crypto');
var Q = require('q');
var users = require('./users');

function is_logged_in(req) {
  return req.session.user_id !== undefined;
}

function check_auth(req, res, next) {
  if (!is_logged_in(req)) {
    // User is not logged in, take them to the login page
    res.redirect('/login');
  } else {
    users.users.get(req.session.user_id).then(function(user) {
      next();
    }, function(err) {
      next(err);
    });
  }
}

function generate_salt(len) {
  return new Buffer(crypto.randomBytes(len)).toString('base64');
}

function hash_password(password, salt) {
  var deferred = Q.defer();
  crypto.pbkdf2(password, salt, 10000, 512, function(err, dk) {
    if (err) {
      console.error('Error hashing a password');
      throw new Error(err);
    } else {
      deferred.resolve(new Buffer(dk).toString('base64'));
    }
  });
  return deferred.promise;
}

exports.check_auth = check_auth;
exports.generate_salt = generate_salt;
exports.hash_password = hash_password;
