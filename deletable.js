var db = require('./db');

var Deletable = db.bookshelf.Model.extend({

  sync: function(options) {
    var sync = db.bookshelf.Model.prototype.sync.apply(this, arguments);

    sync.del = function(opts) {
      return sync.update({deleted: true});
    };

    var orig_select = sync.select;

    sync.select = function(opts) {
      this.query.whereNull('deleted');
      return orig_select.apply(this, arguments);
    };

    return sync;
  }

});

exports.Deletable = Deletable;
