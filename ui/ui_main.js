require('angular/angular');
require('angular-route/angular-route');
require('angular-ui-bootstrap/ui-bootstrap-tpls');
require('./expense_service');
require('./user_service');
require('./alert_service');
require('./create');

angular.module('main', ['ngRoute', 'ui.bootstrap', 'expense_service', 'user_service', 'alert_service', 'ui.bootstrap', 'expenseCreate'])
  .controller('rootController', ['$rootScope', 'users', function($rootScope, users) {
    $rootScope.isLoggedIn = users.logged_in();
    if (!users.logged_in()) {
      users.populate_data().then(function() {
        $rootScope.isLoggedIn = users.logged_in();
      });
    }
  }])
  .controller('indexController', ['$scope', 'expenses', function($scope, expenses) {
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
  }])
  .controller('loginController', ['$http', '$scope', 'users', 'alerts', '$location', '$rootScope', function($http, $scope, users, alerts, $location, $rootScope) {
    alerts.setupAlerts($scope);
    $scope.submit = function() {
      users.login($scope.email, $scope.password)
        .success(function(data) {
          alerts.addAlert("Logged in successfully", false);
          $rootScope.isLoggedIn = true;
          $location.url('/');
        })
        .error(function(data) {
          alerts.addAlert(data.err, true);
      });
    };
  }])
  .controller('logoutController', ['users', '$location', '$rootScope', function(users, $location, $rootScope) {
    users.logout().success(function() {
      $rootScope.isLoggedIn = false;
      $location.url('/');
    });
  }])
  .controller('createAccountController', ['$scope', 'users', 'alerts', '$location', function($scope, users, alerts, $location) {
    alerts.setupAlerts($scope);
    $scope.submit = function() {
      users.create_account({
        name: $scope.name,
        email: $scope.email,
        password: $scope.password,
        secret: $scope.secret
      }).success(function() {
        alerts.addAlert('New account created', false);
        $location.url('/login');
      }).error(function(data) {
        alerts.addAlert(data.err, true);
      });
    };
  }])
  .controller('expenseViewController', ['$scope', '$routeParams', 'expenses', function($scope, $routeParams, expenses) {
    var expense_id = $routeParams.expense_id;
    $scope.load_expense = function() {
      expenses.get_expense(expense_id)
        .success(function(data) {
          $scope.user_id = data.user_id;
          $scope.expense = data;
        });
    };
    $scope.load_expense();
  }])
  .controller('expenseController', ['expenses', '$scope', 'users', function(expenses, $scope, users) {
    $scope.isOwner = function() {
      return $scope.data && $scope.user_id == $scope.data.owner_id;
    };

    // Find the sum of values for participants that are waiting
    $scope.valueWaiting = function() {
      return $scope.data.participants.reduce(function(a, b) {
        if (b.status == 'Waiting') {
          return a + b.value;
        } else {
          return a;
        }
      }, 0);
    };

    // Find the participant associated with this user
    var viewer;
    $scope.viewerParticipant = function() {
      if (viewer) {
        return viewer;
      }
      if (!$scope.data) {
        return undefined;
      }
      $scope.data.participants.some(function(participant) {
        if (participant.id != users.user_data.id) {
          return false;
        }
        viewer = participant;
        return true;
      });
      return viewer;
    };

    $scope.renderValue = expenses.renderValue;

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

    $scope.squareCashLink = function() {
      var owner_email = $scope.data.owner.email;
      var value = expenses.renderValue($scope.viewerParticipant().value);
      var description = $scope.data.description;
      var body = description ? '&body=' + description : '';
      // Note: Zombie's dom implementation doesn't play very
      // well with Angular url sanitization of a mailto link. This will result
      // in zombie throwing an error and not injecting the link.
      var fullLink = 'mailto:' + owner_email +
        '?cc=cash@square.com' +
        '&subject=' + value +
        body;
      return fullLink;
    };
  }])
  .directive('expense', function() {
    return {
      restrict: 'E',
      scope: {
        data: '=data',
        user_id: '=userId'
      },
      templateUrl: '/ui/expense.html'
    };
  })
  .controller('addContactController', ['expenses', 'alerts', '$scope', function(expenses, alerts, $scope) {
    alerts.setupAlerts($scope);
    $scope.submit = function() {
      expenses.add_contact($scope.email)
        .success(function() {
          alerts.addAlert("Added new contact", false);
          $location.url('/');
        })
        .error(function(data) {
          alerts.addAlert(data.err, true);
        });
    };
  }])
  .config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
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
  }]);
