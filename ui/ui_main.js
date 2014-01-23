angular.module('main', ['ngRoute', 'expense_service', 'user_service'])
  .controller('indexController', function($scope, expenses) {
    $scope.refresh = function() {
      expenses.get_expenses()
        .success(function (data) {
          $scope.expenses = data;
          $scope.user_id = data.user_id;
        });
    };

    $scope.expenseFilter = function(expense) {
      var unfinished = expense.participants.some(function(participant) {
        return participant.status == 'Waiting';
      });
      if ($scope.showFinished) {
        return true;
      } else {
        return unfinished;
      }
    };

    $scope.refresh();
  })
  .controller('navigationController', function($scope, $location, users) {
    $scope.noRedirect = function(path) {
      var public_paths = ['/login', '/create_account'];
      return public_paths.some(function(element) {
        return element.indexOf(path) != -1;
      });
    };
    $scope.isLoggedIn = false;

    if (users.logged_in()) {
      $scope.isLoggedIn = true;
    } else if (!users.logged_in() && $scope.noRedirect($location.path())) {
      users.populate_data().then(function() {
        $scope.isLoggedIn = true;
      }, function() {
        window.location = '/login';
      });
    } else {
      $scope.isLoggedIn = false;
    }
  })
  .controller('loginController', function($http, $scope, users) {
    $scope.submit = function() {
      users.login($scope.email, $scope.password)
        .success(function(data) {
          window.location = '/';
        })
        .error(function() {
          //TODO: display a message that the login failed
          window.location = '/login?result=error'
      });
    };
  })
  .controller('logoutController', function(users) {
    users.logout().success(function() {
      window.location = '/';
    });
  })
  .controller('createAccountController', function($scope, users) {
    $scope.submit = function() {
      users.create_account({
        name: $scope.name,
        email: $scope.email,
        password: $scope.password,
        secret: $scope.secret
      }).success(function() {
        // TODO: Auto-login?
        window.location = '/login';
      }).error(function() {
        // TODO: display a failed to create account message, e.g. email already in use
        window.locatoin = '/create_account?result=error'
      });
    };
  })
  .controller('expenseViewController', function($scope, $routeParams, expenses) {
    var expense_id = $routeParams.expense_id;
    $scope.load_expense = function() {
      expenses.get_expense(expense_id)
        .success(function(data) {
          $scope.user_id = data.user_id;
          $scope.expense = data;
        });
    };
    $scope.load_expense();
  })
  .controller('expenseController', function(expenses, $scope) {
    $scope.isOwner = function() {
      return $scope.data && $scope.user_id == $scope.data.owner_id;
    };
    $scope.renderValue = function(value) {
      return '$' + value / 100;
    };
    $scope.markPaid = function(user_id, expense_id) {
      expenses.pay_expense(expense_id, user_id)
        .success(function() {
          $scope.data.participants.forEach(function(participant) {
            if(participant.id == user_id) {
              participant.status = 'Paid';
            }
          });
        })
        .error(function(err) {
          alert(err);
        });
    };

    function filter_participants(status) {
      return $scope.data &&
        $scope.data.participants.filter(function(participant) {
          return participant.status == status;
        });
    }

    $scope.unpaid_participants = function() {
      return filter_participants('Waiting');
    };

    $scope.paid_participants = function() {
      return filter_participants('Paid');
    };

  })
  .directive('expense', function() {
    return {
      restrict: 'E',
      scope: {
        data: '=data',
        user_id: '=userId'
      },
      templateUrl: 'ui/expense.html'
    };
  })
  .controller('createExpenseController', function($scope, expenses) {
    $scope.selected_contacts = [];

    function getContacts() {
      expenses.get_contacts()
        .success(function(data) {
          $scope.contacts = data;
        })
        .error(function(err) {
          $scope.error = 'There was an error retrieving your contacts: ' + err;
        });
    }
    $scope.submit = function() {
      var participants = $scope.selected_contacts.map(function(participant) {
        return participant.id;
      });

      var value;
      if($scope.value.indexOf('$') !== -1) {
        var no_dollar = $scope.value.slice(1);
        value = parseFloat(no_dollar) * 100;
      } else {
        value = parseFloat($scope.value) * 100;
      }

      var new_expense = {
        title: $scope.title,
        value: value,
        description: $scope.description,
        participants: participants
      };
      expenses.create_expense(new_expense)
        .success(function(response) {
          var id = response.id;
          window.location = '#/expense/' + id;
        })
        .error(function(err) {
          alert('Expense could not be created: ' + err);
        });
    };

    $scope.cancel = function() {
      window.location = '#/';
    };


    $scope.toggleContact = function(contact) {
      var index = $scope.selected_contacts.indexOf(contact);
      if (index != -1) {
        $scope.selected_contacts.splice(index, 1);
      } else {
        $scope.selected_contacts.push(contact);
      }
    };

    $scope.contactClass = function(contact) {
      var selected = $scope.selected_contacts.indexOf(contact) != -1;
      return selected ? 'contact-selected' : 'contact-deselected';
    };

    getContacts();
  })
  .controller('addContactController', function(expenses, $scope) {
    $scope.submit = function() {
      expenses.add_contact($scope.email)
        .success(function() {
          window.location = '#/';
        })
        .error(function() {
          alert('Could not add contact');
        });
    };
  })
  .config(function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);
    $routeProvider
      .when('/', {
        templateUrl: '/ui/expense_listing.html',
        controller: 'indexController'
      })
      .when('/login', {
        templateUrl: '/ui/login.html',
        controller: 'loginController'
      })
      .when('/logout', {
        template: ' ',
        controller: 'logoutController'
      })
      .when('/create_account', {
        templateUrl: '/ui/create_account.html',
        controller: 'createAccountController'
      })
      .when('/expense/:expense_id', {
        templateUrl: '/ui/expense_view.html',
        controller: 'expenseViewController'
      })
      .when('/create_expense', {
        templateUrl: '/ui/create_expense.html',
        controller: 'createExpenseController'
      })
      .when('/add_contact', {
        templateUrl: '/ui/add_contact.html',
        controller: 'addContactController'
      })
      .otherwise({
        redirectTo: '/'
      });
  });
