var bookshelf = require('bookshelf');
var settings = require('./settings');


var bookshelf = bookshelf.initialize({
  client: settings.database_client,
  connection: settings.database_connection,
  debug: settings.debug
});

module.exports = {
  bookshelf: bookshelf
};

settings.after_init && settings.after_init();
