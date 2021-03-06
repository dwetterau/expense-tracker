if (process.env.NODE_ENV == 'testing') {
  exports.database_client = 'sqlite';
  exports.database_connection = {
    filename: ':memory:'
  };

  // Run this function after databaes init
  exports.after_init = function() {
      var schema = require('./schema');
      return schema.add_all();
    };
} else {
  exports.database_client = 'pg';
  exports.database_connection = {
    user: 'expenses',
    password: 'expenses_password',
    database: 'expenses',
    host: 'localhost',
    port: 5432,
    dialect: 'postgres',
    native: true
  };
  // This is used to construct links in emails
  exports.hostname = 'https://expenses.adamf.co';
  exports.email_check_interval = 5000;
}
// Set to true in order to see all queries issued
exports.debug = false;
