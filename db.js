var Client = require('node-cassandra-cql').Client;
var default_keyspace = 'expense_tracker';
var testing_keyspace = 'expense_tracker_test';

module.exports = function(keyspace_name) {
  if (keyspace_name == 'default' || keyspace_name === undefined) {
    keyspace_name = process.env.NODE_ENV == 'testing' ? testing_keyspace : default_keyspace;
  }

  var cql_client = new Client({
    hosts: ['localhost:9042'],
    keyspace: keyspace_name,
    version: '3.0.0',
    getAConnectionTimeout: 1000
  });
  var Q = require('q');
  var execute_cql = Q.nbind(cql_client.execute, cql_client);

  function setup() {
    // Try to create the keyspace
    return execute_cql(
      "CREATE KEYSPACE " + keyspace_name + " " +
        "WITH replication = {'class':'SimpleStrategy', 'replication_factor':1}").then(function(result) {
          return result;
        }, function(err) {
          if (err.message.indexOf('Cannot add existing keyspace') != -1) {
            return;
          }
          return err;
        });
  }

  function extract_data(data) {
    var keys = [];
    var values = [];
    for (var key in data) {
      if (!data.hasOwnProperty(key)) {
        continue;
      }
      keys.push(key);
      values.push(data[key]);
    }
    return [keys, values];
  }

  function insert(columnfamily_name, data, if_cond) {
    var extracted_data = extract_data(data);
    var keys = extracted_data[0];
    var values = extracted_data[1];

    var question_marks = keys.map(function() {
      return '?';
    }).join(', ');

    // If if_ne is specified, we need to append it (with a space) to our insert
    var if_cond_append = '';
    if (if_cond) {
      if_cond_append = ' ' + if_cond;
    }

    return execute_cql('INSERT INTO ' + columnfamily_name + ' (' +
                       keys.join(', ') + ') ' +
                       'VALUES (' + question_marks + ')' + if_cond_append,
                       values);
  }

  function update(columnfamily_name, data, pk_names, if_cond) {
    var pk_values = [];
    pk_names.forEach(function(pk_name) {
      pk_values.push(data[pk_name]);
      delete data[pk_name];
    });

    var where_part = pk_names.map(function(pk_name) {
      return pk_name + '=?';
    }).join(' AND ');

    var extracted_data = extract_data(data);
    var keys = extracted_data[0];
    var values = extracted_data[1];
    values = values.concat(pk_values);

    var set_statement = keys.map(function(key) {
      return key + '=?';
    }).join(', ');

    // If if_ne is specified, we need to append it (with a space) to our insert
    var if_cond_append = '';
    if (if_cond) {
      if_cond_append = ' ' + if_cond;
    }

    return execute_cql('UPDATE ' + columnfamily_name + ' SET ' +
                       set_statement + ' WHERE ' + where_part,
                       values);
  }

  // Get by primary key value
  function get_by_key(columnfamily_name, key_name, key_value) {
    return execute_cql('SELECT * FROM ' + columnfamily_name + ' WHERE ' +
                       key_name + '=?', [key_value]);
  }

  return {
    execute_cql: execute_cql,
    setup: setup,
    keyspace: keyspace_name,
    insert: insert,
    update: update,
    get_by_key: get_by_key
  };
};
