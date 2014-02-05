var db = require('./db');
var Q = require('q');

var email_types = {
  NEW_EXPENSE_NOTIFICATION: 1,
  RESET_PASSWORD: 2
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
});

var Emails = db.bookshelf.Collection.extend({
  tableName: 'emails',

  model: Email,

  get_unsent_emails: function() {
    return this.query(function(qb) {
        qb.where({sent: false});
    }).fetch();
  }
});

exports.Email = Email;
exports.Emails = Emails;
exports.email_types = email_types;
