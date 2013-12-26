var auth = require('./auth');
var db = require('./db');
var uuid = require('node-uuid');
var Q = require('q');

var email_types = {
  NEW_EXPENSE_NOTIFICATION: 1
};

var Email = db.bookshelf.Model.extend({
  tableName: 'emails',

  hasTimestamps: ['created_at', 'updated_at'],

  mark_sent: function() {
    var deferred = Q.defer();
    if (this.get('sent')) {
      deferred.reject(new Error('Email already sent'));
      return deferred.promise;
    }
    this.set('sent', true);
    return this.save();
  }

}, {

//  get_unsent_emails: function() {
//    var sent_emails = new Email({sent: false});
//    return sent_emails.hasMany(Email, )
//    .get_db_data({'sent' : false})
//      .then(function(db_data) {
//        var email_objs = [];
//        while(db_data.rows.length > 0) {
//          var email_obj = emails.db_to_user({rows: db_data.rows.splice(0, 1)});
//          email_objs.push(email_obj);
//        }
//        return Q.all(email_objs);
//    });
//  }
});



exports.Email = Email;
exports.email_types = email_types;
