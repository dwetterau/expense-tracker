angular.module('user_service', [])
  // A service for handling user session data and login / logout calls
  .factory('users', function($http) {
    var user = {
      user_data : {
        id: -1,
        email: '',
        name: ''
      },
      populate_data: function() {
        return $http.get('/api/session_data').success(function(data) {
          user.user_data = data;
        }).error(function(err) {
          throw err;
        });
      },
      logged_in: function() {
        return user.user_data.id >= 0;
      },
      login: function(email, password) {
        return $http.post('/api/login', {
          email: email,
          password: password
        });
      },
      logout: function() {
        return $http.post('/api/logout');
      },
      create_account: function(new_user) {
        return $http.post('/api/create_account', new_user);
      }
    };
    return user;
  })
  .config(['$httpProvider', function($httpProvider) {
    $httpProvider.interceptors.push(
      ['$q', '$location', function($q, $location) {
        return {
          responseError: function(response) {
            if (response.status === 401) {
              $location.url('/login');
            }
            return $q.reject(response);
          }
        };
      }]);
  }]);
