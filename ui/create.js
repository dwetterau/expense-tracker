angular.module('expenseCreate', ['user_service', 'expense_service', 'alert_service', 'ui.bootstrap'])
  .controller('createExpenseController', ['$scope', 'expenses', 'users', '$location', 'alerts', function($scope, expenses, users, $location, alerts) {
    alerts.setupAlerts($scope);
    $scope.owner = users.user_data;
    $scope.participants = [
      {owner: true,
       proportion: 50,
       name: $scope.owner.name
      },
      {proportion: 50}
    ];
    if (!users.user_data.name) {
      users.populate_data()
        .then(function() {
          $scope.owner = users.user_data;
          $scope.participants[0].name = $scope.owner.name;
        });
    }
    $scope.totalProportions = 100;

    function getContacts() {
      expenses.get_contacts()
        .success(function(data) {
          $scope.contacts = data;
        })
        .error(function(err) {
          alerts.addAlert('There was an error retrieving your contacts: ' + err, true);
        });
    }

    function cleanupValue(value) {
      if (value.substring(0, 1) == '$') {
        value = value.slice(1);
      }
      return Math.round(parseFloat(value) * 100);
    }

    $scope.updateFromTotalValue = function() {
      $scope.totalProportions = 0;
      angular.forEach($scope.participants, function(contact) {
        if (contact.hasOwnProperty('proportion')) {
          $scope.totalProportions += parseFloat(contact.proportion);
        }
      });

      if ($scope.totalProportions === 0) {
        $scope.totalProportions = 1;
      }
      var proportionValue = cleanupValue($scope.value || '') / $scope.totalProportions;
      angular.forEach($scope.participants, function(participant) {
        var individualValue = Math.ceil(proportionValue * participant.proportion);
        participant.value = expenses.renderValue(individualValue);
      });
    };

    $scope.changeSubValue = function() {
      var sum = 0;
      angular.forEach($scope.participants, function(contact) {
        if (contact.hasOwnProperty('value')) {
          sum += cleanupValue(contact.value);
        }
      });

      angular.forEach($scope.participants, function(contact) {
        contact.proportion = Math.round(cleanupValue(contact.value) / sum * 100);
      });

      $scope.value = expenses.renderValue(sum);
    };

    $scope.add = function() {
      $scope.participants.push({proportion: 50});
      $scope.updateFromTotalValue();
    };

    $scope.delete = function(index) {
      $scope.participants.splice(index, 1);
      $scope.updateFromTotalValue();
    };

    $scope.submit = function() {
      var participants = {};
      angular.forEach($scope.participants, function(participant) {
        if (participant.owner) {
          return;
        }
        // TODO - multiple contacts with same name
        var contact = $scope.contacts.filter(function(contact) {
          return participant.name == contact.name;
        })[0];
        // TODO - throw error if no such contact exists
        participants[contact.id] = cleanupValue(participant.value);
      });

      var new_expense = {
        title: $scope.title,
        description: $scope.description,
        participants: participants
      };

      expenses.create_expense(new_expense)
        .success(function(response) {
          var id = response.id;
          $location.url('/expense/' + id);
        })
        .error(function(err) {
          alerts.addAlert('Expense could not be created: ' + err, true);
        });
    };

    $scope.cancel = function() {
      $location.url('/');
    };

    getContacts();
  }]);
