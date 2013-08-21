var Client = require('node-cassandra-cql').Client;
var Q = require('q');
var imagemagick = require('imagemagick');
//var express = require('express');
var uuid = require('node-uuid');
//var app = express();
var cql_client = new Client({hosts: ['localhost:9042'],
                             keyspace: 'expense_tracker',
                             version: '3.0.0',
                             getAConnectionTimeout: 1000});
var ExifImage = require('exif').ExifImage;
var execute_cql = Q.nbind(cql_client.execute, cql_client);

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

function resize_image(image_data, size) {
  return Q.nfcall(imagemagick.resize,
                  {srcData: image_data,
                   width: size[0],
                   height: size[1] })
    .then(function(output) {
      return new Buffer(output[0]);
    });
}

var thumbnail_sizes = [[800, 600], [640, 480]];

function make_thumbnails(image_data, sizes) {
  return Q.all(sizes.map(function(size) {
    return resize_image(image_data, size).then(function(output) {
      var size_string = size[0] + 'x' + size[1];
      return [size_string, new Buffer(output[0])];
    });
  })).then(function(pairs) {
    var return_object = {};
    pairs.forEach(function(pair) {
      return_object[pair[0]] = pair[1];
    });
    return return_object;
  });
}


function create_image_tables() {
  return Q.all([
    execute_cql('CREATE TABLE images ( image_id uuid PRIMARY KEY,' +
                'image_data blob,' +
                'thumbnails map<text, uuid>,' +
                'metadata map<text, text>)'),
    execute_cql('CREATE TABLE thumbnails (thumbnail_id uuid PRIMARY KEY,' +
                'image_data blob,' +
                'orig_image uuid)')
  ]).fail(function(err) {
    console.error('There was an error creating image tables ', err);
  });
}

function store_thumbnail(id, data, orig_id) {
  return execute_cql('INSERT INTO thumbnails' +
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
  thumbnail_sizes.forEach(function(current_size, i) {
    var size_string = current_size[0] + 'x' + current_size[1];
    thumbnail_map[size_string] = thumbnail_ids[i];
  });

  console.log('thumbnail_map', thumbnail_map);

  // Store the image
  var image_p = extract_metadata(image_data).then(function(metadata) {
    return execute_cql('INSERT INTO images' +
                       '(image_id, image_data, metadata, thumbnails)' +
                       ' VALUES (?, ?, ?, ?)',
                       [image_id, image_data, metadata, thumbnail_map]);
  }).fail(function(err) {
    console.error('Could not save image: ', err);
  });

  return Q.all([thumbnails_p, image_p]);
}

exports.create_image_tables = create_image_tables;
exports.store_image = store_image;
exports.execute = cql_client.execute.bind(cql_client);
exports.resize_image = resize_image;
exports.make_thumbnails = make_thumbnails;
