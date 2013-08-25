var crypto = require('crypto');
var Q = require('q');
var uuid = require('node-uuid');
var execute_cql = require('./db').execute_cql;

function generateSalt(len) {                                                
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

function create_user_tables() {
  return Q.all([
    execute_cql('CREATE TABLE users ( ' +
                'email varchar PRIMARY KEY,' +
                'password varchar,' +
                'user_id uuid)'),
    execute_cql('CREATE INDEX users_user_id ' +
                'ON users (user_id)')
  ]); 
}

function get_user(user_id) {
  return execute_cql(
    'SELECT email FROM users WHERE user_id=?', [user_id])
  .then(function(result) {
    return result.rows[0].get('email');
  });
}

function get_by_email(email) {
  return execute_cql(
    'SELECT user_id FROM users WHERE email=?', [email])
  .then(function(result) {
    return { id: result.rows[0].get('user_id') };
  });
}

function make_user(user) {
  var salt = generateSalt(128);
  return hash_password(user.password, salt)
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
              '(email, password, user_id)' +
              'VALUES (?, ?, ?)',
              [user.email, hashed_password, user_id])
            .then(function() {
              return user_id;
            });
        });
    });
}

exports.get_user = get_user;
exports.make_user = make_user;
exports.create_user_tables = create_user_tables;
exports.get_by_email = get_by_email;
