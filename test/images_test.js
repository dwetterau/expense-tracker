var assert = require('assert');
var images = require('../images');
var db = require('../db');
var fs = require('fs');
var Q = require('q');

describe('images', function(){
  before(function(done) {
    db.set_client_testing();
    images.db.set_client_testing();
    db.setup().then(function() {
      return images.create_image_tables();
    }).then(function() {
      done();
    }, function(err) {
      if (err.message.indexOf('Cannot add already existing column family') != -1) {
        console.warn("previous user table existed...");
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
          done('Promise was not failed');
        }, function(err) {
          assert.equal(err, 'Empty image');
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
    done();
  });
});
