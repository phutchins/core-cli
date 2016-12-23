'use strict';
/* jshint maxstatements: 20 */
var expect = require('chai').expect;
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var stream = require('stream');

var promptStub = {};
var tmpStub = {};
var storjStub = {};
var fsStub = {};
var rimrafStub = {};
var LoggerStub = {
  log: sinon.stub()
};

var clock;

var Utils = proxyquire('../bin/utils.js', {
  './logger': function() {
    return LoggerStub;
  },
  'prompt': promptStub,
  'tmp': tmpStub,
  'storj-lib': storjStub,
  'fs': fsStub,
  'rimraf': rimrafStub
});

describe('utils', function() {
  beforeEach(function() {
    LoggerStub.log.reset();
  });

  describe('#getConfirmation', function() {
    it('should call the callback if the user responds with yes', function() {
      var result = {
        confirm: 'y'
      };
      var testMessage = 'test message';
      var promptProperties = {
        properties: {
          confirm: {
            description: testMessage + ' (y/n)',
            required: true
          }
        }
      };
      var cb = sinon.stub();
      promptStub.start = sinon.stub();
      promptStub.get = sinon.stub().callsArgWith(1, null, result);

      Utils.getConfirmation(testMessage, cb);

      expect(promptStub.get.calledWithMatch(promptProperties,
        sinon.match.func)).to.equal(true);
      expect(cb.callCount).to.equal(1);
    });

    it('should not callback if the user responds with no', function() {
      var result = {
        confirm: 'n'
      };
      var testMessage = 'test message';
      var promptProperties = {
        properties: {
          confirm: {
            description: testMessage + ' (y/n)',
            required: true
          }
        }
      };
      var cb = sinon.stub();
      promptStub.start = sinon.stub();
      promptStub.get = sinon.stub().callsArgWith(1, null, result);

      Utils.getConfirmation(testMessage, cb);

      expect(promptStub.get.calledWithMatch(promptProperties,
        sinon.match.func)).to.equal(true);
      expect(cb.callCount).to.equal(0);
    });
  });

  describe('#getNewPassword', function() {
    it('should properly prompt the user to set their password', function() {
      var testMessage = 'test message';
      var promptProperties = {
        properties: {
          password: {
            description: testMessage,
            required: true,
            replace: '*',
            hidden: true
          }
        }
      };
      var cb = sinon.stub();
      promptStub.start = sinon.stub();
      promptStub.get = sinon.stub().callsArg(1);

      Utils.getNewPassword(testMessage, cb);

      expect(promptStub.get.calledWithMatch(promptProperties,
        sinon.match.func)).to.equal(true);
      expect(cb.callCount).to.equal(1);
    });
  });

  describe('#makeTempDir', function() {
    it('should properly create the tempdir and return a cleanup function',
      function() {
      var cb = sinon.stub();
      var cleanupCallback = sinon.stub();
      var testErr = new Error('this is an error');
      var testPath = '/test/path';
      storjStub.utils = {
        tmpdir: sinon.stub().returns('test')
      };
      var options = {
        dir: storjStub.utils.tmpdir(),
        prefix: 'storj-',
        // 0700.
        mode: 448,
        // require manual cleanup.
        keep: true,
        unsafeCleanup: true
      };

      tmpStub.dir = sinon.stub().callsArgWith(1, testErr, testPath,
        cleanupCallback);

      Utils.makeTempDir(cb);

      expect(tmpStub.dir.calledWithMatch(options,
        sinon.match.func)).to.equal(true);
      expect(cb.callCount).to.equal(1);
      expect(cb.calledWithMatch(testErr, testPath,
        sinon.match.func)).to.equal(true);
      var cleanCb = cb.getCall(0).args[2];
      expect(cleanupCallback.callCount).to.equal(0);
      cleanCb();
      expect(cleanupCallback.callCount).to.equal(1);
    });
  });

  describe('#getCredentials', function() {
    it('should prompt the user for credentials and call the callback',
      function() {
      var promptProperties = {
        properties: {
          email: {
            description: 'Enter your email address',
            required: true
          },
          password: {
            description: 'Enter your password',
            required: true,
            replace: '*',
            hidden: true
          }
        }
      };
      var cb = sinon.stub();
      promptStub.start = sinon.stub();
      promptStub.get = sinon.stub().callsArg(1);

      Utils.getCredentials(cb);

      expect(promptStub.get.calledWithMatch(promptProperties,
        sinon.match.func)).to.equal(true);
      expect(cb.callCount).to.equal(1);

    });
  });

  describe('#getKeyRing', function() {
    it('should return the keyring if a correct keypass is passed in',
      function() {
      var testKeyPass = 'testkeypass';
      var testKeyRing = {};
      var cb = sinon.stub();
      storjStub.KeyRing = sinon.stub().returns(testKeyRing);

      Utils.getKeyRing(testKeyPass, cb);

      expect(storjStub.KeyRing.calledWithMatch(sinon.match.any,
        testKeyPass)).to.equal(true);
      expect(cb.calledWithMatch(testKeyRing)).to.equal(true);
    });

    it('should log an error if an incorrect keypass is passed in', function() {
      var testKeyPass = 'testkeypass';
      var err = new Error('this is an error');
      var cb = sinon.stub();
      storjStub.KeyRing = sinon.stub().throws(err);

      Utils.getKeyRing(testKeyPass, cb);

      expect(storjStub.KeyRing.calledWithMatch(sinon.match.any,
        testKeyPass)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        'Could not unlock keyring')).to.equal(true);
    });

    it('should prompt the user to protect their keyring if DATADIR does not ' +
      'exist', function() {
      var cb = sinon.stub();
      storjStub.KeyRing = sinon.stub();
      storjStub.utils = {
        existsSync: sinon.stub().returns(false)
      };
      promptStub.start = sinon.stub();
      promptStub.get = sinon.stub();
      var promptProperties = {
        properties: {
          passphrase: {
            description: 'Enter a passphrase to protect your keyring',
            replace: '*',
            hidden: true,
            default: '',
            required: true
          }
        }
      };

      Utils.getKeyRing(null, cb);

      expect(promptStub.get.calledWithMatch(promptProperties,
        sinon.match.func)).to.equal(true);
    });

    it('should prompt the user to unlock their keyring if DATADIR does exist',
      function() {
      var cb = sinon.stub();
      storjStub.KeyRing = sinon.stub();
      storjStub.utils = {
        existsSync: sinon.stub().returns(true)
      };
      promptStub.start = sinon.stub();
      promptStub.get = sinon.stub();
      var promptProperties = {
        properties: {
          passphrase: {
            description: 'Enter your passphrase to unlock your keyring',
            replace: '*',
            hidden: true,
            default: '',
            required: true
          }
        }
      };

      Utils.getKeyRing(null, cb);

      expect(promptStub.get.calledWithMatch(promptProperties,
        sinon.match.func)).to.equal(true);
    });

    it('should log an error if the prompt responds with one', function() {
      var cb = sinon.stub();
      var err = new Error('this is an error');
      storjStub.KeyRing = sinon.stub();
      storjStub.utils = {
        existsSync: sinon.stub().returns(true)
      };
      promptStub.start = sinon.stub();
      promptStub.get = sinon.stub().callsArgWith(1, err);

      Utils.getKeyRing(null, cb);

      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log an error if the keyring responds with one', function() {
      var cb = sinon.stub();
      var testResult = {passphrase: 'testpassphrase'};
      var err = new Error('this is an error');
      storjStub.KeyRing = sinon.stub().throws(err);
      storjStub.utils = {
        existsSync: sinon.stub().returns(true)
      };
      promptStub.start = sinon.stub();
      promptStub.get = sinon.stub().callsArgWith(1, null, testResult);

      Utils.getKeyRing(null, cb);

      expect(storjStub.KeyRing.calledWithMatch(sinon.match.any,
        testResult.passphrase)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        'Could not unlock keyring')).to.equal(true);
    });

    it('should return the keyring if there is no error', function() {
      var cb = sinon.stub();
      var testResult = {passphrase: 'testpassphrase'};
      var testKeyRing = {};
      storjStub.KeyRing = sinon.stub().returns(testKeyRing);
      storjStub.utils = {
        existsSync: sinon.stub().returns(true)
      };
      promptStub.start = sinon.stub();
      promptStub.get = sinon.stub().callsArgWith(1, null, testResult);

      Utils.getKeyRing(null, cb);

      expect(storjStub.KeyRing.calledWithMatch(sinon.match.any,
        testResult.passphrase)).to.equal(true);
      expect(cb.calledWithMatch(testKeyRing)).to.equal(true);
    });
  });

  describe('#importkeyring', function() {
    before(function() {
      Utils.oldGetKeyRing = Utils.getKeyRing;
      Utils.oldGetNewPassword = Utils.getNewPassword;
    });
    after(function() {
      Utils.getKeyRing = Utils.oldGetKeyRing;
      Utils.getNewPassword = Utils.oldGetNewPassword;
    });

    it('should log an error if the path does not exist', function() {
      var testPath = '/test/path';
      var testKeyPass = 'testkeypass';
      var testKeyRing = {};
      var err = new Error('this is an error');
      err.code = 'ENOENT';
      Utils._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      Utils.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      fsStub.statSync = sinon.stub().throws(err);

      Utils.importkeyring(testPath);

      expect(Utils.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(fsStub.statSync.calledWithMatch(testPath)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        'The supplied tarball does not exist')).to.equal(true);
    });

    it('should log an error if statSync throws an error', function() {
      var testPath = '/test/path';
      var testKeyPass = 'testkeypass';
      var testKeyRing = {};
      var err = new Error('this is an error');
      Utils._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      Utils.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      fsStub.statSync = sinon.stub().throws(err);

      Utils.importkeyring(testPath);

      expect(Utils.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(fsStub.statSync.calledWithMatch(testPath)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log an error if getNewPassword responds with one', function() {
      var testPath = '/test/path';
      var testKeyPass = 'testkeypass';
      var testKeyRing = {};
      var err = new Error('this is an error');
      Utils._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      Utils.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      fsStub.statSync = sinon.stub();
      Utils.getNewPassword = sinon.stub().callsArgWith(1, err);

      Utils.importkeyring(testPath);

      expect(Utils.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(fsStub.statSync.calledWithMatch(testPath)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log an error if importing the keyring fails', function() {
      var testPath = '/test/path';
      var testKeyPass = 'testkeypass';
      var err = new Error('this is an error');
      var testKeyRing = {
        import: sinon.stub().callsArgWith(2, err)
      };
      Utils._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      Utils.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      fsStub.statSync = sinon.stub();
      var testResult = {password: 'testpassword'};
      Utils.getNewPassword = sinon.stub().callsArgWith(1, null, testResult);

      Utils.importkeyring(testPath);

      expect(Utils.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(fsStub.statSync.calledWithMatch(testPath)).to.equal(true);
      expect(testKeyRing.import.calledWithMatch(testPath, testResult.password,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log a success message if importing the keyring succeeds',
      function() {
      var testPath = '/test/path';
      var testKeyPass = 'testkeypass';
      var testKeyRing = {
        import: sinon.stub().callsArg(2)
      };
      Utils._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      Utils.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      fsStub.statSync = sinon.stub();
      var testResult = {password: 'testpassword'};
      Utils.getNewPassword = sinon.stub().callsArgWith(1, null, testResult);

      Utils.importkeyring(testPath);

      expect(Utils.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(fsStub.statSync.calledWithMatch(testPath)).to.equal(true);
      expect(testKeyRing.import.calledWithMatch(testPath, testResult.password,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info',
        'Key ring imported successfully')).to.equal(true);
    });
  });

  describe('#exportkeyring', function() {
    before(function() {
      Utils.oldGetKeyRing = Utils.getKeyRing;
      var now = new Date();
      clock = sinon.useFakeTimers(now.getTime());
    });
    after(function() {
      Utils.getKeyRing = Utils.oldGetKeyRing;
      clock.restore();
    });

    it('should log an error if the directory does not exist', function() {
      var testDirectory = '/test/directory';
      var testKeyPass = 'testkeypass';
      var testKeyRing = {
        export: sinon.stub()
      };
      Utils._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      Utils.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      var err = new Error('this is an error');
      err.code = 'ENOENT';
      fsStub.statSync = sinon.stub().throws(err);

      Utils.exportkeyring(testDirectory);

      expect(Utils.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(fsStub.statSync.calledWithMatch(testDirectory)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        'The supplied directory does not exist')).to.equal(true);
    });

    it('should log an error if the path is not a directory', function() {
      var testDirectory = '/test/directory';
      var testKeyPass = 'testkeypass';
      var testKeyRing = {
        export: sinon.stub()
      };
      Utils._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      Utils.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      var testStat = {
        isDirectory: sinon.stub().returns(false)
      };
      fsStub.statSync = sinon.stub().returns(testStat);

      Utils.exportkeyring(testDirectory);

      expect(Utils.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(fsStub.statSync.calledWithMatch(testDirectory)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        'The path must be a directory')).to.equal(true);
    });

    it('should log an error if the keyring export function returns one',
      function() {
      var testDirectory = '/test/directory';
      var testKeyPass = 'testkeypass';
      var err = new Error('this is an error');
      var tarball = testDirectory + '/keyring.bak.' + Date.now() + '.tgz';
      var testKeyRing = {
        export: sinon.stub().callsArgWith(1, err)
      };
      Utils._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      Utils.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      var testStat = {
        isDirectory: sinon.stub().returns(true)
      };
      fsStub.statSync = sinon.stub().returns(testStat);

      Utils.exportkeyring(testDirectory);

      expect(Utils.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(fsStub.statSync.calledWithMatch(testDirectory)).to.equal(true);
      expect(testKeyRing.export.calledWithMatch(tarball,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log a success message if the export function works', function() {
      var testDirectory = '/test/directory';
      var testKeyPass = 'testkeypass';
      var tarball = testDirectory + '/keyring.bak.' + Date.now() + '.tgz';
      var testKeyRing = {
        export: sinon.stub().callsArg(1)
      };
      Utils._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      Utils.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      var testStat = {
        isDirectory: sinon.stub().returns(true)
      };
      fsStub.statSync = sinon.stub().returns(testStat);

      Utils.exportkeyring(testDirectory);

      expect(Utils.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(fsStub.statSync.calledWithMatch(testDirectory)).to.equal(true);
      expect(testKeyRing.export.calledWithMatch(tarball,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info',
        'Key ring backed up to %s', [tarball])).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info',
        'Don\'t forget the password for this keyring!')).to.equal(true);
    });
  });

  describe('#changekeyring', function() {
    before(function() {
      Utils.oldGetKeyRing = Utils.getKeyRing;
    });
    after(function() {
      Utils.getKeyRing = Utils.oldGetKeyRing;
    });

    it('should prompt the user to enter a new password', function() {
      var testKeyPass = 'testkeypass';
      var testKeyRing = {
        reset: sinon.stub()
      };
      Utils._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      var promptProperties = {
        properties: {
          passphrase: {
            description: 'Enter a new password for your keyring',
            replace: '*',
            hidden: true,
            default: ''
          }
        }
      };
      Utils.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      promptStub.start = sinon.stub();
      promptStub.get = sinon.stub();

      Utils.changekeyring();

      expect(Utils.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(promptStub.start.callCount).to.equal(1);
      expect(promptStub.get.calledWithMatch(promptProperties,
        sinon.match.func)).to.equal(true);
    });

    it('should log an error if the prompt responds with one', function() {
      var testKeyPass = 'testkeypass';
      var testKeyRing = {
        reset: sinon.stub()
      };
      Utils._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };

      Utils.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      promptStub.start = sinon.stub();
      var err = new Error('this is an error');
      promptStub.get = sinon.stub().callsArgWith(1, err);

      Utils.changekeyring();

      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log an error if keyring.reset responds with one', function() {
      var testKeyPass = 'testkeypass';
      var err = new Error('this is an error');
      var testKeyRing = {
        reset: sinon.stub().callsArgWith(1, err)
      };
      Utils._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };

      Utils.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      promptStub.start = sinon.stub();
      var testResult = {passphrase: 'testpassphrase'};
      promptStub.get = sinon.stub().callsArgWith(1, null, testResult);

      Utils.changekeyring();

      expect(testKeyRing.reset.calledWithMatch(testResult.passphrase,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log a success message if keyring.reset succeeds', function() {
      var testKeyPass = 'testkeypass';
      var testKeyRing = {
        reset: sinon.stub().callsArg(1)
      };
      Utils._storj = {
        getKeyPass: sinon.stub().returns(testKeyPass)
      };

      Utils.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      promptStub.start = sinon.stub();
      var testResult = {passphrase: 'testpassphrase'};
      promptStub.get = sinon.stub().callsArgWith(1, null, testResult);

      Utils.changekeyring();

      expect(testKeyRing.reset.calledWithMatch(testResult.passphrase,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info',
        'Password for keyring has been reset')).to.equal(true);
    });
  });

  describe('#resetkeyring', function() {
    before(function() {
      Utils.oldGetConfirmation = Utils.getConfirmation;
      Utils.oldGetNewPassword = Utils.getNewPassword;
    });
    after(function() {
      Utils.getConfirmation = Utils.oldGetConfirmation;
      Utils.getNewPassword = Utils.oldGetNewPassword;
    });

    it('should prompt the user for confirmation twice', function() {
      Utils.getConfirmation = sinon.stub().callsArg(1);
      rimrafStub.sync = sinon.stub();
      Utils.getNewPassword = sinon.stub();

      Utils.resetkeyring();

      expect(Utils.getConfirmation.callCount).to.equal(2);
      expect(Utils.getConfirmation.calledWithMatch(
        'Are you sure you want to destroy your keyring?',
        sinon.match.func)).to.equal(true);
      expect(Utils.getConfirmation.calledWithMatch(
        'Are you REALLY sure you want to destroy your keyring?',
        sinon.match.func)).to.equal(true);
      expect(rimrafStub.sync.callCount).to.equal(1);
    });

    it('should log an error if there is a problem creating a new key ring',
      function() {
      Utils.getConfirmation = sinon.stub().callsArg(1);
      rimrafStub.sync = sinon.stub();
      var err = new Error('this is an error');
      storjStub.KeyRing = sinon.stub().throws(err);
      var testResult = {password: 'testpassword'};
      Utils.getNewPassword = sinon.stub().callsArgWith(1, null, testResult);

      Utils.resetkeyring();

      expect(storjStub.KeyRing.calledWithMatch(sinon.match.any,
        testResult.password)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        'Could not create keyring')).to.equal(true);
    });

    it('should log a success message if a new key ring is successfully created',
      function() {
      Utils.getConfirmation = sinon.stub().callsArg(1);
      rimrafStub.sync = sinon.stub();
      storjStub.KeyRing = sinon.stub();
      var testResult = {password: 'testpassword'};
      Utils.getNewPassword = sinon.stub().callsArgWith(1, null, testResult);

      Utils.resetkeyring();

      expect(storjStub.KeyRing.calledWithMatch(sinon.match.any,
        testResult.password)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info',
        'Successfully created a new key ring')).to.equal(true);
    });
  });

  describe('#generatekey', function() {
    it('should log information about the new key', function() {
      var testKeyPair = {
        privateKey: 'testprivatekey',
        publicKey: 'testpublickey',
        nodeID: 'testnodeid',
        address: 'testaddress'
      };
      testKeyPair.getPrivateKey = sinon.stub().returns(testKeyPair.privateKey);
      testKeyPair.getPublicKey = sinon.stub().returns(testKeyPair.publicKey);
      testKeyPair.getNodeID = sinon.stub().returns(testKeyPair.nodeID);
      testKeyPair.getAddress = sinon.stub().returns(testKeyPair.address);

      storjStub.KeyPair = sinon.stub().returns(testKeyPair);
      var testEnv = {};

      Utils.generatekey(testEnv);

      expect(LoggerStub.log.calledWithMatch('info', 'Private',
        [testKeyPair.privateKey])).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info', 'Public',
        [testKeyPair.publicKey])).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info', 'NodeID',
        [testKeyPair.nodeID])).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info', 'Address',
        [testKeyPair.address])).to.equal(true);
    });

    it('should encrypt the private key if a passpharase is provided',
      function() {
      var testKeyPair = {
        privateKey: 'testprivatekey',
        publicKey: 'testpublickey',
        nodeID: 'testnodeid',
        address: 'testaddress'
      };
      testKeyPair.getPrivateKey = sinon.stub().returns(testKeyPair.privateKey);
      testKeyPair.getPublicKey = sinon.stub().returns(testKeyPair.publicKey);
      testKeyPair.getNodeID = sinon.stub().returns(testKeyPair.nodeID);
      testKeyPair.getAddress = sinon.stub().returns(testKeyPair.address);

      storjStub.KeyPair = sinon.stub().returns(testKeyPair);
      storjStub.utils = {
        existsSync: sinon.stub().returns(false),
        simpleEncrypt: sinon.stub().returns('encryptedprivkey')
      };
      fsStub.writeFileSync = sinon.stub();
      var testEnv = {
        save: '/test/directory',
        encrypt: 'testpassword'
      };

      Utils.generatekey(testEnv);

      expect(storjStub.utils.simpleEncrypt.calledWithMatch(testEnv.encrypt,
        testKeyPair.privateKey)).to.equal(true);
      expect(fsStub.writeFileSync.calledWithMatch(testEnv.save,
        'encryptedprivkey')).to.equal(true);
    });

    it('should log an error if the save path already exists', function() {
      var testKeyPair = {
        privateKey: 'testprivatekey',
        publicKey: 'testpublickey',
        nodeID: 'testnodeid',
        address: 'testaddress'
      };
      testKeyPair.getPrivateKey = sinon.stub().returns(testKeyPair.privateKey);
      testKeyPair.getPublicKey = sinon.stub().returns(testKeyPair.publicKey);
      testKeyPair.getNodeID = sinon.stub().returns(testKeyPair.nodeID);
      testKeyPair.getAddress = sinon.stub().returns(testKeyPair.address);

      storjStub.KeyPair = sinon.stub().returns(testKeyPair);
      storjStub.utils = {
        existsSync: sinon.stub().returns(true)
      };
      fsStub.writeFileSync = sinon.stub();
      var testEnv = {
        save: '/test/directory'
      };

      Utils.generatekey(testEnv);

      expect(storjStub.utils.existsSync.calledWithMatch(
        testEnv.save)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        'Save path already exists, refusing overwrite')).to.equal(true);
    });

    it('should log a success message if the private key is successfully saved',
      function() {
      var testKeyPair = {
        privateKey: 'testprivatekey',
        publicKey: 'testpublickey',
        nodeID: 'testnodeid',
        address: 'testaddress'
      };
      testKeyPair.getPrivateKey = sinon.stub().returns(testKeyPair.privateKey);
      testKeyPair.getPublicKey = sinon.stub().returns(testKeyPair.publicKey);
      testKeyPair.getNodeID = sinon.stub().returns(testKeyPair.nodeID);
      testKeyPair.getAddress = sinon.stub().returns(testKeyPair.address);

      storjStub.KeyPair = sinon.stub().returns(testKeyPair);
      storjStub.utils = {
        existsSync: sinon.stub().returns(false)
      };
      fsStub.writeFileSync = sinon.stub();
      var testEnv = {
        save: '/test/directory'
      };

      Utils.generatekey(testEnv);

      expect(fsStub.writeFileSync.calledWithMatch(testEnv.save,
        testKeyPair.privateKey)).to.equal(true);
    });
  });

  describe('#signmessage', function() {
    it('should log an error if private key is invalid', function() {
      var testPrivateKey = 'testprivatekey';
      var testMessage = 'testmessage';
      var testEnv = {};
      var err = new Error('this is an error');
      storjStub.KeyPair = sinon.stub().throws(err);

      Utils.signmessage(testPrivateKey, testMessage, testEnv);

      expect(storjStub.KeyPair.calledWithMatch(testPrivateKey)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        'Invalid private key supplied')).to.equal(true);
    });

    it('should log an error if the message cannot be signed', function() {
      var testPrivateKey = 'testprivatekey';
      var testMessage = 'testmessage';
      var testEnv = {};
      var err = new Error('this is an error');
      var testKeyPair = {
        sign: sinon.stub().throws(err)
      };
      storjStub.KeyPair = sinon.stub().returns(testKeyPair);

      Utils.signmessage(testPrivateKey, testMessage, testEnv);

      expect(storjStub.KeyPair.calledWithMatch(testPrivateKey)).to.equal(true);
      expect(testKeyPair.sign.calledWithMatch(testMessage,
        sinon.match.any)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        'Failed to sign message', [err.message])).to.equal(true);
    });

    it('should log a signature on success if compact is set', function() {
      var testPrivateKey = 'testprivatekey';
      var testMessage = 'testmessage';
      var testEnv = {compact: true};
      var testSignature = 'testsignature';
      var testKeyPair = {
        sign: sinon.stub().returns(testSignature)
      };
      storjStub.KeyPair = sinon.stub().returns(testKeyPair);

      Utils.signmessage(testPrivateKey, testMessage, testEnv);

      expect(storjStub.KeyPair.calledWithMatch(testPrivateKey)).to.equal(true);
      expect(testKeyPair.sign.calledWithMatch(testMessage,
        {compact: true})).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info', 'Signature',
        ['compact', testSignature])).to.equal(true);
    });

    it('should log a signature on success if compact is not set', function() {
      var testPrivateKey = 'testprivatekey';
      var testMessage = 'testmessage';
      var testEnv = {compact: false};
      var testSignature = 'testsignature';
      var testKeyPair = {
        sign: sinon.stub().returns(testSignature)
      };
      storjStub.KeyPair = sinon.stub().returns(testKeyPair);

      Utils.signmessage(testPrivateKey, testMessage, testEnv);

      expect(storjStub.KeyPair.calledWithMatch(testPrivateKey)).to.equal(true);
      expect(testKeyPair.sign.calledWithMatch(testMessage,
        {compact: false})).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info', 'Signature',
        ['complete', testSignature])).to.equal(true);
    });
  });

  describe('#prepareaudits', function() {
    it('should log an error if there is a problem creating the audit stream',
      function() {
      var num = 10;
      var filepath = '/test/file/path';
      var err = new Error('this is an error');
      storjStub.AuditStream = sinon.stub().throws(err);

      Utils.prepareaudits(num, filepath);

      expect(storjStub.AuditStream.calledWithMatch(num)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log an error if there is a problem creating the input stream',
      function() {
      var num = 10;
      var filepath = '/test/file/path';
      var testAuditStream = stream.Writable();
      storjStub.AuditStream = sinon.stub().returns(testAuditStream);
      var err = new Error('this is an error');
      fsStub.createReadStream = sinon.stub().throws(err);

      Utils.prepareaudits(num, filepath);

      expect(storjStub.AuditStream.calledWithMatch(num)).to.equal(true);
      expect(fsStub.createReadStream.calledWithMatch(filepath)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log an error if the audit stream produces one',
      function() {
      var num = 10;
      var filepath = '/test/file/path';
      var testAuditStream = stream.Writable();
      storjStub.AuditStream = sinon.stub().returns(testAuditStream);
      var testReadStream = stream.Readable();
      fsStub.createReadStream = sinon.stub().returns(testReadStream);

      Utils.prepareaudits(num, filepath);

      var err = new Error('this is an error');
      testAuditStream.emit('error', err);

      expect(storjStub.AuditStream.calledWithMatch(num)).to.equal(true);
      expect(fsStub.createReadStream.calledWithMatch(filepath)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log information about the merkle tree when the audit completes',
      function(done) {
      var num = 10;
      var filepath = '/test/file/path';
      var testAuditStream = stream.Writable();
      storjStub.AuditStream = sinon.stub().returns(testAuditStream);
      var testReadStream = stream.Readable();
      fsStub.createReadStream = sinon.stub().returns(testReadStream);

      Utils.prepareaudits(num, filepath);

      var privateRecord = {
        root: 'testroot',
        challenges: [
          'testchallenge1',
          'testchallenge2',
          'testchallenge3'
        ]
      };
      var publicRecord = [
        'testleaf1',
        'testleaf2',
        'testleaf3'
      ];
      testAuditStream.getPrivateRecord = sinon.stub().returns(privateRecord);
      testAuditStream.getPublicRecord = sinon.stub().returns(publicRecord);
      testReadStream.push(null);

      setTimeout(function() {
        expect(storjStub.AuditStream.calledWithMatch(num)).to.equal(true);
        expect(fsStub.createReadStream.calledWithMatch(
          filepath)).to.equal(true);
        expect(LoggerStub.log.calledWithMatch('info',
          privateRecord.root)).to.equal(true);
        privateRecord.challenges.forEach(function(challenge) {
          expect(LoggerStub.log.calledWithMatch('info',
            challenge)).to.equal(true);
        });
        publicRecord.forEach(function(leaf) {
          expect(LoggerStub.log.calledWithMatch('info', leaf)).to.equal(true);
        });
        done();
      }, 50);
    });
  });

  describe('#provefile', function() {
    it('should log an error if there is a problem creatin the proof stream',
      function() {
      var leaves = 'testleaf1,testleaf2,testleaf3';
      var tree = ['testleaf1', 'testleaf2', 'testleaf3'];
      var challenge = 'testchallenge';
      var filepath = '/test/file/path';
      var err = new Error('this is an error');
      storjStub.ProofStream = sinon.stub().throws(err);

      Utils.provefile(leaves, challenge, filepath);

      expect(storjStub.ProofStream.calledWithMatch(tree,
        challenge)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log an error if there is a problem creating the input stream',
      function() {
      var leaves = 'testleaf1,testleaf2,testleaf3';
      var tree = ['testleaf1', 'testleaf2', 'testleaf3'];
      var challenge = 'testchallenge';
      var filepath = '/test/file/path';

      var testProofStream = stream.Writable();
      storjStub.ProofStream = sinon.stub().returns(testProofStream);
      var err = new Error('this is an error');
      fsStub.createReadStream = sinon.stub().throws(err);

      Utils.provefile(leaves, challenge, filepath);

      expect(storjStub.ProofStream.calledWithMatch(tree,
        challenge)).to.equal(true);
      expect(fsStub.createReadStream.calledWithMatch(filepath)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log an error if the proof stream emits one', function() {
      var leaves = 'testleaf1,testleaf2,testleaf3';
      var tree = ['testleaf1', 'testleaf2', 'testleaf3'];
      var challenge = 'testchallenge';
      var filepath = '/test/file/path';

      var testProofStream = stream.Writable();
      storjStub.ProofStream = sinon.stub().returns(testProofStream);
      var testReadStream = stream.Readable();
      fsStub.createReadStream = sinon.stub().returns(testReadStream);

      Utils.provefile(leaves, challenge, filepath);

      var err = new Error('this is an error');
      testProofStream.emit('error', err);

      expect(storjStub.ProofStream.calledWithMatch(tree,
        challenge)).to.equal(true);
      expect(fsStub.createReadStream.calledWithMatch(filepath)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log the challenge response for each piece of data piped ' +
      'into the proof stream', function(done) {
      var leaves = 'testleaf1,testleaf2,testleaf3';
      var tree = ['testleaf1', 'testleaf2', 'testleaf3'];
      var challenge = 'testchallenge';
      var filepath = '/test/file/path';

      var testProofStream = stream.Transform({transform:
        sinon.stub().callsArg(2)});
      storjStub.ProofStream = sinon.stub().returns(testProofStream);
      var testReadStream = stream.Readable({read: sinon.stub()});
      fsStub.createReadStream = sinon.stub().returns(testReadStream);

      Utils.provefile(leaves, challenge, filepath);

      var result = 'testresult';
      testProofStream.push(result);

      expect(storjStub.ProofStream.calledWithMatch(tree,
        challenge)).to.equal(true);
      expect(fsStub.createReadStream.calledWithMatch(filepath)).to.equal(true);
      setTimeout(function() {
        var actualResult = JSON.stringify(new Buffer(result));
        expect(LoggerStub.log.calledWithMatch('info',
          actualResult)).to.equal(true);
        done();
      }, 50);
    });
  });

  describe('#verifyproof', function() {
    it('should log an error if creation of the verifier fails', function() {
      var root = 'testroot';
      var depth = 10;
      var resp = '{"response":"testresponse"}';
      var err = new Error('this is an error');
      storjStub.Verification = sinon.stub().throws(err);

      Utils.verifyproof(root, depth, resp);

      expect(storjStub.Verification.calledWithMatch(
        JSON.parse(resp))).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log an error if the verify function fails', function() {
      var root = 'testroot';
      var depth = 10;
      var resp = '{"response":"testresponse"}';
      var err = new Error('this is an error');
      var verifier = {
        verify: sinon.stub().throws(err)
      };
      storjStub.Verification = sinon.stub().returns(verifier);

      Utils.verifyproof(root, depth, resp);

      expect(storjStub.Verification.calledWithMatch(
        JSON.parse(resp))).to.equal(true);
      expect(verifier.verify.calledWithMatch(root, depth)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        err.message)).to.equal(true);
    });

    it('should log a success message if the proof response is valid',
      function() {
      var root = 'testroot';
      var depth = 10;
      var resp = '{"response":"testresponse"}';
      var result = [1, 1];
      var verifier = {
        verify: sinon.stub().returns(result)
      };
      storjStub.Verification = sinon.stub().returns(verifier);

      Utils.verifyproof(root, depth, resp);

      expect(storjStub.Verification.calledWithMatch(
        JSON.parse(resp))).to.equal(true);
      expect(verifier.verify.calledWithMatch(root, depth)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info', 'Expected',
        [result[1]])).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info', 'Actual',
        [result[0]])).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info',
        'The proof response is valid')).to.equal(true);
    });

    it('should log an error if the proof response is not valid', function() {
      var root = 'testroot';
      var depth = 10;
      var resp = '{"response":"testresponse"}';
      var result = [0, 1];
      var verifier = {
        verify: sinon.stub().returns(result)
      };
      storjStub.Verification = sinon.stub().returns(verifier);

      Utils.verifyproof(root, depth, resp);

      expect(storjStub.Verification.calledWithMatch(
        JSON.parse(resp))).to.equal(true);
      expect(verifier.verify.calledWithMatch(root, depth)).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info', 'Expected',
        [result[1]])).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info', 'Actual',
        [result[0]])).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('error',
        'The proof response is not valid')).to.equal(true);
    });
  });
});
