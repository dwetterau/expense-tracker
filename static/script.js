angular.module('main', [])
  .controller('indexController', function($scope, $http) {
    $scope.refresh = function() {
      $http.get('/expenses')
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
  .controller('expenseController', function($scope) {
    var expense = $scope.data;
    var isOwner = expense.owner_id == $scope.user_id;
    $scope.isOwner = isOwner;
  })
  .directive('expense', function() {
    return {
      restrict: 'E',
      scope: {
        data: '=data',
        user_id: '=userId'
      },
      templateUrl: '/static/expense.html'
    };
  });
