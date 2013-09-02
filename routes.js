var fs = require('fs');
var Q = require('q');
var auth = require('./auth');
var expenses = require('./expenses');
var images = require('./images');
var users = require('./users');

// Error sending
function send_error(res, info, exception) {
  console.error('error:', info + exception);
  console.error('stack:', exception.stack);
  res.render('error',
             { title: 'An error occured',
               info: info},
             function(err, response) {
               res.send(500, response);
             });
}

exports.install_routes = function(app) {
  // Main route
  app.get('/', auth.check_auth, function(req, res) {
    var user_id = req.session.user_id;
    expenses.get_user_expenses(user_id).then(function (expense_templates) {
      res.render("index", {
        title: "Expense Tracker", //TODO: Move this to the template somewhere
        email: req.session.email,
        expense_templates: expense_templates
      });
    }, function(err) {
      send_error(res, 'An error occurred while retrieving the expenses: ', err);
    });
  });

  // User routes
  app.get('/user/:id', auth.check_auth, function(req, res) {
    var user_id = req.params.id;
    if (user_id == 'me') {
      user_id = req.session.user_id;
      res.redirect('/user/' + user_id);
      return;
    }
    users.get_user(user_id).then(function(data) {
      res.render('user', { title: data, email: data});
    }, function(err) {
      send_error(res, 'An error occurred while retrieving the user: ', err);
    });
  });

  app.post('/login', function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    users.login({email: email, password: password}).then(function(user_id) {
      req.session.user_id = user_id;
      req.session.email = email;
      res.redirect('/user/' + user_id);
    }, function(err) {
      send_error(res, 'Login error: ',err);
    });
  });

  app.get('/login', function(req, res) {
    res.render('login');
  });

  app.post('/logout', function(req, res) {
    delete req.session.user_id;
    res.redirect('/login');
  });

  app.get('/logout', auth.check_auth, function(req, res) {
    res.render('logout');
  });

  app.post('/create_account', function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var new_user = {
      email: email,
      password: password
    };
    users.create_user(new_user).then(function() {
      users.login({email: email, password: password}).then(function(user_id) {
        res.redirect('/user/' + user_id);
      });
    }, function(err) {
      send_error(res, 'An error occurred while creating the account: ', err);
    });
  });

  app.get('/create_account', function(req, res) {
    res.render('create_account');
  });

  // Image routes

  app.get('/images/:uuid', function(req, res) {
    var image_id = req.params.uuid;
    images.get_image(image_id).then(function(image_data) {
      res.set('Content-Type', 'image/jpeg');
      res.send(image_data);
    }, function(err) {
      send_error(res, 'An error occurred getting the image: ', err);
    });
  });

  app.get('/thumb/:uuid/:size', function(req, res) {
    var image_id = req.params.uuid;
    var size_string = req.params.size;
    images.get_thumbnail(image_id, size_string).then(function(image_data) {
      res.set('Content-Type', 'image/jpeg');
      res.send(image_data);
    }, function(err) {
      send_error(res, 'An error occurred getting the image: ', err);
    });
  });

  app.post('/upload_image', auth.check_auth, function(req, res) {
    // Not happy about reading it from the disk
    var path = req.files.image.path;
    Q.nfcall(fs.readFile, path).then(function(data) {
      return images.store_image(data);
    }).then(function(image_id) {
      res.redirect('/images/' + image_id);
    }, function(err) {
      send_error(res, 'An error occurred uploading the image: ', err);
    });
  });

  app.get('/upload_image', auth.check_auth, function(req, res) {
    res.render('upload_image');
  });

  // Expenses routes
  app.get('/create_expense', auth.check_auth, function(req, res) {
    res.render('create_expense');
  });

  app.post('/create_expense', auth.check_auth, function(req, res) {
    var title = req.body.title;
    var description = req.body.description || undefined;
    var value = req.body.value;
    var participants = [req.session.email];
    var image_path = req.files.image && req.files.image.path;
    var store_image_done = Q.defer();
    if (req.body.participants) {
      participants = participants.concat(req.body.participants.split(','));
    }
    if (!image_path) {
      store_image_done.resolve(undefined);
    } else {
      Q.nfcall(fs.readFile, image_path).then(function(image_data) {
        return images.store_image(image_data);
      }).then(function(image_id) {
        store_image_done.resolve(image_id);
      }, function(err) {
        console.err('Store image failed:', err);
        store_image_done.resolve(undefined);
      });
    }
    store_image_done.promise.then(function(image_id) {
      return expenses.store_expense(
        { value: value,
          participants: participants,
          title: title,
          description: description,
          receipt_image: image_id
        });
    }).then(function(expense_id) {
        res.redirect('/expense/' + expense_id);
      }, function(err) {
        console.log(err.stack);
        send_error(res, 'An error occurred making the expense: ', err);
      });
  });

  app.get('/expense/:expense_id', auth.check_auth, function(req, res) {
    // TODO: make sure you are involved in the expense to see it?
    var expense_id = req.params.expense_id;
    expenses.get_expense(expense_id).then(function(expense) {
      res.render('expense', {title: 'Expense detail', expense: expense});
    }, function(err) {
      send_error(res, 'An error occurred retrieving the expense: ', err);
    });
  });

  app.post('/expense/:expense_id/pay', function(req, res) {
    var expense_id = req.params.expense_id;
    var user_id = req.session.user_id;
    expenses.update_status(expense_id,
                           user_id,
                           expenses.states.PAID)
      .then(function() {
        res.redirect('/expense/' + expense_id);
      });
  });

  var port = process.env.PORT || 3000;
  app.listen(port, function() {
    console.log("Listening on", port);
  });
};