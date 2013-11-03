var nodemailer = require("nodemailer");
var simplesmtp = require("simplesmtp");

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

/*
smtpTransport.sendMail(mailOptions, function(err, response) {
  if (err) {
    console.log("failed to send email");
  } else {
    console.log("Sent email", response.message);
  }
});
*/


