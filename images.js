var Q = require('q');
var gm = require('gm');
var thumbnail_sizes = ['800x600', '640x480', '320x240'];
var db = require('./db');
var fs = require('fs');

var Image = db.bookshelf.Model.extend({
  tableName: 'images',

  thumbnails: function() {
    return this.hasMany(Image, 'thumbnail_of');
  },

  get_thumbnail: function(size) {
    return this.thumbnails().query(function(qb) {
      qb.where('size', '=', size);
    }).fetch()
      .then(function(result) {
      if(result.length != 1) {
        throw new Error('Found zero or more than one thumbnail for image');
      }
      return result.at(0);
    });
  },

  hasTimestamps: ['created_at', 'updated_at']
});

// Resize image at image path to all sizes in size_strings
// Returns a promise, fulfilled with array of thumbnail datas.
function resize_image(image_path, size_strings) {
  var promises = size_strings.map(function(size_string) {
    var size = size_string.split('x');
    var resized = gm(image_path).resize(size[0], size[1]);
    return Q.ninvoke(
      resized, "toBuffer"
    );
  });
  return Q.all(promises);
}

function store_image(image_path) {

  var image = new Image({});

  var image_p = Q.nfcall(fs.readFile, image_path).then(function(image_data) {
    image.set('data', image_data);
    return image.save();
  }).fail(function(err) {
    console.error('Could not save image: ', err);
  });

  // Resize and store thumbnails
  var resize_p = resize_image(image_path, thumbnail_sizes);

  return Q.all([image_p, resize_p]).then(function(results) {
    var thumbnails_data = results[1];

    thumbnails_store_p = thumbnails_data.map(function(thumbnail_data, i) {
      var thumb = new Image({data: thumbnail_data,
                             thumbnail_of: image.get('id'),
                             size: thumbnail_sizes[i]
                            });
      return thumb.save();
    });
    return Q.all(thumbnails_store_p).then(function() {
      return image;
    });
  });
}

function get_thumbnail(image_id, size_string) {
  var base_image = new Image({id: image_id});
  return base_image.get_thumbnail(size_string);
}

exports.Image = Image;
exports.store_image = store_image;
exports.get_thumbnail = get_thumbnail;
