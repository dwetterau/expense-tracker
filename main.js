var Client = require('node-cassandra-cql').Client;
var Q = require('q');
//var express = require('express');
//var uuid = require('node-uuid');
//var app = express();
var cql_client = new Client({hosts: ['localhost:9042'],
                             keyspace: 'expense_tracker',
                             version: '3.0.0',
                             getAConnectionTimeout: 1000});
var ExifImage = require('exif').ExifImage;
var execute_cql = Q.nbind(cql_client.execute, cql_client);

function extract_metadata(image_data) {
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

function create_image_table() {
  execute_cql('CREATE TABLE images ( image_id timeuuid PRIMARY KEY,' +
              'image_data blob,' +
              'thumbnails map<text, blob>,' +
              'metadata map<text, text>)').then(function() {
                console.log('successful');
              }, function(err) {
                console.error('not successful', err);
              });
}

function store_image(image_data, thumbnails) {
  return extract_metadata(image_data).then(function(full_metadata) {
    console.log('full metadata: ', full_metadata);
    var location = '';
    if (full_metadata.gps) {
      var full_latitude = full_metadata.gps.GPSLatitude;
      if (full_latitude) {
        var latitude = full_latitude[0] + full_latitude[1] / 60 + full_latitude[2] / 3600;
        var full_longitude = full_metadata.gps.GPSLongitude;
        var longitude = full_longitude[0] + full_longitude[1] / 60 + full_longitude[2] / 3600;
        location = latitude + ',' + longitude;
      }
    }
    var date = '';
    if (full_metadata.image && full_metadata.image.ModifyDate) {
      date = full_metadata.image.ModifyDate;
    }
    return {'location': location, 'date': date};
  }, function(err) {
    console.error('Metadata extraction failed', err);
    return {};
  }).then(function(metadata) {
    console.log('metadata: ', metadata);
    return execute_cql('INSERT INTO images' +
                       '(image_id, image_data, metadata, thumbnails)' +
                       ' VALUES (now(), ?, ?, ?)', [image_data, metadata, thumbnails]);
  }).then(
    function(retval) {
      console.log('done!', retval);
    }, function(err) {
      console.error('Error completing store: ', err);
    });
}

exports.create_image_table = create_image_table;
exports.store_image = store_image;
exports.execute = cql_client.execute.bind(cql_client);
