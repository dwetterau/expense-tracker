angular.module('expense_service', [])
// Curse google and their factories & nonsense
  .factory('expenses', function($http) {
    return {
      get_expenses: function() {
        return $http.get('/api/expenses');
      },
      get_expense: function(expense_id) {
        return $http.get('/api/expense/' + expense_id);
      },
      pay_expense: function(expense_id, user_id) {
        return $http.post('/api/expense/' + expense_id + '/pay',
                          {user_id: user_id});
      },
      create_expense: function(new_expense) {
        return $http.post('/api/create_expense', new_expense);
      },

      get_contacts: function() {
        return $http.get('/api/contacts');
      },
      add_contact: function(email) {
        return $http.post('/api/add_contact', {email: email});
      },
      renderValue: function(value) {
        return '$' + value / 100;
      }
    };
  });
