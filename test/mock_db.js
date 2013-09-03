var test_keyspace = 'expense_tracker_test';
var Client = require('node-cassandra-cql').Client;
var cql_client = new Client({hosts: ['localhost:9042'],
  keyspace: test_keyspace,
  version: '3.0.0',
  getAConnectionTimeout: 1000});
var Q = require('q');
var execute_cql = Q.nbind(cql_client.execute, cql_client);

function setup() {
  return execute_cql(
      "CREATE KEYSPACE " + test_keyspace + " " +
      "WITH replication = {'class':'SimpleStrategy', 'replication_factor':1}");
}

function teardown() {
  return execute_cql('DROP KEYSPACE ' + test_keyspace);
}

exports.execute_cql = execute_cql;
exports.setup = setup;
exports.teardown = teardown;