var db = require('./db');
var auth = require('./auth');
var knex = require('knex');

var User = db.bookshelf.Model.extend({
  tableName: 'users',

  hasTimestamps: ['created_at', 'updated_at'],

  login: function(password) {
    return auth.hash_password(password, this.get('salt')).then(
      function(hashed_password) {
        if (this.get('password') == hashed_password) {
          return this;
        } else {
          throw new Error("Invalid email or password");
        }
      }.bind(this)
    );
  },

  salt_and_hash: function() {
    var salt = auth.generate_salt(128);
    this.set('salt', salt);
    return auth.hash_password(this.get('password'), salt)
      .then(function(hash_result) {
        this.set('password', hash_result);
      }.bind(this));
  },

  status: function() {
    // returns the status of the user on the expense, if this was
    // retrieved relative to an expense.
    // Undefined otherwise
    return this.pivot && this.pivot.get('status');
  },

  owned_expenses: function() {
    // TODO: Blargh...
    // If I import this at the begining of the file, it creates a circular import, which
    // node seems to resolve by not importing User when expense.js is imported.
    var Expense = require('./expenses').Expense;
    return this.hasMany(Expense, 'owner_id')
      .query(function(qb) {
        qb.whereNull('deleted');
      });
  },

  participant_expenses: function() {
    // TODO: Blargh...
    var expenses = require('./expenses');
    var Expense = expenses.Expense;
    var ExpenseStatus = expenses.ExpenseStatus;
    return this.belongsToMany(Expense)
      .through(ExpenseStatus)
      .withPivot('status').query(function(qb) {
        qb.whereNull('deleted');
      });
  },

  paid_expenses: function() {
    // Expenses where the user is a participant and has paid
    var expenses = require('./expenses');
    return this.participant_expenses()
      .query(function(qb) {
        qb.where('status', '=', expenses.expense_states.PAID);
      });
  },

  unpaid_expenses: function() {
    // Expenses where the user is a participant and has not paid
    var expenses = require('./expenses');
    return this.participant_expenses()
      .query(function(qb) {
        qb.where('status', '=', expenses.expense_states.WAITING);
      });
  },

  // Used in finished_expenses and unfinished expenses
  _with_waiting: function() {
    var expenses = require('./expenses');
    this.select('id')
      .from('expense_status')
      .whereRaw('expenses.id = expense_status.expense_id')
      .andWhere('expense_status.status', '=', expenses.expense_states.WAITING);
  },


  // Expenses where the user is the owner and all have paid
  finished_expenses: function() {
    return this.owned_expenses()
      .query(function(qb) {
        qb.whereNotExists(this._with_waiting);
      }.bind(this));
  },

  // Expenses where the user is the owner and all have not paid
  unfinished_expenses: function() {
    return this.owned_expenses()
      .query(function(qb) {
        qb.whereExists(this._with_waiting);
      }.bind(this));
  }

}, {
  login: function(email, password) {
    var u = new User({email: email});
    return u.fetch().then(function() {
      return u.login(password);
    }).catch(function(err) {
      throw new Error("Invalid email or password");
    });
  },
});


exports.User = User;
