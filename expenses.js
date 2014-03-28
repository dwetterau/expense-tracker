var db = require('./db');
var deletable = require('./deletable');
var User = require('./users').User;
var Q = require('q');

// constants for expense state
var expense_states = {
  WAITING: 0,
  PAID: 1,
  OWNED: 2
};

var ExpenseStatus = db.bookshelf.Model.extend({
  tableName: 'expense_status',

  user: function() {
    return this.belongsTo(User);
  },

  expense: function() {
    return this.belongsTo(Expense);
  }
});

var Expense = deletable.Deletable.extend({
  tableName: 'expenses',

  hasTimestamps: ['created_at', 'updated_at'],

  owner: function() {
    return this.belongsTo(User, 'owner_id');
  },

  participants: function() {
    return this.belongsToMany(User, 'expense_status')
      .through(ExpenseStatus)
      .withPivot('status')
      .withPivot('value');
  },

  getWithAllParticipants: function() {
    return this.fetch({withRelated: ['owner', 'participants']});
  },

  mark_paid: function(owner_id, user_id) {
    var deferred = Q.defer();
    if(this.get('owner_id') != owner_id) {
      deferred.reject(new Error('User is not owner of this expense'));
      return deferred.promise;
    }
    var user = this.related('participants').get(user_id);
    if(user === undefined) {
      deferred.reject(new Error('User is not included on given expense'));
      return deferred.promise;
    }
    var status = user.pivot;
    status.set('status', expense_states.PAID);
    return status.save();
  },

  pretty_json: function() {
    var data = this.toJSON();
    // Clean up pivot properties
    if (data.hasOwnProperty('_pivot_status')) {
      data.my_status = exports.format_status(data._pivot_status);
    }
    ['_pivot_status', '_pivot_id',
     '_pivot_expense_id', '_pivot_user_id'].forEach(function(property) {
       if(data.hasOwnProperty(property)) {
         delete data[property];
       }
     });

    // Clean up users
    if(data.hasOwnProperty('participants')) {
      data.participants = this.related('participants').invoke('pretty_json');
    }
    if(data.hasOwnProperty('owner')) {
      data.owner = this.related('owner').pretty_json();
    }
    return data;
  }

}, {
  getWithPermissionCheck: function(expense_id, user_id) {
    var e = new Expense({id: expense_id});
    return e.getWithAllParticipants().then(function() {
      if (user_id == e.get('owner_id')) {
        return e;
      } else if (e.related('participants').get(user_id)) {
        return e;
      } else {
        throw new Error('Insufficient permissions');
      }
    });
  },


}
);

exports.Expense = Expense;
exports.ExpenseStatus = ExpenseStatus;
exports.expense_states = expense_states;

function filter_participants(participants, status) {
  return participants.filter(function(participant) {
    return participant.pivot.get('status') == status;
  }).map(function(participant) {
    return participant.toJSON();
  });
}

exports.templateify = function(expense, user_id) {
  var data = expense.toJSON();
  data.waiting = filter_participants(expense.related('participants'),
                                     expense_states.WAITING);
  data.paid = filter_participants(expense.related('participants'),
                                  expense_states.PAID);

  data.owner = expense.related('owner').toJSON();

  data.is_owner = user_id == data.owner.id;

  if(expense.get('image_id')) {
    data.receipt_image = expense.get('image_id');
  }

  return data;

};

exports.format_status = function(s) {
  switch (s) {
  case expense_states.PAID:
    return 'Paid';
  case expense_states.WAITING:
    return 'Waiting';
  case expense_states.OWNED:
    return 'Owner';
  }
};
