var express = require('express');
var app = express();
app.use(express.bodyParser());
var images = require('./images');
var Q = require('q');
var fs = require('fs');

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

app.listen(3000);
