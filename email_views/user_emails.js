var emails = require('../emails');

var reset_password_subject = "Your ExpenseTracker password has been reset";
var reset_password_body = "<body>" +
  '<h3>{{name}}, your password has been reset.</h3>' +
  '<div>Your password has been set to <b>{{password}}</b>.</div>' +
  '<div>Please log in and change your password at your earliest convenience.</div>' +
  '<footer>© ExpenseTracker 2013</footer>' +
  '</body>';

var user_subject_map = {};
user_subject_map[emails.email_types.RESET_PASSWORD] = reset_password_subject;

var user_body_map = {};
user_body_map[emails.email_types.RESET_PASSWORD] = reset_password_body;

exports.subject_map = user_subject_map;
exports.body_map = user_body_map;