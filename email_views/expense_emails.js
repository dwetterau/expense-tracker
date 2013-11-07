var emails = require('../emails');

var new_expense_subject = "{{sender}} made a new expense with you"; //TODO: Make this less awkward
var new_expense_body = "<body>" +
  '<h3>You have a new expense with {{sender}}</h3>' +
  '<br>Click <a href="{{expense_link}}">here</a> to view it.</br>' +
  '<br>© ExpenseTracker 2013</br>' +
  '</body>';

var expense_subject_map = {};
expense_subject_map[emails.email_types.NEW_EXPENSE_NOTIFICATION] = new_expense_subject;

var expense_body_map = {};
expense_body_map[emails.email_types.NEW_EXPENSE_NOTIFICATION] = new_expense_body;

exports.subject_map = expense_subject_map;
exports.body_map = expense_body_map;