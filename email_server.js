var handlebars = require("handlebars");
var nodemailer = require("nodemailer");
var emails = require("./emails");
var Q = require('q');

// Email template includes
var expense_emails = require('./email_views/expense_emails');
var user_emails = require('./email_views/user_emails');

var email_templates = [expense_emails, user_emails];

var smtpTransport = nodemailer.createTransport("SMTP", {
  service: "Gmail",
  auth: {
    user: "expensenotifier@gmail.com",
    pass: "ce3f5508acd9"
  }
});

function getSubjectAndBody(email) {
  // find the right map based off the type
  var template;
  email_templates.forEach(function(template_file) {
    if (template_file.subject_map[email.get('type')] != undefined) {
      template = template_file;
    }
  });
  if (!template) {
    console.error(email);
    throw Error("No matching email template found");
  }
  var subject_template = handlebars.compile(template.subject_map[email.get('type')]);
  var body_template = handlebars.compile(template.body_map[email.get('type')]);
  var data_obj = JSON.parse(email.get('data'));
  return {
    subject : subject_template(data_obj),
    body: body_template(data_obj)
  };
}

console.log("Email server started.");
// Check for emails to send loop
setInterval(function() {
  var unsent_emails = new emails.Emails();
  unsent_emails.get_unsent_emails().then(function() {
    if (!unsent_emails || unsent_emails.length == 0) {
      return;
    }
    console.log("Found", unsent_emails.length,
        "email" + (unsent_emails.length != 1 ? "s" : "") + " to send.");
    var markSentPromises = [];
    unsent_emails.forEach(function(email) {
      var subjectAndBody = getSubjectAndBody(email);
      var mailOptions = {
        from: email.get('sender'),
        to: email.get('receiver'),
        subject: subjectAndBody.subject,
        html: subjectAndBody.body
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        if (!err) {
          markSentPromises.push(email.mark_sent());
        } else {
          console.log("Failed to send email", email.email_id);
        }
      });
    });
    Q.all(markSentPromises).then(function() {
      console.log("Successfully sent emails.");
    }, function(err) {
      console.log("Failed to mark some sent emails as sent:", err);
    });
  }, function(err) {
    console.log("Lost connection with email database", err);
  });
}, 5000);

