var db = require('./db');
var Q = require('q');

function get_schema(table_name) {
  return db.execute_cql('SELECT * from system.schema_columns ' +
                        'where keyspace_name=? and columnfamily_name=?',
                        ['expense_tracker', table_name]);
}

function create_new_table(schema) {
  var statement = [
    'CREATE TABLE',
    schema.name,
    '('
  ];
  var columns = schema.columns;
  for (var column in columns) {
    var column_statement = column + ' ' + columns[column] + ',';
    statement.push(column_statement);
  }
  if (schema.extra) {
    statement.push(schema.extra);
  }
  statement.push(')');
  console.log(statement.join(' '));
  return db.execute_cql(statement.join(' '))
    .then(function() {
      var index = schema.index;
      if (index) {
        return db.execute_cql('CREATE INDEX ' + index.name + ' ON ' + index.target);
      }
    });
}

function drop_table(schema) {
  var statement = 'DROP TABLE ' + schema.name;
  console.log(statement);
  return db.execute_cql(statement);
}

function alter_table_add(table_name, column_name, column_type) {
  return db.execute_cql('ALTER TABLE ' + table_name +
                        ' ADD ' + column_name + ' ' + column_type);
}

function migrate_to_schema(schema) {
  // CAVEAT EMPTOR: because of how cassandra works, this only adds columns, and does not drop columns or
  // modify types or something of that nature.
  var name = schema.name;
  return get_schema(name)
    .then(function(results) {
      if (results.rows.length === 0) {
        return create_new_table(schema);
      }

      var present_columns = {};
      results.rows.forEach(function(row) {
        present_columns[row.get('column_name')] = 1;
      });

      var all_changes = [];

      var needed_columns = schema.columns;
      // Check for new added columns
      for (var column in needed_columns) {
        // don't consider primary key
        // it can't really be changed
        // TODO: check if the extra field defines a primary key
        if (needed_columns[column].toUpperCase().indexOf('PRIMARY KEY') != -1) {
          continue;
        }
        if (present_columns[column]) {
          // TODO - check the type and things
          delete present_columns[column];
        } else {
          console.log('adding column ', column, needed_columns[column]);
          all_changes.push(alter_table_add(name, column, needed_columns[column]));
        }
      }

      return Q.all(all_changes);
    });
}

var images_schema = {
  name: 'images',
  columns: {
    image_id: 'uuid PRIMARY KEY',
    image_data: 'blob',
    metadata: 'map<text, text>',
    thumbnails: 'map<text, uuid>'
  }
};

var thumbnails_schema = {
  name: 'thumbnails',
  columns: {
    thumbnail_id: 'uuid PRIMARY KEY',
    image_data: 'blob',
    orig_image: 'uuid'
  }
};

var expenses_schema = {
  name: 'expenses',
  columns: {
    expense_id: 'uuid PRIMARY KEY',
    title: 'text',
    description: 'text',
    value: 'int',
    participants: 'map<uuid, int>',
    receipt_image: 'uuid',
    owner: 'uuid'
  }};

var expense_status_schema = {
  name: 'expense_status',
  columns: {
    user_id: 'uuid',
    expense_id: 'uuid',
    status: 'int'
  },
  extra: 'PRIMARY KEY (user_id, expense_id)'
};

var users_schema = {
  name: 'users',
  columns: {
    email: 'text PRIMARY KEY',
    password: 'text',
    salt: 'text',
    user_id: 'uuid',
    name: 'text'
  },
  index: {
    name: 'users_user_id',
    target: 'users (user_id)'
  }
};

var schemas = {
  images: images_schema,
  thumbnails: thumbnails_schema,
  expenses: expenses_schema,
  expense_status: expense_status_schema,
  users: users_schema
};

exports.install_all = function() {
  var promises = [];
  for (var key in schemas) {
    if (schemas.hasOwnProperty(key)) {
      promises.push(migrate_to_schema(schemas[key]));
    }
  }
  return Q.all(promises);
};

exports.drop_all = function() {
  var promises = [];
  for (var key in schemas) {
    if (schemas.hasOwnProperty(key)) {
      promises.push(drop_table(schemas[key]));
    }
  }
  return Q.all(promises);
};

exports.create_new_table = create_new_table;
exports.schemas = schemas;
