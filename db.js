var Client = require('node-cassandra-cql').Client;
var cql_client = new Client({hosts: ['localhost:9042'],
                             keyspace: 'expense_tracker',
                             version: '3.0.0',
                             getAConnectionTimeout: 1000});
var Q = require('q');

exports.execute_cql = Q.nbind(cql_client.execute, cql_client);
