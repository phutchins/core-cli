'use strict';
var expect = require('chai').expect;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var colors = require('colors/safe');

var Logger = proxyquire('../bin/logger.js', {});
var clock;

describe('index', function() {
  describe('@constructor', function() {
    it('should return an instance without the new keyword', function() {
      expect(Logger()).to.be.instanceOf(Logger);
    });

    it('should set the correct log level', function() {
      var testLogger = new Logger(2);
      expect(testLogger._loglevel).to.equal(2);
    });

    it('should default to log level 3 if a log level is not specified',
      function() {
      var testLogger = new Logger();
      expect(testLogger._loglevel).to.equal(3);
    });

    it('should properly set all logging functions', function() {
      var oldLog = Logger.prototype.log;
      Logger.prototype.log = sinon.stub();
      var testLogger = new Logger();
      testLogger._shouldLog = sinon.stub().returns(true);

      testLogger.log.info('testmessage1', 'arg1');
      testLogger.log.debug('testmessage2');
      testLogger.log.warn('testmessage3', 'arg1', 'arg2');
      testLogger.log.error('testmessage4');
      expect(testLogger.log.calledWithMatch('info', 'testmessage1',
        ['arg1'])).to.equal(true);
      expect(testLogger.log.calledWithMatch('debug', 'testmessage2',
        [])).to.equal(true);
      expect(testLogger.log.calledWithMatch('warn', 'testmessage3',
        ['arg1', 'arg2'])).to.equal(true);
      expect(testLogger.log.calledWithMatch('error', 'testmessage4',
        [])).to.equal(true);

      Logger.prototype.log = oldLog;
    });
  });

  describe('#log', function() {
    before(function() {
      console.oldConsoleLog = console.log;
      console.log = sinon.stub();
      var now = new Date();
      clock = sinon.useFakeTimers(now.getTime());
    });
    after(function() {
      console.log = console.oldConsoleLog;
      clock.restore();
    });

    it('should properly log a debug message', function() {
      var testLogger = new Logger();

      var inputMessage = 'test message';
      var outputMessage = colors.bold.gray(' [' + new Date() + ']') +
        colors.bold.magenta(' [debug]  ') + inputMessage;

      testLogger.log('debug', inputMessage);

      expect(console.log.calledWithMatch(outputMessage)).to.equal(true);
    });

    it('should properly log an info message', function() {
      var testLogger = new Logger();

      var inputMessage = 'test message';
      var outputMessage = colors.bold.gray(' [' + new Date() + ']') +
        colors.bold.cyan(' [info]   ') + inputMessage;

      testLogger.log('info', inputMessage);

      expect(console.log.calledWithMatch(outputMessage)).to.equal(true);
    });

    it('should properly log a warn message', function() {
      var testLogger = new Logger();

      var inputMessage = 'test message';
      var outputMessage = colors.bold.gray(' [' + new Date() + ']') +
        colors.bold.yellow(' [warn]   ') + inputMessage;

      testLogger.log('warn', inputMessage);

      expect(console.log.calledWithMatch(outputMessage)).to.equal(true);
    });

    it('should properly log an error message', function() {
      var testLogger = new Logger();

      var inputMessage = 'test message';
      var outputMessage = colors.bold.gray(' [' + new Date() + ']') +
        colors.bold.red(' [error]  ') + inputMessage;

      testLogger.log('error', inputMessage);

      expect(console.log.calledWithMatch(outputMessage)).to.equal(true);
    });
  });

  describe('#_shouldLog', function() {
    it('should only log debug for log level 4 and above', function() {
      var testLogger1 = new Logger(3);
      var testLogger2 = new Logger(4);

      expect(testLogger1._shouldLog('debug')).to.equal(false);
      expect(testLogger2._shouldLog('debug')).to.equal(true);
    });

    it('should only log info for log level 3 and above', function() {
      var testLogger1 = new Logger(2);
      var testLogger2 = new Logger(3);

      expect(testLogger1._shouldLog('info')).to.equal(false);
      expect(testLogger2._shouldLog('info')).to.equal(true);
    });

    it('should only log warn for log level 2 and above', function() {
      var testLogger1 = new Logger(1);
      var testLogger2 = new Logger(2);

      expect(testLogger1._shouldLog('warn')).to.equal(false);
      expect(testLogger2._shouldLog('warn')).to.equal(true);
    });

    it('should only log error for log level 1 and above', function() {
      var testLogger = new Logger(1);

      expect(testLogger._shouldLog('error')).to.equal(true);
    });
  });
});
