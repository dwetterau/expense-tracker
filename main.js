var express = require('express');
var app = express();
var exphbs = require('express3-handlebars');
var helenus = require('helenus');
var CassandraStore = require('connect-cassandra')(express);
var routes = require('./routes');

var pool = new helenus.ConnectionPool({
    hosts : ['localhost:9160'],
    keyspace : 'expense_tracker',
    timeout : 3000
});

app.use(express.bodyParser());
app.use(express.cookieParser());
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

pool.connect(function(e) {
  if (e) {
    console.error('Error connecting helenus: ', e);
  }
  app.use(
    express.session({
      secret: '54b20410-6b04-11e2-bcfd-0800200c9a66',
      store: new CassandraStore({pool: pool})
    })
  );
  routes.install_routes(app);
});
