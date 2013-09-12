var Q = require('q');
var imagemagick = require('imagemagick');
var uuid = require('node-uuid');
var ExifImage = require('exif').ExifImage;
var thumbnail_sizes = ['800x600', '640x480', '320x240'];
var db = require('./db');
var fs = require('fs');

function extract_exif(image_data) {
  var deferred = Q.defer();
  try {
    // This library seems really stupid, replace this with something more sane
    new ExifImage({image: image_data}, function(err, data) {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve(data);
      }
    });
  } catch (err) {
    deferred.reject(err);
  }
  return deferred.promise;
}

function extract_metadata(image_data) {
  return extract_exif(image_data).then(function(exif_data) {
    var location = '';
    if (exif_data.gps) {
      var full_latitude = exif_data.gps.GPSLatitude;
      if (full_latitude) {
        var latitude = full_latitude[0] + full_latitude[1] / 60 + full_latitude[2] / 3600;
        var full_longitude = exif_data.gps.GPSLongitude;
        var longitude = full_longitude[0] + full_longitude[1] / 60 + full_longitude[2] / 3600;
        location = latitude + ',' + longitude;
      }
    }
    var date = '';
    if (exif_data.image && exif_data.image.ModifyDate) {
      date = exif_data.image.ModifyDate;
    }
    return {'location': location, 'date': date};
  }, function(err) {
    console.error('Metadata extraction failed', err);
    return {};
  });
}

function resize_image(image_data, size_string) {
  var size = size_string.split('x');
  return Q.nfcall(imagemagick.resize,
                  {srcData: image_data.toString('binary'),
                   width: size[0],
                   height: size[1] })
    .then(function(output) {
      return new Buffer(output[0], 'binary');
    });
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
  var thumbnails_p = Q.all(thumbnail_sizes.map(function(size, i) {
    var thumbnail_id = thumbnail_ids[i];
    return resize_image(image_data, size).then(function(output) {
      return store_thumbnail(thumbnail_id, output, image_id);
    }, function(err) {
      console.error('Trouble resizing image: ', err);
    });
  })).fail(function(err) {
    console.error('could not save thumbnail: ', err);
  });

  // Produce a map of size -> image id
  var thumbnail_map = {};
  thumbnail_sizes.forEach(function(size_string, i) {
    thumbnail_map[size_string] = thumbnail_ids[i];
  });

  // Store the image
  var thumbnail_map_cql = { value: thumbnail_map,
                            hint: 'map' };
  var image_p = extract_metadata(image_data).then(function(metadata) {
    var metadata_map_cql = { value: metadata,
                             hint: 'map' };
    return db.execute_cql('INSERT INTO images' +
                          '(image_id, image_data, metadata, thumbnails)' +
                          ' VALUES (?, ?, ?, ?)',
                          [image_id, image_data, metadata_map_cql, thumbnail_map_cql]);
  }).fail(function(err) {
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
