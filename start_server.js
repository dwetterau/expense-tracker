var express = require('express');
var routes = require('./routes');
var BookshelfStore = require('./bookshelf_session').BookshelfStore;

module.exports = function(app, port) {
  app.use(function(req, res, next) {
    req.url = routes.rewrite_url(req.url);
    next();
  });

  // One week of caching; don't worry, it uses Etags to check for updated resources
  var cacheTime = 604800000;
  app.use( '/static', express.static(__dirname + '/static', {maxAge: cacheTime}));
  app.use( '/fonts', express.static(__dirname + '/fonts', {maxAge: cacheTime}));
  app.use('/ui', express.static(__dirname + '/ui', {maxAge: cacheTime}));

  app.use(express.bodyParser());
  app.use(express.cookieParser());

  app.use(
    express.session({
      secret: '54b20410-6b04-11e2-bcfd-0800200c9a66',
      store: new BookshelfStore()
    })
  );
  routes.install_routes(app);
  return app.listen(port, function() {
    console.log("Listening on", port);
  });
};
