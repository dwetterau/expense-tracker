angular.module('main', ['ngRoute', 'expense_service'])
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
  .controller('navigationController', function($scope, $location) {
    $scope.updateNav = function() {
      console.log($scope.user_id, $location.url());
    }
  })
  .controller('loginController', function($http, $scope, $location) {
    $scope.submit = function() {
      $http.post('/api/login', {
        email: $scope.email,
        password: $scope.password,
        //TODO figure out how to read qs parameters
        next: $location.search('next')
      }).success(function(data) {
        // TODO: set this user_id on some service that the navbar will read
        window.location = data.next ? data.next : '/';
      }).error(function() {
        //TODO: display a message that the login failed
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
