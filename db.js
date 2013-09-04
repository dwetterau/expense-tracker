var Client = require('node-cassandra-cql').Client;
var cql_client = new Client({
  hosts: ['localhost:9042'],
  keyspace: 'expense_tracker',
  version: '3.0.0',
  getAConnectionTimeout: 1000
});
var Q = require('q');
var execute_cql = Q.nbind(cql_client.execute, cql_client);

var test_keyspace = 'expense_tracker_test';

function setup() {
  // Try to create the keyspace for the tests
  return execute_cql(
    "CREATE KEYSPACE " + test_keyspace + " " +
      "WITH replication = {'class':'SimpleStrategy', 'replication_factor':1}").then(function(result) {
      return result;
    }, function(err) {
      if (err.message.indexOf('Cannot add existing keyspace') != -1) {
        return undefined;
      }
      return err;
    });
}

function set_client_testing() {
  cql_client = new Client({hosts: ['localhost:9042'],
    keyspace: test_keyspace,
    version: '3.0.0',
    getAConnectionTimeout: 1000});
  execute_cql = Q.nbind(cql_client.execute, cql_client);
  // Reset exports
  exports.cql_client = cql_client;
  exports.execute_cql = execute_cql;
}

exports.execute_cql = execute_cql;
exports.set_client_testing = set_client_testing;
exports.setup = setup;