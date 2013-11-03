exports.format_money = function(money) {
  // In the event that multiple "currencies" need to be added, this can easily be modified
  return '$' + money / 100;
};

exports.pay_link = function(expense_id, user_id) {
  return '/expense/' + expense_id + '/pay/' + user_id;
};
