var fs = require('fs');
var Q = require('q');
var express = require('express');
var auth = require('./auth');
var expenses = require('./expenses');
var Expense = expenses.Expense;
var ExpenseStatus = expenses.ExpenseStatus;

var images = require('./images');
var Image = images.Image;

var users = require('./users');
var User = users.User;

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
  app.get('/', auth.check_auth, function(req, res) {
    var user = new User(req.session.user);
    var unfinished = user.unfinished_expenses();
    var unpaid = user.unpaid_expenses();

    Q.all([unfinished.fetch({withRelated: ['owner', 'participants']}),
           unpaid.fetch({withRelated: ['owner', 'participants']})])
      .then(function() {
        var template_unfinished = unfinished.map(function(x) {
          return expenses.templateify(x, user.get('id'));
        });
        var template_unpaid = unpaid.map(function(x) {
          return expenses.templateify(x, user.get('id'));
        });

        res.render("index", {
          title: "Expense Tracker",
          email: user.get('email'),
          name: user.get('name'),
          unfinished_expenses: template_unfinished,
          unpaid_expenses: template_unpaid,
          logged_in: true
        });

      }).catch(function(err) {
        send_error(res, 'An error occurred while retrieving the expenses: ', err);
      });
  });

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

  // Image routes

  app.get('/images/:id', function(req, res) {
    var image_id = req.params.id;
    var image = new Image({id: image_id});
    image.fetch().then(function(image) {
      res.set('Content-Type', 'image/jpeg');
      res.send(image.get('data'));
    }, function(err) {
      send_error(res, 'An error occurred getting the image: ', err);
    });
  });

  app.get('/thumb/:id/:size', function(req, res) {
    var image_id = req.params.id;
    var size_string = req.params.size;
    images.get_thumbnail(image_id, size_string).then(function(thumbnail) {
      res.set('Content-Type', 'image/jpeg');
      res.send(thumbnail.get('data'));
    }, function(err) {
      send_error(res, 'An error occurred getting the image: ', err);
    });
  });

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
    var image_path = req.files && req.files.image && req.files.image.path;

    if (req.body.participants) {
      var participant_emails = req.body.participants;
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

    var image_store_promise;

    if (image_path) {
      image_store_promise = Q.nfcall(fs.stat, image_path)
        .then(function(file_stats) {
          if (file_stats.size === 0) {
            return undefined;
          } else {
            return images.store_image(image_path);
          }
        })
        .fail(function(err) {
          console.log('ERROR ' + err);
          // If this failed, do not use an image
          return undefined;
        });
    } else {
      image_store_promise = Q(undefined);
    }

    image_store_promise.then(function(image) {
      image && expense.set('image_id', image.get('id'));
      return expense.save();
    }).then(function() {
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

  app.get('/expense/:expense_id', auth.check_auth, function(req, res) {
    var expense_id = req.params.expense_id;
    var user = new User(req.session.user);
    Expense.getWithPermissionCheck(expense_id, user.get('id')).then(function(expense) {
      if (!expense) {
        send_error(res, 'Expense not found ', new Error('Expense not found'));
        return;
      }
      res.render('expense', {title: 'Expense detail',
                             expense: expenses.templateify(expense, user.get('id')),
                             logged_in: true});
    }, function(err) {
      send_error(res, 'An error occurred retrieving the expense: ', err);
    });
  });

  // TODO: this should be a post
  app.get('/expense/:expense_id/pay/:user_id', function(req, res) {
    // Mark the expense as paid for user user_id
    var expense = new Expense({'id': req.params.expense_id});
    var user_id = req.params.user_id;
    var owner_id = req.session.user.id;
    expense.getWithAllParticipants().then(function() {
      expense.mark_paid(owner_id,
                        user_id)
        .then(function() {
          res.redirect('/expense/' + expense.get('id'));
        });
    });
  });

  // TODO: Make this a post also
  app.get('/expense/:expense_id/delete', auth.check_auth, function(req, res) {
    var expense = new Expense({id: req.params.expense_id});
    var user_id = req.session.user.id;
    expense.fetch().then(function() {
      if (expense.get('owner_id') == user_id) {
        return expense.destroy();
      }
    }).then(function() {
      res.redirect('/');
    }, function(err) {
      send_error(res, 'An error occurred while trying to delete the expense: ', err);
    });
  });

  var port = process.env.PORT || 3000;
  app.listen(port, function() {
    console.log("Listening on", port);
  });

  // API type calls
  app.get('/api/expenses', auth.check_auth, function(req, res) {
    var user = new User(req.session.user);
    var owned_expenses = user.owned_expenses();
    var participant_expenses = user.participant_expenses();

    Q.all([owned_expenses.fetch({
      withRelated: ['owner', 'participants']
    }), participant_expenses.fetch({
      withRelated: ['owner', 'participants']
    })]).then(function() {
      console.log(owned_expenses);
      console.log(participant_expenses);
      var owned_json = owned_expenses.invoke('pretty_json');
      var participant_json = participant_expenses.invoke('pretty_json');
      console.log(owned_json);
      console.log(participant_json);

      var data = {
        owned_expenses: owned_json,
        participant_expenses: participant_json,
        user_id: user.id
      };
      res.send(data);
    }).catch(function(err) {
      send_error(res, 'An error occurred retreiving the expenses.', err);
    });
  });

  app.get('/api/expense/:expense_id', auth.check_auth, function(req, res) {
    var user = new User(req.session.user);
    var expense_id = req.params.expense_id;
    Expense.getWithPermissionCheck(expense_id, user.id)
      .then(function(expense) {
        var data = expense.pretty_json();
        res.send(data);
      }).catch(function(err) {
        send_error(res, 'An error occurred retreiving the expense:', err);
      });
  });

  app.get('/api/contacts', auth.check_auth, function(req, res) {
    var user = new User(req.session.user);
    var contacts = user.contacts();
    console.log(contacts);
    contacts.fetch().then(function() {
      res.send(contacts.invoke('pretty_json'));
    });
  });

  // Install ui at /ui (for the time being) with authentication
  app.use('/ui', auth.check_auth);
  app.use('/ui', express.static(__dirname + '/ui'));

};
