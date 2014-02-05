var http = require('http');
var express = require('express');
var Q = require('q');

var BookshelfStore = require('../bookshelf_session').BookshelfStore;

var port = 12345;

exports.start_server = function() {
  var app = express();
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(
    express.session({
      secret: 'secrets',
      store: new BookshelfStore()
    })
  );
  return [app, app.listen(port)];
};

exports.make_request = function(method, path, data) {
  var length = data ? JSON.stringify(data).length : 0;
  var options = {
    port: port,
    method: method,
    path: path,
    headers: {
      'Cookie': 'connect.sid=abcde',
      'Content-Length': length,
      'Content-Type': 'application/json'
    }
  };
  var def = Q.defer();
  var client_request = http.request(options, function(response_stream) {
    response_stream.on('data', function(data) {
      if (response_stream.statusCode >= 400) {
        var message = 'HTTP ' + response_stream.statusCode + ': ' + data;
        def.reject(new Error(message));
      } else {
        var json_data = JSON.parse(data);
        def.resolve(json_data);
      }
    });
  });

  if(data) {
    client_request.write(JSON.stringify(data));
  }
  client_request.end();

  return def.promise;
};
