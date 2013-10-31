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
      if (data && data.rows && data.rows.length) {
        return this.db_to_user(data);
      } else {
        return undefined;
      }
    }.bind(this));
  },

  modify: function(data, not_exists) {
    var condition = not_exists ? 'IF NOT EXISTS' : undefined;
    // Convert data, then insert with condition
    return this.user_to_db(data).then(function(db_data) {
      return db.insert(this.columnfamily_name, db_data, condition);
    }.bind(this));
  },

  create: function(data) {
    // modify with not exists
    return this.modify(data, this.create_check);
  },

  update: function(data) {
    // modify without not exists
    return this.modify(data, false);
  }
};

exports.db_type = function() {};
exports.db_type.prototype = db_obj;

// A mixin for deletable database objects
exports.deletable = function(type) {
  type.delete = function(key_or_index) {
    var update_obj;
    if (typeof(key_or_index) == 'object') {
      update_obj = key_or_index;
    } else {
      update_obj = {};
      update_obj[type.primary_key_name] = key_or_index;
    }
    update_obj.deleted = 1;
    return type.update(update_obj);
  };

  type.get_db_data = function() {
    return Object.getPrototypeOf(this).get_db_data.apply(this, arguments)
    .then(function(db_data) {
      if (!db_data || !db_data.rows[0]) {
        return db_data;
      }
      if (db_data.rows[0].get('deleted')) {
        return undefined;
      } else {
        return db_data;
      }
    });
  };
};
