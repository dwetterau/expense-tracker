// Base database object
var db = require('./db')();
var Q = require('q');

// A generic database object
var db_obj = {
  get_db_data: function(key_or_index) {
    if (typeof(key_or_index) == 'object') {
      for (var index_name in key_or_index) {
        // Only do this once
        return db.get_by_key(this.columnfamily_name,
                             index_name, key_or_index[index_name]);
      }
    } else {
      // Primary key
      return db.get_by_key(this.columnfamily_name,
                           this.primary_key_name,
                           key_or_index);
    }
  },

  user_to_db: function(data) {
    // This translates user formated data to db data
    // returns a promise that is fulfilled with the relevent data
    // Overridden by subclasses
    return Q(data);
  },

  db_to_user: function(data) {
    // This translates db formated data to user data
    // overridden by subclasses
    return Q(data);
  },

  get: function(key_or_index) {
    return this.get_db_data(key_or_index).then(function(data) {
      return this.db_to_user(data);
    }.bind(this));
  },

  create: function(data) {
    // Convert data, then insert if not exists
    return this.user_to_db(data).then(function(db_data) {
    // We want to insert if not exists:
      return db.insert(this.columnfamily_name, db_data, 'IF NOT EXISTS');
    }.bind(this));
  },

  update: function(data) {
    return this.user_to_db(data)
      .then(function(db_data) {
        // We want to insert regardless of existence:
        return db.insert(this.columnfamily_name, db_data);
      }.bind(this));
  }
};

exports.db_type = function() {};
exports.db_type.prototype = db_obj;

// A mixin for deletable database objects
exports.deletable = function() {
  this.delete = function(key) {
    var update_obj = { 'deleted' : 1 };
    update_obj[this.primary_key_name] = key;
    return this.update(update_obj);
  };

  this.get_db_data =  function() {
    Object.getPrototypeOf(this).get_db_data.apply(arguments)
    .then(function(db_data) {
      if (db_data.rows[0].get('deleted')) {
        return undefined;
      } else {
        return db_data;
      }
    });
  };
};
