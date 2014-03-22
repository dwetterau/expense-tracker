process.env.NODE_ENV = 'testing';
var assert = require('assert');
var Browser = require('zombie');
var test_server = require('../test/test_server');
var load_test_data = require('../test/load_test_data');

var port = 12347;
var local_url = 'http://localhost:' + port;

describe('expenses', function() {
  this.timeout(10000);
  var close_func;

  before(function(done) {
    test_server.start_with_data(port)
      .then(function(close) {
        close_func = close;
        done();
      }).catch(function(err) {
        done(err);
      });
  });

  after(function(done) {
    close_func && close_func();
    load_test_data.reset().then(function() {
      done();
    }).catch(function(err) {
      done(err);
    });
  });

  describe('viewing', function() {
    var baseBrowser = new Browser({site: local_url});
    baseBrowser.setCookie({name: 'connect.sid', domain: 'localhost', value: 'abcde'});

    it('should have the correct content on index view', function(done) {
      var browser = baseBrowser;
      browser.visit('/')
        .then(function() {
          assert(browser.success);
          var first = browser.queryAll('expense a')[0];
          assert.equal(first.textContent, ' Test title1 ');
          var second = browser.queryAll('expense a')[1];
          assert.equal(second.textContent, ' Test title2 ');
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });

    it('should have the correct content on expense view', function(done) {
      var browser = baseBrowser;
      browser.visit('/expense/1')
        .then(function() {
          assert(browser.success);
          assert.equal(browser.text('.participant-paid'), 'testMan1 - Owner');
          assert.equal(browser.text('.participant-unpaid'), 'testMan2: $0.01 - Waiting');
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });

    it('should be able to create an expense', function(done) {
      var browser = baseBrowser;
      browser.visit('/create_expense')
        .then(function() {
          browser.fill('#title', 'Test Created')
            .fill('.participant-name', 'testMan2')
            .fill('#description', 'Test Created Description')
            .fill('#value', '$100.92');
          return browser.wait();
        })
        .then(function() {
          return browser.pressButton('Done');
        })
        .then(function() {
          assert(browser.location.pathname.indexOf('/expense') === 0);
          assert.equal(browser.text('.participant-unpaid'), 'testMan2: $50.46 - Waiting');
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });

    it('should correctly adjust the value upon changing the proportion', function(done) {
      var browser = baseBrowser;
      browser.visit('/create_expense')
        .then(function() {
          browser.fill('#value', '$100.00');
          return browser.wait();
        }).then(function() {
          assert.equal(browser.query('[ng-model="participant.value"]').value, '$50.00');
          browser.fill('[ng-model="participant.proportion"]', 100);
          return browser.wait();
        }).then(function() {
          assert.equal(browser.query('[ng-model="participant.value"]').value, '$66.67');
          done();
        }).catch(function(err) {
          done(err);
        });
    });

    it('should correctly adjust the value upon changing the total', function(done) {
      var browser = baseBrowser;
      browser.visit('/create_expense')
        .then(function() {
          browser.fill('#value', '$100.00');
          return browser.wait();
        }).then(function() {
          assert.equal(browser.query('[ng-model="participant.value"]').value, '$50.00');
          browser.fill('#value', '$200.00');
          return browser.wait();
        }).then(function() {
          assert.equal(browser.query('[ng-model="participant.value"]').value, '$100.00');
          done();
        }).catch(function(err) {
          done(err);
        });
    });

    it('should correctly adjust the proportion upon changing the value', function(done) {
      var browser = baseBrowser;
      browser.visit('/create_expense')
        .then(function() {
          browser.fill('#value', '$100.00');
          return browser.wait();
        }).then(function() {
          assert.equal(browser.query('[ng-model="participant.value"]').value, '$50.00');
          browser.fill('[ng-model="participant.value"]', '$100.00');
          return browser.wait();
        }).then(function() {
          assert.equal(browser.query('[ng-model="participant.proportion"]').value, 67);
          done();
        }).catch(function(err) {
          done(err);
        });
    });

    it('should redirect upon going to a nonexistent expense', function(done) {
      var browser = baseBrowser;
      browser.visit('/expenses/500')
        .then(function() {
          assert.equal(browser.location.pathname, '/');
          done();
        }).catch(function(err) {
          done(err);
        });
    });

  });

});
