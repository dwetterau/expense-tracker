var db = require('./db');
var auth = require('./auth');
var knex = require('knex');

var User = db.bookshelf.Model.extend({
  tableName: 'users',

  hasTimestamps: ['created_at', 'updated_at'],

  // Since toJSON is called when we are storing this data somewhere,
  // we don't want to include the salt and password
  toJSON: function() {
    var result = db.bookshelf.Model.prototype.toJSON.apply(this, arguments);
    delete result.salt;
    delete result.password;
    return result;
  },

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

  change_password: function(password, new_password) {
    return auth.hash_password(password, this.get('salt')).then(
      function(hashed_password) {
        if (this.get('password') == hashed_password) {
          // set new password and salt_and_hash
          this.set('password', new_password);
          return this.salt_and_hash();
        } else {
          throw new Error("Incorrect current password");
        }
      }.bind(this)
    );
  },

  reset_password: function(name) {
    var new_password = auth.random_password(10);
    this.set('password', new_password);
    return this.salt_and_hash().then(function() {
      return new_password;
    });
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
  },

  contacts: function() {
    return this.belongsToMany(User, 'contacts', 'user_id', 'contact_id');
  },

  pretty_json: function() {
    var expenses = require('./expenses');
    var data = this.toJSON();

    if (data.hasOwnProperty('_pivot_status')) {
      data.status = expenses.format_status(data._pivot_status);
    }
    if (data.hasOwnProperty('_pivot_value')) {
      data.value = data._pivot_value;
    }
    ['_pivot_status', '_pivot_id',
     '_pivot_expense_id', '_pivot_user_id',
     '_pivot_value'].forEach(function(property) {
       if(data.hasOwnProperty(property)) {
         delete data[property];
       }
     });
    return data;
  }

}, {
  login: function(email, password) {
    var u = new User({email: email});
    return u.fetch().then(function() {
      return u.login(password);
    }).catch(function(err) {
      throw new Error("Invalid email or password");
    });
  }
});


exports.User = User;
