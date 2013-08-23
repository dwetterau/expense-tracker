var express = require('express');
var app = express();
app.use(express.bodyParser());
var images = require('./images');
var users = require('./users');
var Q = require('q');
var fs = require('fs');

// User routes

app.get('/user/:id', function(req, res) {
  var user_id = req.params.id;
  users.get_user(user_id).then(function(data) {
    res.send('Retrieved user data: ' + data);
  }, function(err) {
    res.send(500, 'An error occured making the account: ' + err);
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
    res.send(500, 'An error occured making the account: ' + err);
  });
});

app.get('/make_account', function(req, res) {
  res.send('<html><body><form method="post" enctype="multipart/form-data">' +
           '<div><label for="email">Email: </label>' +
           '<input type="email" name="email" required="required" /></div>' +
           '<div><label for="password">Password: </label>' +
           '<input type="password" name="password" required="required" /></div>' +
           '<input type="submit" value="Create Account" />' +
           '</form></body> </html>');
});

// Image routes

app.get('/images/:uuid', function(req, res) {
  var image_id = req.params.uuid;
  images.get_image(image_id).then(function(image_data) {
    res.set('Content-Type', 'image/jpeg');
    res.send(image_data);
  }, function(err) {
    res.send(500, 'An error occured getting the image: ' + err);
  });
});

app.get('/thumb/:uuid/:size', function(req, res) {
  var image_id = req.params.uuid;
  var size_string = req.params.size;
  images.get_thumbnail(image_id, size_string).then(function(image_data) {
    res.set('Content-Type', 'image/jpeg');
    res.send(image_data);
  }, function(err) {
    res.send(500, 'An error occured getting the image: ' + err);
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
    res.send(500, 'An error occured uploading the image: ' + err);
  });
});

app.get('/upload_image', function(req, res) {
  res.send('<html><body><form method="post" enctype="multipart/form-data">' +
           '<input type="file" name="image" />' +
           '<input type="submit" value="upload" />' +
           '</form> </body> </html>');
});

//users.create_user_tables();
//images.create_image_tables();


var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Listening on", port);
});
