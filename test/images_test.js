var assert = require('assert');
var images = require('../images');
process.env.NODE_ENV = 'testing';
var db = require('../db')();
var schema = require('../schema');
var fs = require('fs');
var Q = require('q');

describe('images', function(){
  before(function(done) {
    db.setup().then(function() {
      return schema.create_new_table(schema.schemas.images);
    }).then(function() {
      return schema.create_new_table(schema.schemas.thumbnails);
    }).then(function() {
      done();
    }, function(err) {
      if (err.message.indexOf('Cannot add already existing column family') != -1) {
        console.warn("previous image table existed...", err);
        done();
      } else {
        done(err);
      }
    });
  });
  var empty_path = '/tmp/asdfasdfasdf';
  describe('create image from empty path', function() {
    it('should fail returning a failed promise', function(done) {
      var fd = fs.openSync(empty_path, 'w');
      fs.closeSync(fd);
      images.store_image_from_path('/tmp/asdfasdfasdf').then(
        function() {
          done(new Error('Promise was not failed'));
        }, function(err) {
          assert.equal(err.message, 'Empty image');
          done();
      });
    });
  });
  after(function(done) {
    Q.all([db.execute_cql('DROP TABLE images'),
           db.execute_cql('DROP TABLE thumbnails')])
      .then(function() {
        done();
      }, function(err) {
        done(err);
      });
  });
});
