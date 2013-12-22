var db = require('./db');
var knex = db.bookshelf.knex;
var Q = require('q');

// TODO: add foreign key constraints

exports.create_users = function() {
  return knex.schema.createTable('users', function(table) {
    table.string('email').index().unique();
    table.text('password');
    table.text('salt');
    table.string('name');
    table.increments('id');
    table.timestamps();
  });
};

exports.create_expenses = function() {
  return knex.schema.createTable('expenses', function(table) {
    table.increments('id');
    table.integer('owner_id').index().notNullable();
    table.text('title').notNullable();
    table.text('description');
    table.integer('value').notNullable();
    table.integer('image_id');
    table.timestamps();
  });
};

exports.create_expense_status = function() {
  return knex.schema.createTable('expense_status', function(table) {
    table.increments('id');
    table.integer('user_id').notNullable();
    table.integer('expense_id').notNullable();
    table.integer('status').notNullable();
  }).then(function() {
    // Can't create this index using knex directly
    return knex.raw('CREATE UNIQUE INDEX UIX_expense_status ' +
                    'on expense_status (user_id, expense_id)');
  });
};

exports.create_images = function() {
  return knex.schema.createTable('images', function(table) {
    table.increments('id');
    table.binary('data').notNullable();
    table.integer('thumbnail_of');
    table.string('size');
    table.timestamps();
  }).then(function() {
    // Can't create this index using knex directly
    return knex.raw('CREATE UNIQUE INDEX UIX_thumbnails ' +
                    'on images (thumbnail_of, size)');
  });
};

exports.create_sessions = function() {
  return knex.schema.createTable('sessions', function(table) {
    table.string('sid').primary();
    table.text('sess');
  });
};

exports.add_all = function() {
  return Q.all([
    exports.create_users(),
    exports.create_expenses(),
    exports.create_expense_status(),
    exports.create_images(),
    exports.create_sessions()
  ]);
};



/*
var Q = require('q');

// TODO: get keyspace name from db
function get_schema(table_name) {
  return db.execute_cql('SELECT * from system.schema_columns ' +
                        'where keyspace_name=? and columnfamily_name=?',
                        [db.keyspace, table_name]);
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

function alter_table_drop(table_name, column_name) {
  return db.execute_cql('ALTER TABLE ' + table_name +
                        ' DROP ' + column_name);
}

function migrate_to_schema(schema) {
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

      // Check for old columns
      for (var present_column in present_columns) {
        // Drop old columns that are no longer needed
        if (!needed_columns.hasOwnProperty(present_column)) {
          console.log('Dropping column ' + present_column);
          all_changes.push(alter_table_drop(name, present_column));
        }
      }

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
    owner: 'uuid',
    deleted: 'int'
  }};

var expense_status_schema = {
  name: 'expense_status',
  columns: {
    user_id: 'uuid',
    expense_id: 'uuid',
    status: 'int',
    deleted: 'int'
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
    name: 'text',
    deleted: 'int'
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
*/
