angular.module('expenseCreate', ['user_service', 'expense_service', 'alert_service', 'ui.bootstrap'])
  .controller('createExpenseController', function($scope, expenses, users, $location) {
    $scope.selectedContacts = [{proportion: 50}];
    $scope.totalProportions = 100;
    $scope.owner = users.user_data;
    $scope.ownerProportion = 50;

    function getContacts() {
      expenses.get_contacts()
        .success(function(data) {
          $scope.contacts = data;
        })
        .error(function(err) {
          $scope.error = 'There was an error retrieving your contacts: ' + err;
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
      angular.forEach($scope.selectedContacts, function(contact) {
        if (contact.hasOwnProperty('proportion')) {
          $scope.totalProportions += parseFloat(contact.proportion);
        }
      });
      $scope.totalProportions += parseFloat($scope.ownerProportion);

      if ($scope.totalProportions === 0) {
        $scope.totalProportions = 1;
      }
      var proportionValue = cleanupValue($scope.value || '') / $scope.totalProportions;
      angular.forEach($scope.selectedContacts, function(contact) {
        var individualValue = Math.ceil(proportionValue * contact.proportion);
        contact.value = expenses.renderValue(individualValue);
      });
      $scope.ownerValue = expenses.renderValue(proportionValue * $scope.ownerProportion);
    };

    $scope.changeSubValue = function() {
      var sum = cleanupValue($scope.ownerValue);
      angular.forEach($scope.selectedContacts, function(contact) {
        if (contact.hasOwnProperty('value')) {
          sum += cleanupValue(contact.value);
        }
      });

      angular.forEach($scope.selectedContacts, function(contact) {
        contact.proportion = Math.round(cleanupValue(contact.value) / sum * 100);
      });

      $scope.ownerProportion = Math.round(
        cleanupValue($scope.ownerValue) / sum * 100
      );

      $scope.value = expenses.renderValue(sum);
    };

    $scope.add = function() {
      $scope.selectedContacts.push({proportion: 50});
      $scope.updateFromTotalValue();
    };

    $scope.delete = function(index) {
      $scope.selectedContacts.splice(index, 1);
      $scope.updateFromTotalValue();
    };

    $scope.submit = function() {
      var participants = {};
      angular.forEach($scope.selectedContacts, function(selected) {
        // TODO - multiple contacts with same name
        var contact = $scope.contacts.filter(function(contact) {
          return selected.name == contact.name;
        })[0];
        // TODO - throw error if no such contact exists
        participants[contact.id] = cleanupValue(selected.value);
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
          alert('Expense could not be created: ' + err);
        });
    };

    $scope.cancel = function() {
      $location.url('/');
    };

    getContacts();
  })
  .controller('addContactController', function(expenses, alerts, $scope) {
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
  })
