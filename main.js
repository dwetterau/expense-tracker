var express = require('express');
var app = express();
var images = require('./images');

app.get('/images/:uuid', function(req, res) {
  var image_id = req.params.uuid;
  images.get_image(image_id).then(function(image_data) {
    res.set('Content-Type', 'image/jpeg');
    res.send(image_data);
  });
});

app.get('/thumb/:uuid/:size', function(req, res) {
  var image_id = req.params.uuid;
  var size_string = req.params.size;
  images.get_thumbnail(image_id, size_string).then(function(image_data) {
    res.set('Content-Type', 'image/jpeg');
    res.send(image_data);
  });
});

app.listen(3000);
