var express = require('express');
var app = express();
var exphbs = require('express3-handlebars');
var routes = require('./routes');
var helpers = require('./handlebars_helpers');
var BookshelfStore = require('./bookshelf_session').BookshelfStore;

if (app.get('env') == 'development') {
  console.log(__dirname + '/static');
  app.use( '/static', express.static(__dirname + '/static'));
  app.use( '/fonts', express.static(__dirname + '/fonts'));
}

app.use(express.bodyParser());
app.use(express.cookieParser());
app.engine('handlebars', exphbs({defaultLayout: 'main',
                                 helpers: helpers}));
app.set('view engine', 'handlebars');

app.use(
  express.session({
       secret: '54b20410-6b04-11e2-bcfd-0800200c9a66',
       store: new BookshelfStore()
  })
);

routes.install_routes(app);
var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Listening on", port);
});
