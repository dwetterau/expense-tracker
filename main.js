var express = require('express');
//var helenus = require('helenus');
var Client = require('node-cassandra-cql').Client;
var Q = require('q');
var uuid = require('node-uuid');

var app = express();
var cql_client = new Client({hosts: ['localhost:9042'],
                             keyspace: 'expense_tracker',
                             version: '3.0.0',
                             getAConnectionTimeout: 1000});

cql_client.on('log', function(level, message) {
    console.log('log event %s - %j', level, message);
});

cql_client.on('error', function(error) {
    console.error(error);
});

function execute_cql() {
    var cql_args = arguments;
    console.log('args: ', cql_args);
    console.log('Executing');
    return Q.npost(cql_client, 'execute', cql_args);
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

function store_image(image_data, metadata, thumbnails) {
    execute_cql('INSERT INTO images (image_id, image_data, metadata, thumbnails)' +
                ' VALUES (now(), ?, ?, ?)', [image_data, metadata, thumbnails]).then(
                    function(retval) {
                        console.log('done!', retval);
                    }, function(err) {
                        console.error('error: ', err);
                    });
}

function testing() {
    execute_cql('SELECT * FROM images').then(function(result) {
        console.log('result ', result);
        console.log('going');
        console.log('metadata', result.rows[0].get('metadata'));
        console.log('done');
    }, function(err) {
        console.log('there was an error!', err);
    }).fail(function(err) {
        console.log('There was an error printing', err);
    });
}

exports.create_image_table = create_image_table;
exports.store_image = store_image;
exports.testing = testing;
exports.execute = cql_client.execute.bind(cql_client);
