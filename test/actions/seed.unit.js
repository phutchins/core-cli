'use strict';
var expect = require('chai').expect;
var sinon = require('sinon');
var proxyquire = require('proxyquire');

var promptStub = {};
var utilsStub = {};
var LoggerStub = {
  log: sinon.stub()
};

var Seed = proxyquire('../../bin/actions/seed.js', {
  'prompt': promptStub,
  './../utils': utilsStub,
  './../logger': function() {
    return LoggerStub;
  }
});

describe('seed', function() {
  beforeEach(function() {
    LoggerStub.log.reset();
  });

  describe('#generateSeed', function() {
    it('should log an error if an error is thrown', function() {
      var testKeyPass = 'testkeypass';
      var err = new Error('this is an error');
      var testKeyRing = {
        generateDeterministicKey: sinon.stub().throws(err)
      };
      Seed._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);

      Seed.generateSeed();

      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log a success message if the key is successfully generated',
      function() {
      var testKeyPass = 'testkeypass';
      var testKeyRing = {
        generateDeterministicKey: sinon.stub()
      };
      Seed._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);

      Seed.generateSeed();

      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(testKeyRing.generateDeterministicKey.callCount).to.equal(1);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info',
        'Seed successfully generated')).to.equal(true);
    });
  });

  describe('#printSeed', function() {
    it('should indicate if no seed has been generated or imported', function() {
      var testKeyPass = 'testkeypass';
      var testKeyRing = {
        exportMnemonic: sinon.stub().returns(null)
      };
      Seed._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);

      Seed.printSeed();

      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info',
        'Seed has not been generated or imported')).to.equal(true);
    });

    it('should log the mnemonic if a seed has been generated or imported',
      function() {
      var testKeyPass = 'testkeypass';
      var mnemonic = 'this is a test mnemonic';
      var testKeyRing = {
        exportMnemonic: sinon.stub().returns(mnemonic)
      };
      Seed._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);

      Seed.printSeed();

      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info', mnemonic)).to.equal(true);
    });
  });

  describe('#importSeed', function() {
    it('should log an error if the key already exists', function() {
      var testKeyPass = 'testkeypass';
      var mnemonic = 'this is a test mnemonic';
      var testKeyRing = {
        exportMnemonic: sinon.stub().returns(mnemonic)
      };
      Seed._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);

      Seed.importSeed();

      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error',
        'Mnemonic already exists')).to.equal(true);
    });

    it('should log an error if there is a problem importing the key',
      function() {
      var testKeyPass = 'testkeypass';
      var mnemonic = 'this is a test mnemonic';
      var err = new Error('this is an error');
      promptStub.start = sinon.stub();
      promptStub.get = sinon.stub().callsArgWith(1, null, {mnemonic: mnemonic});
      var testKeyRing = {
        exportMnemonic: sinon.stub().returns(null),
        importMnemonic: sinon.stub().throws(err)
      };
      Seed._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      var promptInput = {
        properties: {
          mnemonic: {
            description: 'Please enter mnemonic:',
            required: true
          }
        }
      };

      Seed.importSeed();

      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(promptStub.get.calledWithMatch(promptInput,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log a success message if the key is properly imported',
      function() {
      var testKeyPass = 'testkeypass';
      var mnemonic = 'this is a test mnemonic';
      promptStub.start = sinon.stub();
      promptStub.get = sinon.stub().callsArgWith(1, null, {mnemonic: mnemonic});
      var testKeyRing = {
        exportMnemonic: sinon.stub().returns(null),
        importMnemonic: sinon.stub()
      };
      Seed._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      var promptInput = {
        properties: {
          mnemonic: {
            description: 'Please enter mnemonic:',
            required: true
          }
        }
      };

      Seed.importSeed();

      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(promptStub.get.calledWithMatch(promptInput,
        sinon.match.func)).to.equal(true);
      expect(testKeyRing.importMnemonic.calledWithMatch(
        mnemonic)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info',
        'Mnemonic successfully imported')).to.equal(true);
    });
  });

  describe('#deleteSeed', function() {
    it('should properly delete the seed', function() {
      var testKeyPass = 'testkeypass';
      var testKeyRing = {
        deleteDeterministicKey: sinon.stub()
      };
      Seed._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);

      Seed.deleteSeed();

      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(testKeyRing.deleteDeterministicKey.callCount).to.equal(1);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info',
        'Mnemonic successfully deleted')).to.equal(true);
    });
  });
});
