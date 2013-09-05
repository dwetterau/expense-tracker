exports.format_money = function(money) {
  // In the event that multiple "currencies" need to be added, this can easily be modified
  return '$' + money / 100;
};
