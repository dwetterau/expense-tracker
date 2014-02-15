angular.module('alert_service', [])
  // A service for handling user session data and login / logout calls
  .factory('alerts', function() {
    var alert_service = {
      scope: undefined,

      setupAlerts: function(scope) {
        scope.alerts = [];
        alert_service.scope = scope;
      },
      addAlert: function(message, isError) {
        var alert = {
          type: isError ? 'danger' : 'success',
          message: message,
          close: function(index) {
            alert_service.scope.alerts.splice(index, 1);
          }
        };
        alert_service.scope.alerts.unshift(alert);
      }
    };
    return alert_service;
  });
