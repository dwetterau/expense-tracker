var auth = require('./auth');
var db = require('./db')();
var dbobj = require('./dbobj');
var uuid = require('node-uuid');
var Q = require('q');

var email_types = {
  EXPENSE_NOTIFICATION: 1
}

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
    data: row.get('data'),
    sent_time: row.get('sent_time'),
    sent: row.get('sent')
  });
};

emails.columnfamily_name = 'emails';
emails.primary_key_name = 'email_id';

function create_email(email) {
  // check that email has the right form
  if (!email_types[email.type]) {
    throw new Error("Email must have type");
  }
  if (!email.sender || !email.receiver) {
    throw new Error("Email must have sender / receiver");
  }
  if (!email.html) {
    throw new Error("Email must have a body")
  }
  email.email_id = uuid.v4();
  email.sent = false;
  return emails.create(email);
}
