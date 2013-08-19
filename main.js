var express = require('express');
var helenus = require('helenus');
var Q = require('q');
var uuid = require('node-uuid');

var app = express();
var pool = new helenus.ConnectionPool({
    hosts: ['localhost:9160'],
    keyspace: 'expense_tracker',
    cqlVersion : '3.0.0'
});

pool.on('error', function(err) {
    console.error(err.name, err.message);
});

// Connect to the database
var connection_done = Q.nfcall(pool.connect.bind(pool))
    .fail(function(err) {
        console.error('Error connecting to db', err);
    });

function execute_cql() {
    var cql_args = arguments;
    console.log('args: ', cql_args);
    return connection_done.then(function() {
        console.log('Executing');
        return Q.npost(pool, 'cql', cql_args);
    });
}

function create_image_table() {
    execute_cql('CREATE TABLE images ( image_id timeuuid PRIMARY KEY,' +
                'image_data blob,' +
                'thumbnails map<text, blob>,' +
                'metadata map<text, blob>)').then(function() {
                    console.log('successful');
                }, function(err) {
                    console.error('not successful', err);
                });
}

exports.create_image_table = create_image_table;
