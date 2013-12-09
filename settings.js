if (process.env.NODE_ENV == 'testing') {
  exports.database_client = 'sqlite';
  exports.database_connection = {
    filename: ':memory:'
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
    native: true,
  };
}
