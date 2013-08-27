var express = require('express');
var app = express();
app.use(express.bodyParser());
var images = require('./images');
var users = require('./users');
var Q = require('q');
var fs = require('fs');
var exphbs = require('express3-handlebars');
var expenses = require('./expenses');

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// Error sending
function send_error(res, info) {
  res.render('error',
             { title: 'An error occured',
               info: info},
             function(err, response) {
               res.send(500, response);
             });
}
  

// User routes
app.get('/user/:id', function(req, res) {
  var user_id = req.params.id;
  users.get_user(user_id).then(function(data) {
    res.render('user', { title: data, email: data});
  }, function(err) {
    send_error(res, 'An error occured making the account: ' + err);
  });
});

app.post('/make_account', function(req, res) {
  var email = req.body.email;
  var password = req.body.password;
  var new_user = {
    email: email,
    password: password
  };
  users.make_user(new_user).then(function(user_id) {
    res.redirect('/user/' + user_id);
  }, function(err) {
    send_error(res, 'An error occured making the account: ' + err);
  });
});

app.get('/make_account', function(req, res) {
  res.render('make_account');
});

// Image routes

app.get('/images/:uuid', function(req, res) {
  var image_id = req.params.uuid;
  images.get_image(image_id).then(function(image_data) {
    res.set('Content-Type', 'image/jpeg');
    res.send(image_data);
  }, function(err) {
    send_error(res, 'An error occured getting the image: ' + err);
  });
});

app.get('/thumb/:uuid/:size', function(req, res) {
  var image_id = req.params.uuid;
  var size_string = req.params.size;
  images.get_thumbnail(image_id, size_string).then(function(image_data) {
    res.set('Content-Type', 'image/jpeg');
    res.send(image_data);
  }, function(err) {
    send_error(res, 'An error occured getting the image: ' + err);
  });
});

app.post('/upload_image', function(req, res) {
  // Not happy about reading it from the disk
  var path = req.files.image.path;
  Q.nfcall(fs.readFile, path).then(function(data) {
    return images.store_image(data);
  }).then(function(image_id) {
    res.redirect('/images/' + image_id);
  }, function(err) {
    send_error(res, 'An error occured uploading the image: ' + err);
  });
});

app.get('/upload_image', function(req, res) {
  res.render('upload_image');
});

// Expenses routes
app.get('/create_expense', function(req, res) {
  res.render('create_expense');
});

app.post('/create_expense', function(req, res) {
  var title = req.body.title;
  var description = req.body.description || undefined;
  var value = req.body.value;
  var participants = req.body.participants && req.body.participants.split(',');
  participants = participants || [];
  expenses.store_expense({ value: value,
                           participants: participants,
                           title: title,
                           description: description
                         })
  .then(function(expense_id) {
    res.redirect('/expense/' + expense_id);
  }, function(err) {
    send_error(res, 'An error occured making the expense: ' + err);
  });
});

app.get('/expense/:expense_id', function(req, res) {
  var expense_id = req.params.expense_id;
  expenses.get_expense(expense_id).then(function(expense) {
    res.render('expense', {title: 'Expense detail', expense: expense});
  }, function(err) {
    send_error(res, 'An error occured retreiving the expense: ' + err);
  });
});

//users.create_user_tables();
//images.create_image_tables();


var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Listening on", port);
});
