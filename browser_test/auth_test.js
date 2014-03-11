process.env.NODE_ENV = 'testing';
var assert = require('assert');
var Browser = require('zombie');
var test_server = require('../test/test_server');
var load_test_data = require('../test/load_test_data');

var local_url = 'http://localhost:' + test_server.port;

describe('auth', function() {
  this.timeout(10000);

  var close_func;

  before(function(done) {
    test_server.start_with_data()
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

  describe('redirection', function() {
    it('should redirect on /add_contact before login', function(done) {
      var browser = new Browser();
      browser.visit(local_url + '/add_contact')
        .then(function() {
          assert.equal(browser.location.pathname, '/login');
          done();
        }).catch(function(err) {
          done(err);
        });
    });

    it('should not redirect on /create_account', function(done) {
      var browser = new Browser();
      browser.visit(local_url + '/create_account')
        .then(function() {
          assert.equal(browser.location.pathname, '/create_account');
          done();
        });
    });
  });

  describe('login', function() {
    it('should allow a login', function(done) {
      var browser = new Browser();
      browser.visit(local_url + '/create_account')
        .then(function() {
          browser.fill('#name', 'test creation')
            .fill('#email', 'testbrowserlogin@example.com')
            .fill('#password', 'password')
            .fill('#secret', '0xDEADBEEFCAFE');
          return browser.pressButton('Create');
        })
        .then(function() {
          assert.equal(browser.location.pathname, '/login');
          browser.fill('#email', 'testbrowserlogin@example.com')
            .fill('#password', 'password');
          return browser.pressButton('Login');
        })
        .then(function() {
          assert.equal(browser.location.pathname, '/');
          done();
        }).catch(function(err) {
          done(err);
        });
    });
  });
});
