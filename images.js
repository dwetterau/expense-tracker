var Q = require('q');
var gm = require('gm');
var uuid = require('node-uuid');
var thumbnail_sizes = ['800x600', '640x480', '320x240'];
var db = require('./db')();
var fs = require('fs');

function resize_image(image_data, size_strings) {
  var promises = size_strings.map(function(size_string) {
    var size = size_string.split('x');
    var resized = gm(image_data).resize(size[0], size[1]);
    return Q.ninvoke(
      resized, "toBuffer"
    );
  });
  return Q.all(promises);
}

function store_thumbnail(id, data, orig_id) {
  return db.execute_cql('INSERT INTO thumbnails' +
                        '(thumbnail_id, image_data, orig_image)' +
                        'VALUES (?, ?, ?)',
                        [id, data, orig_id]);
}

function store_image(image_data) {
  var image_id = uuid.v4();
  var thumbnail_ids = thumbnail_sizes.map(function() {
    return uuid.v4();
  });

  // Resize and store thumbnails
  var thumbnails_p = resize_image(image_data, thumbnail_sizes).
    then(function(thumbnails_data) {
      var store_promise = thumbnails_data.map(function(thumbnail_data, i) {
        var thumbnail_id = thumbnail_ids[i];
        return store_thumbnail(thumbnail_id, thumbnail_data, image_id);
      });
      return Q.all(store_promise).fail(function(err) {
        console.error('could not save thumbnail', err);
      });
    }).fail(function(err) {
      console.error('Trouble resizing and saving image', err);
    });

  // Produce a map of size -> image id
  var thumbnail_map = {};
  thumbnail_sizes.forEach(function(size_string, i) {
    thumbnail_map[size_string] = thumbnail_ids[i];
  });

  // Store the image
  var thumbnail_map_cql = { value: thumbnail_map,
                            hint: 'map' };
  var image_p = db.execute_cql('INSERT INTO images' +
                               '(image_id, image_data, thumbnails)' +
                               ' VALUES (?, ?, ?)',
                               [image_id, image_data, thumbnail_map_cql])
    .fail(function(err) {
      console.error('Could not save image: ', err);
    });

  return Q.all([thumbnails_p, image_p]).then(function() {
    return image_id;
  });
}

function get_image(image_id) {
  return db.execute_cql('SELECT image_data FROM images' +
                        ' WHERE image_id=?', [image_id])
  .then(function(result) {
    return result.rows[0].get('image_data');
  });
}

function get_thumbnail(image_id, size_string) {
  return db.execute_cql('SELECT thumbnails FROM images' +
                        ' WHERE image_id=?', [image_id])
  .then(function(result) {
    var thumbnail_id = result.rows[0].get('thumbnails')[size_string];
    return db.execute_cql('SELECT image_data FROM thumbnails' +
                          ' WHERE thumbnail_id=?', [thumbnail_id]);
  }).then(function(result) {
    return result.rows[0].get('image_data');
  });
}

function store_image_from_path(image_path) {
  return Q.nfcall(fs.readFile, image_path).then(function(image_data) {
    if (image_data && image_data.length) {
      return store_image(image_data);
    } else {
      throw Error("Empty image");
    }
  });
}

exports.store_image = store_image;
exports.store_image_from_path = store_image_from_path;
exports.get_image = get_image;
exports.get_thumbnail = get_thumbnail;
exports.db = db;
