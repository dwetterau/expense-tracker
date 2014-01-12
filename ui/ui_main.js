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
          $scope.user_id = data.user_id;
          $scope.expense = data;
        });
    };

    $scope.load_expense();
  })
  .controller('expenseController', function($http, $scope) {
    $scope.isOwner = function() {
      return $scope.data && $scope.user_id == $scope.data.owner_id;
    };
    $scope.renderValue = function(value) {
      return '$' + value / 100;
    };
    $scope.markPaid = function(user_id, expense_id) {
      $http.post('/api/expense/' + expense_id + '/pay',
                {user_id: user_id})
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
      return $scope.data.participants.filter(function(participant) {
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

      var value;
      if($scope.value.indexOf('$') !== -1) {
        var no_dollar = $scope.value.slice(1);
        value = parseInt(no_dollar) * 100;
      } else {
        value = parseInt($scope.value) * 100;
      }

      var new_expense = {
        title: $scope.title,
        value: value,
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
  .controller('addContact', function($http, $scope) {
    $scope.submit = function() {
      $http.post('/api/add_contact', {email: $scope.email})
        .success(function() {
          window.location = '#/';
        })
        .fail(function() {
          alert('Could not add contact');
        });
    };
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
      .when('/add_contact', {
        templateUrl: 'add_contact.html',
        controller: 'addContact'
      })
      .otherwise({
        redirectTo: '/'
      });
  });
