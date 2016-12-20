'use strict';

var expect = require('chai').expect;
var proxyquire = require('proxyquire');
var sinon = require('sinon');

var LoggerStub = {
  log: sinon.stub()
};
var utilsStub = {};
var clientStub = {};

var Keys = proxyquire('../../bin/actions/keys.js', {
  './../logger': function() {
    return LoggerStub;
  },
  './../utils': utilsStub
});

describe('keys', function() {
  beforeEach(function() {
    LoggerStub.log.reset();
    Keys._storj = {
      PrivateClient: sinon.stub().returns(clientStub)
    };
  });

  describe('#list', function() {
    it('should log an error if the client responds with one', function() {
      var errMsg = 'this is an error';
      clientStub.getPublicKeys =
        sinon.stub().callsArgWith(0, new Error(errMsg));

      Keys.list();

      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should print information about each public key', function() {
      var keyList = [{key: 'testkey1'}, {key: 'testkey2'}, {key: 'testKey3'}];
      clientStub.getPublicKeys =
        sinon.stub().callsArgWith(0, null, keyList);

      Keys.list();

      expect(LoggerStub.log.callCount).to.equal(keyList.length);
      keyList.forEach(function(key) {
        expect(LoggerStub.log.calledWithMatch('info', key.key)).to.equal(true);
      });
    });
  });

  describe('#add', function() {
    it('should log an error if the client responds with one', function() {
      var errMsg = 'this is an error';
      clientStub.addPublicKey =
        sinon.stub().callsArgWith(1, new Error(errMsg));
      var testPubKey = 'testpubkey';

      Keys.add(testPubKey);

      expect(clientStub.addPublicKey.calledWithMatch(testPubKey,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should log a success message if the key is added', function() {
      clientStub.addPublicKey =
        sinon.stub().callsArg(1);
      var testPubKey = 'testpubkey';

      Keys.add(testPubKey);

      expect(clientStub.addPublicKey.calledWithMatch(testPubKey,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info',
        'Key successfully registered')).to.equal(true);
    });
  });

  describe('#remove', function() {
    it('should prompt the user if they did not use -f', function() {
      var errMsg = 'this is an error';
      clientStub.destroyPublicKey =
        sinon.stub().callsArgWith(1, new Error(errMsg));
      utilsStub.getConfirmation = sinon.stub();
      var testPubKey = 'testpubkey';
      var testEnv = {};

      Keys.remove(testPubKey, testEnv);

      expect(utilsStub.getConfirmation.callCount).to.equal(1);
      expect(utilsStub.getConfirmation.calledWithMatch(
        'Are you sure you want to invalidate the public key?',
        sinon.match.func)).to.equal(true);
    });

    it('should log an error if the client responds with one', function() {
      var errMsg = 'this is an error';
      clientStub.destroyPublicKey =
        sinon.stub().callsArgWith(1, new Error(errMsg));
      var testPubKey = 'testpubkey';
      var testEnv = {
        force: true
      };

      Keys.remove(testPubKey, testEnv);

      expect(clientStub.destroyPublicKey.calledWithMatch(testPubKey,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should log a success message if the key is removed', function() {
      clientStub.destroyPublicKey =
        sinon.stub().callsArg(1);
      var testPubKey = 'testpubkey';
      var testEnv = {
        force: true
      };

      Keys.remove(testPubKey, testEnv);

      expect(clientStub.destroyPublicKey.calledWithMatch(testPubKey,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info',
        'Key successfully revoked')).to.equal(true);
    });
  });
});
