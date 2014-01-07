angular.module('main', ['ngRoute'])
  .controller('indexController', function($scope, $http) {
    $scope.refresh = function() {
      $http.get('/api/expenses')
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
  .controller('expenseViewController', function($scope, $routeParams, $http) {
    var expense_id = $routeParams.expense_id;
    $scope.load_expense = function() {
      $http.get('/api/expense/' + expense_id)
        .success(function(data) {
          $scope.expense = data;
          $scope.user_id = data.user_id;
        });
    };

    $scope.load_expense();
  })
  .controller('expenseController', function($http, $scope) {
    var expense = $scope.data;
    var isOwner = expense && expense.owner_id == $scope.user_id;
    $scope.renderValue = function(value) {
      return '$' + value / 100;
    };
    $scope.isOwner = isOwner;
    $scope.markPaid = function(user_id, expense_id) {
      $http.post('/api/expense/' + expense_id + '/pay/' + user_id)
        .success(function() {
          expense.participants.forEach(function(participant) {
            if(participant.id == user_id) {
              participant.status = 'Paid';
            }
          });
        })
        .error(function(err) {
          alert(err);
        });
    };
  })
  .directive('expense', function() {
    return {
      restrict: 'E',
      scope: {
        data: '=data',
        user_id: '=userId'
      },
      templateUrl: 'expense.html'
    };
  })
  .controller('createController', function($scope, $http) {
    $scope.selected_contacts = [];

    function getContacts() {
      $http.get('/api/contacts')
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
      var new_expense = {
        title: $scope.title,
        value: $scope.value,
        description: $scope.description,
        participants: participants
      };
      $http.post('/api/create_expense', new_expense)
        .success(function(response) {
          var id = response.id;
          window.location = '#/expense/' + id;
        })
        .error(function(err) {
          alert('Expense could not be created: ' + err);
        });
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
  .config(function($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'expense_listing.html',
        controller: 'indexController'
      })
      .when('/expense/:expense_id', {
        templateUrl: 'expense_view.html',
        controller: 'expenseViewController'
      })
      .when('/create_expense', {
        templateUrl: 'create_expense.html',
        controller: 'createController'
      })
      .otherwise({
        redirectTo: '/'
      });
  });
