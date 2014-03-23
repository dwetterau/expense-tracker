var express = require('express');
var app = express();
var port = process.env.PORT || 3000;
var startServer = require('./start_server');
startServer(app, port);
