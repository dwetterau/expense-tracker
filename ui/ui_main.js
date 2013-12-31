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
  .controller('expenseController', function($scope) {
    var expense = $scope.data;
    var isOwner = expense && expense.owner_id == $scope.user_id;
    $scope.renderValue = function(value) {
      return '$' + value / 100;
    };
    $scope.isOwner = isOwner;
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
  .config(function($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: "expense_listing.html",
        controller: "indexController"
      })
      .when('/expense/:expense_id', {
        templateUrl: "expense_view.html",
        controller: "expenseViewController"
      })
      .otherwise({
        redirectTo: '/'
      });
  });
