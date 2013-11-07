var handlebars = require("handlebars");
var nodemailer = require("nodemailer");
var emails = require("./emails");
var Q = require('q');

// Email template includes
var expense_emails = require('./email_views/expense_emails');

var email_templates = [expense_emails];

var smtpTransport = nodemailer.createTransport("SMTP", {
  service: "Gmail",
  auth: {
    user: "expensenotifier@gmail.com",
    pass: "ce3f5508acd9"
  }
});

var mailOptions= {
  from: "Test notification blahblah",
  to: "conderoga@gmail.com",
  subject: "you have been notified",
  text: "The message body in plaintext..."
  //html: "The message body in html"
};

function getSubjectAndBody(email) {
  // find the right map based off the type
  var template;
  email_templates.forEach(function(template_file) {
    if (template_file.subject_map[email.type] != undefined) {
      template = template_file;
    }
  });
  if (!template) {
    console.error(email);
    throw Error("No matching email template found");
  }
  var subject_template = handlebars.compile(template.subject_map[email.type]);
  var body_template = handlebars.compile(template.body_map[email.type]);
  return {
    subject : subject_template(email.data),
    body: body_template(email.data)
  };
}

console.log("Email server started.");
// Check for emails to send loop
setInterval(function() {
  emails.get_unsent_emails().then(function(emails_to_send) {
    if (!emails_to_send || emails_to_send.length == 0) {
      return;
    }
    console.log("Found", emails_to_send.length, "emails to send.");
    var markSentPromises = [];
    emails_to_send.forEach(function(email) {
      var subjectAndBody = getSubjectAndBody(email);
      var mailOptions = {
        from: email.sender,
        to: email.receiver,
        subject: subjectAndBody.subject,
        html: subjectAndBody.body
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        if (!err) {
          markSentPromises.push(emails.sent_email(email.email_id));
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
    console.log("Lost connection with cassandra", err);
  });
}, 5000);

