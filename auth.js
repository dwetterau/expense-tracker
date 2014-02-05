var crypto = require('crypto');
var Q = require('q');
var users = require('./users');

function is_logged_in(req) {
  return req.session.user !== undefined;
}

function check_auth(req, res, next) {
  if (!is_logged_in(req)) {
    res.send(401);
  } else {
    var u = new users.User({email: req.session.email});
    u.fetch().then(function() {
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

function random_password(len) {
  var new_password = "";
  var possible_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_";
  for (var i = 0; i < len; i++) {
    new_password += possible_chars.charAt(Math.floor(Math.random() * possible_chars.length));
  }
  return new_password;
}

exports.check_auth = check_auth;
exports.generate_salt = generate_salt;
exports.hash_password = hash_password;
exports.random_password = random_password;
