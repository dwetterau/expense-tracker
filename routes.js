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
function send_error(res, error) {
  // TODO: I hate this
  try {
    var message = JSON.parse(error.message).pretty;
  } catch (e) {
    message = "An error occurred";
  }
  res.send(500, {status: 'error',
                 err: message});
}

/**
 * This is to distinguish between error messages we make and error messages generated
 * from things like postgres.
 * @param message
 * @returns {Error}
 */
function pretty_error(message) {
  console.log(message);
  return new Error(JSON.stringify({
      pretty: message
  }));
}

function rewrite_url(url) {
  var valid_prefixes = ['/ui', '/api', '/images', '/thumb'];
  if (valid_prefixes.some(function(element) {
      return url.substr(0, element.length) == element;
  })) {
    return url;
  }
  // This rewrite allows angular to do its magic and redirect to the correct part of the app
  return '/ui/index.html';
}

exports.install_routes = function(app) {
  app.use(function(req, res, next) {
    req.url = rewrite_url(req.url);
    next();
  });

  // Main route
  app.get('/', express.static(__dirname + '/ui'));

  app.get('/login', function(req, res) {
    var next = req.query.next;
    res.render('login', {next: next});
  });

  app.post('api/logout', function(req, res) {
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

  // API type calls
  app.post('/api/login', function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    users.User.login(email, password).then(function(user) {
      req.session.user = user;
      res.send({status: 'ok'});
    }, function() {
      send_error(res, pretty_error('Invalid username or password'));
    });
  });

  app.post('/api/logout', auth.check_auth, function(req, res) {
    Q.ninvoke(req.session, 'destroy').then(function() {
      res.send({status: 'ok'});
    });
  });

  app.post('/api/create_account', function(req, res) {
    var secret = req.body.secret;
    if (secret != '0xDEADBEEFCAFE') {
      console.log('oh dear!');
      res.send(401);
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
      res.send({status: 'ok'});
    }, function(err) {
      res.send(500, {
        status: 'error',
        err: 'Incorrect username or password.'});
    });
  });

  app.get('/api/expenses', auth.check_auth, function(req, res) {
    var user = new User(req.session.user);
    var owned_expenses = user.owned_expenses();
    var participant_expenses = user.participant_expenses();

    Q.all([owned_expenses.fetch({
      withRelated: ['owner', 'participants']
    }), participant_expenses.fetch({
      withRelated: ['owner', 'participants']
    })]).then(function() {
      var owned_json = owned_expenses.invoke('pretty_json');
      var participant_json = participant_expenses.invoke('pretty_json');

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
        // TODO - more elegant solution for this.
        data.user_id = user.id;
        res.send(data);
      }).catch(function(err) {
        send_error(res, 'An error occurred retreiving the expense:', err);
      });
  });

  app.get('/api/contacts', auth.check_auth, function(req, res) {
    var user = new User(req.session.user);
    var contacts = user.contacts();
    contacts.fetch().then(function() {
      res.send(contacts.invoke('pretty_json'));
    });
  });

  app.post('/api/create_expense', auth.check_auth, function(req, res) {
    var user = new User(req.session.user);
    var participants = req.body.participants.map(function(participant_id) {
      return new User({ id: participant_id });
    });
    var expense = new Expense({
      title: req.body.title,
      value: req.body.value,
      description: req.body.description,
      owner_id: user.id
    });
    var expense_done = expense.save();

    expense_done.then(function() {
      var participants_done = participants.map(function(participant) {
        var status = new ExpenseStatus({
          user_id: participant.id,
          expense_id: expense.id,
          status: expenses.expense_states.WAITING
        });
        return status.save();
      });
    }).then(function() {
      res.send({id: expense.id});
    }).catch(function(err) {
      res.send(500, "Could not create expense");
    });
  });

  app.post('/api/expense/:expense_id/pay', auth.check_auth, function(req, res) {
    var owner_id = req.session.user.id;
    var user_id = req.body.user_id;
    var expense_id = req.params.expense_id;
    var expense = new Expense({ id: req.params.expense_id});
    expense.fetch({withRelated: ['participants']}).then(function() {
      return expense.mark_paid(owner_id, user_id);
    }).then(function() {
      res.send({status: 'ok'});
    }).catch(function(err) {
      res.send(500, {
        status: 'error',
        err: 'There was an error paying the expense'
      });
    });
  });

  app.post('/api/add_contact', auth.check_auth, function(req, res) {
    var owner = new User(req.session.user);
    var email = req.body.email;

    var other = new User({email: email});
    other.fetch().then(function() {
      if (other.isNew()) {
        throw pretty_error('User does not exist');
      } else if (other.get('email') === owner.get('email')) {
        throw pretty_error('You can\'t add yourself as a contact');
      }
      return owner.contacts().attach(other.id);
    }).then(function() {
      res.send({status: 'ok'});
    }).catch(function(err) {
      send_error(res, err);
    });
  });

  app.get('/api/session_data', auth.check_auth, function(req, res) {
    res.send(req.session.user);
  });

  app.use('/ui', express.static(__dirname + '/ui'));
};
