var db = require('./db');
var connect = require('connect');

var Session = db.bookshelf.Model.extend({
  tableName: 'sessions',
  idAttribute: 'sid'
});

var BookshelfStore = function () {
};

BookshelfStore.prototype = Object.create(new connect.session.Store());

BookshelfStore.prototype.set = function(sid, sess, callback) {
  var s = new Session({sid: sid,
                       sess: JSON.stringify(sess)
                      });
  var method = sess._existingSession ? 'update' : 'insert';
  s.save(null, {method: method}).then(function() {
    callback();
  }, function(err) {
    callback(err);
  });
};

BookshelfStore.prototype.get = function(sid, callback) {
  var s = new Session({sid: sid});
  s.fetch().then(function() {
    if(!s.get('sess')) {
      callback();
      return;
    }

    var session = JSON.parse(s.get('sess'));
    session._existingSession = true;
    callback(null, session);
  }, function(err) {
    callback(err);
  });
};

BookshelfStore.prototype.destroy = function(sid, callback) {
  var s = new Session({sid: sid});
  s.destroy().then(function() {
    callback();
  }, function(err) {
    callback(err);
  });
};

exports.BookshelfStore = BookshelfStore;
exports.Session = Session;
