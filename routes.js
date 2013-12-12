var fs = require('fs');
var Q = require('q');
var auth = require('./auth');
var expenses = require('./expenses');
var Expense = expenses.Expense;
var ExpenseStatus = expenses.ExpenseStatus;

//var images = require('./images');
var users = require('./users');
var User = users.User;
//var uuid = require('node-uuid');

// Error sending
function send_error(res, info, exception) {
  console.error('error:', info + exception);
  console.error('stack:', exception.stack);
  console.log(info + exception);
  res.render('error',
             { title: 'An error occured',
               info: info + exception},
             function(err, response) {
               res.send(500, response);
             });
}

exports.install_routes = function(app) {
  // Main route
  /*app.get('/', auth.check_auth, function(req, res) {
    var user_id = req.session.user_id;
    expenses.get_user_expenses(user_id).then(function(expense_templates) {
      res.render("index", {
        title: "Expense Tracker",
        email: req.session.email,
        name: req.session.name,
        owned_unfinished_expenses: expense_templates.owned_unfinished,
        unfinished_expenses: expense_templates.unfinished,
        other_expenses: expense_templates.other,
        logged_in: true
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
    users.get_user(user_id).then(function(user) {
      res.render('user', { logged_in: true,
                           title: user.get('email'),
                           email: user.get('email')});
    }, function(err) {
      send_error(res, 'An error occurred while retrieving the user: ', err);
    });
  });

  */
  app.post('/login', function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    users.User.login(email, password).then(function(user) {
      req.session.user = user;
      res.redirect('/');
    }, function(err) {
      send_error(res, 'Login error: ', err);
    });
  });

  app.get('/login', function(req, res) {
    res.render('login');
  });

  app.post('/logout', function(req, res) {
    Q.ninvoke(req.session, 'destroy').then(function() {
      res.redirect('/login');
    });
  });

  app.get('/logout', auth.check_auth, function(req, res) {
    res.render('logout', { logged_in: true });
  });

  app.post('/create_account', function(req, res) {
    var secret = req.body.secret;
    if (secret != '0xDEADBEEFCAFE') {
      console.log('oh dear!');
      return;
    }
    var email = req.body.email;
    var password = req.body.password;
    var name = req.body.name;
    var new_user = new users.User({
      email: email,
      password: password,
      name: name
    });
    Q.ninvoke(req.session, 'regenerate').then(function() {
      return new_user.salt_and_hash();
    }).then(function() {
      return new_user.save();
    }).then(function() {
      req.session.user = new_user;
      res.redirect('/');
    }, function(err) {
      send_error(res, 'An error occurred while creating the account: ', err);
    });
  });

  app.get('/create_account', function(req, res) {
    res.render('create_account');
  });

  /*
  // Image routes

  app.get('/images/:uuid', function(req, res) {
    var image_id = req.params.uuid;
    images.images.get(image_id).then(function(image) {
      res.set('Content-Type', 'image/jpeg');
      res.send(image.image_data);
    }, function(err) {
      send_error(res, 'An error occurred getting the image: ', err);
    });
  });

  app.get('/thumb/:uuid/:size', function(req, res) {
    var image_id = req.params.uuid;
    var size_string = req.params.size;
    images.get_thumbnail(image_id, size_string).then(function(thumbnail) {
      res.set('Content-Type', 'image/jpeg');
      res.send(thumbnail.image_data);
    }, function(err) {
      send_error(res, 'An error occurred getting the image: ', err);
    });
  });

  app.post('/upload_image', auth.check_auth, function(req, res) {
    // Not happy about reading it from the disk
    var path = req.files.image.path;
    return images.store_image(path)
    .then(function(image_id) {
      res.redirect('/images/' + image_id);
    }, function(err) {
      send_error(res, 'An error occurred uploading the image: ', err);
    });
  });

  app.get('/upload_image', auth.check_auth, function(req, res) {
    res.render('upload_image');
  });
  */

  // Expenses routes
  app.get('/create_expense', auth.check_auth, function(req, res) {
    res.render('create_expense', {title: 'Create new expense', logged_in: true});
  });

  app.post('/create_expense', auth.check_auth, function(req, res) {
    var title = req.body.title;
    var description = req.body.description || undefined;
    var value = parseInt(req.body.value, 10);
    var owner = req.session.user;
    var participants = [];
    var image_path = req.files.image && req.files.image.path;

    if (req.body.participants) {
      var participant_emails = req.body.participants.split(',');
      participants = participant_emails.map(function(email) {
        return new User({email: email});
      });
    }

    var fetch_user_promises = participants.map(function(participant) {
      return participant.fetch();
    });

    var expense = new Expense({
      owner_id: owner.id,
      title: title,
      description: description,
      value: value,
    });

    expense.save().then(function() {
      var status_promises = fetch_user_promises.map(function(fetch_user_promise, i) {
        fetch_user_promise.then(function() {
          var participant = participants[i];
          var new_status = new ExpenseStatus({
            user_id: participant.get('id'),
            expense_id: expense.get('id'),
            status: expenses.expense_states.WAITING
          });
          return new_status.save();
        });
      });

      return Q.all(status_promises);
    }).then(function() {
      res.redirect('/expense/' + expense.get('id'));
    }, function(err) {
      send_error(res, 'An error occurred making the expense: ', err);
    });

  });


    /*var image_store_promise = Q.nfcall(fs.stat, image_path)
      .then(function(file_stats) {
        if (file_stats.size === 0) {
          return undefined;
        } else {
          return images.store_image(image_path);
        }
      })
    .fail(function() {
      // If this failed, do not use an image
      return undefined;
    });
    var promises = get_user_promises.concat([image_store_promise]);

    Q.all(promises).then(function(values) {
      var image_id = values[values.length - 1];
      var owner = values[0];
      var participants = values.slice(0, values.length - 1);
      // Every user aside from the owner is waiting
      var waiting = values.slice(1, values.length - 1);
      return expenses.expenses.create(
        { expense_id: expense_id,
          value: value,
          participants: participants,
          title: title,
          description: description,
          receipt_image: image_id,
          owner: owner,
          waiting: waiting,
          paid: []
        });
    }).then(function() {
        res.redirect('/expense/' + expense_id);
      }, function(err) {
        send_error(res, 'An error occurred making the expense: ', err);
      });
  });*/

/*

  app.get('/expense/:expense_id', auth.check_auth, function(req, res) {
    var expense_id = req.params.expense_id;
    expenses.get_expense(expense_id, req.session.user_id).then(function(expense) {
      if (!expense) {
        send_error(res, 'Expense not found ', new Error('Expense not found'));
        return;
      }
      res.render('expense', {title: 'Expense detail', expense: expense, logged_in: true});
    }, function(err) {
      send_error(res, 'An error occurred retrieving the expense: ', err);
    });
  });

  // TODO: this should be a post
  app.get('/expense/:expense_id/pay/:user_id', function(req, res) {
    // Mark the expense as paid for user user_id
    var expense_id = req.params.expense_id;
    var user_id = req.params.user_id;
    var owner_id = req.session.user_id;
    expenses.mark_paid(expense_id,
                       owner_id,
                       user_id)
      .then(function() {
        res.redirect('/expense/' + expense_id);
      });
  });

  // TODO: Make this a post also
  app.get('/expense/:expense_id/delete', auth.check_auth, function(req, res) {
    var expense_id = req.params.expense_id;
    var user_id = req.session.user_id;
    expenses.lazy_delete_expense(expense_id, user_id).then(function() {
      res.redirect('/');
    }, function(err) {
      send_error(res, 'An error occurred while trying to lazy delete the expense: ', err);
    });
  });
  */

  var port = process.env.PORT || 3000;
  app.listen(port, function() {
    console.log("Listening on", port);
  });

};
