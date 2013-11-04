var auth = require('./auth');
var db = require('./db')();
var dbobj = require('./dbobj');
var uuid = require('node-uuid');
var Q = require('q');

var email_types = {
  EXPENSE_NOTIFICATION: 1
};

var emails = new dbobj.db_type();
emails.db_to_user = function(db_data) {
  var row = db_data.rows[0];
  if (row === undefined) {
    // This is compatible with current code,
    // not sure if good idea.
    return undefined;
  }
  return Q({
    email_id: row.get('email_id'),
    sender: row.get('sender'),
    receiver: row.get('receiver'),
    type: row.get('type'),
    html: row.get('html'),
    sent_time: row.get('sent_time'),
    sent: row.get('sent')
  });
};

emails.columnfamily_name = 'emails';
emails.primary_key_name = 'email_id';

function create_email(email) {
  // check that email has the right form
  var is_valid_type = false;
  for (var type in email_types) {
    if (email_types.hasOwnProperty(type) && email_types[type] == email.type) {
      is_valid_type = true;
      break;
    }
  }
  if (!is_valid_type) {
    throw new Error("Email must have type");
  }
  if (!email.sender || !email.receiver) {
    throw new Error("Email must have sender / receiver");
  }
  if (!email.html) {
    throw new Error("Email must have a body");
  }
  if (!email.email_id) {
    throw new Error("Email must have an id");
  }
  email.sent = false;
  return emails.create(email).then(function() {
    return email.email_id;
  });
}

function get_unsent_emails() {
  return emails.get_db_data({'sent' : false})
    .then(function(db_data) {
      var email_objs = [];
      while(db_data.rows.length > 0) {
        var email_obj = emails.db_to_user({rows: db_data.rows.splice(0, 1)});
        email_objs.push(email_obj);
      }
      return Q.all(email_objs);
  });
}

function sent_email(email_id) {
  return emails.get(email_id)
    .then(function(email) {
      email.sent = true;
      //email.sent_time = new Date();
      return emails.update(email);
    }).then(function() {
      return email_id;
    });
}

exports.email_types = email_types;
exports.create_email = create_email;
exports.get_unsent_emails = get_unsent_emails;
exports.sent_email = sent_email;
exports.emails = emails;

// Export for testing
exports.db = db;
