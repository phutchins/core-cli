var expect = require('chai').expect;
var proxyquire = require('proxyquire');
var sinon = require('sinon');

var LoggerStub = {
  log: sinon.stub()
};
var utilsStub = {};
var storjStub = {};
var fsStub = {};

var Account = proxyquire('../../bin/actions/account.js', {
  './../logger': function() {
    return LoggerStub;
  },
  './../utils': utilsStub,
  'storj-lib': storjStub,
  'fs': fsStub
});

describe('account', function() {
  beforeEach(function() {
    LoggerStub.log.reset();
    for (var key in utilsStub) {
      delete utilsStub[key];
    }
    for (var key in storjStub) {
      delete storjStub[key];
    }
    for (var key in fsStub) {
      delete fsStub[key];
    }
  });

  describe('#getInfo', function() {
    it('should log an error if the client responds with an error', function() {
      var errorMessage = 'This is an error';
      var PublicClientStub = {
        getInfo: function(cb) {
          cb({message: errorMessage});
        }
      };
      Account._storj = {
        PublicClient: function() {
          return PublicClientStub;
        }
      };

      Account.getInfo();

      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errorMessage)).to.be.ok;
    });

    it('should log out title, description, version, and host of the client if there is no error', function() {
      var info = {
        info: {
          title: 'test title',
          description: 'test description',
          version: 'test version'
        },
        host: 'test host'
      };
      var PublicClientStub = {
        getInfo: function(cb) {
          cb(null, info);
        }
      };
      Account._storj = {
        PublicClient: function() {
          return PublicClientStub;
        }
      };

      Account.getInfo();

      expect(LoggerStub.log.callCount).to.equal(4);
      expect(LoggerStub.log.calledWithMatch('info', 'Title', [info.info.title])).to.be.ok;
      expect(LoggerStub.log.calledWithMatch('info', 'Description', [info.info.description])).to.be.ok;
      expect(LoggerStub.log.calledWithMatch('info', 'Version', [info.info.version])).to.be.ok;
      expect(LoggerStub.log.calledWithMatch('info', 'Host', [info.host])).to.be.ok;
    });
  });

  describe('#register', function() {
    it('should log an error if there is an problem getting the user\'s credentials', function() {
      var errorMessage = 'This is an error';
      utilsStub.getCredentials = function(cb) {
        cb({message: errorMessage});
      };

      Account.register();

      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errorMessage)).to.be.ok;
    });

    it('should log an error if there is a problem creating a new user', function() {
      var errorMessage = 'This is an error';
      var credentials = {email: 'testemail@something.com', password: 'testpassword'};
      utilsStub.getCredentials = function(cb) {
        cb(null, credentials);
      };
      var PublicClientStub = {
        createUser: function(newUser, cb) {
          cb({message: errorMessage});
        }
      };
      var createUserSpy = sinon.spy(PublicClientStub, 'createUser');
      Account._storj = {
        PublicClient: function() {
          return PublicClientStub;
        }
      };

      Account.register();

      expect(createUserSpy.callCount).to.equal(1);
      expect(createUserSpy.calledWithMatch({'email': credentials.email, 'password': credentials.password})).to.be.ok;
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errorMessage)).to.be.ok;
    });

    it('should log a "Registered" message when a user is successfully created', function() {
      var credentials = {email: 'testemail@something.com', password: 'testpassword'};
      utilsStub.getCredentials = function(cb) {
        cb(null, credentials);
      };
      var PublicClientStub = {
        createUser: function(newUser, cb) {
          cb();
        }
      };
      var createUserSpy = sinon.spy(PublicClientStub, 'createUser');
      Account._storj = {
        PublicClient: function() {
          return PublicClientStub;
        }
      };

      Account.register();

      expect(createUserSpy.callCount).to.equal(1);
      expect(createUserSpy.calledWithMatch({'email': credentials.email, 'password': credentials.password})).to.be.ok;
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info', 'Registered')).to.be.ok;
    });
  });

  describe('#login', function() {
    it('should log an error if a user is already logged in', function() {
      var keyPath = '/test/key/path';
      Account._storj.keypath = keyPath;
      storjStub.utils = {
        existsSync: sinon.stub().returns(true)
      };

      Account.login();

      expect(storjStub.utils.existsSync.callCount).to.equal(1);
      expect(storjStub.utils.existsSync.calledWithMatch(keyPath)).to.be.ok;
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', 'This device is already paired.')).to.be.ok;
    });

    it('should log an error if there is an problem getting the user\'s credentials', function() {
      var errorMessage = 'This is an error';
      utilsStub.getCredentials = function(cb) {
        cb({message: errorMessage});
      };
      storjStub.utils = {
        existsSync: sinon.stub().returns(false)
      };

      Account.login();

      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errorMessage)).to.be.ok;
    });

    it('should log an error if there is a problem adding a new public key to the client', function() {
      var errorMessage = 'This is an error';
      var testPubkey = 'test public key';
      var testUrl = 'http://testurl.com';
      var credentials = {email: 'testemail@something.com', password: 'testpassword'};
      utilsStub.getCredentials = function(cb) {
        cb(null, credentials);
      };
      var clientStub = {
        addPublicKey(pubkey, cb) {
          cb({message: errorMessage});
        }
      };
      var addPubKeySpy = sinon.spy(clientStub, 'addPublicKey');
      var keypairStub = {
        getPublicKey: sinon.stub().returns(testPubkey)
      }

      storjStub.utils = {
        existsSync: sinon.stub().returns(false)
      };
      storjStub.BridgeClient = sinon.stub().returns(clientStub);
      storjStub.KeyPair = sinon.stub().returns(keypairStub);
      Account._storj.getURL = sinon.stub().returns(testUrl);

      Account.login();

      expect(storjStub.BridgeClient.callCount).to.equal(1);
      expect(storjStub.BridgeClient.calledWithMatch(testUrl, {basicAuth: credentials})).to.be.ok;
      expect(addPubKeySpy.callCount).to.equal(1);
      expect(addPubKeySpy.calledWithMatch(testPubkey)).to.be.ok;
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errorMessage)).to.be.ok;
    });

    it('should successfully log in a user if there are no errors', function() {
      var testPubkey = 'test public key';
      var testPrivkey = 'test private key';
      var testIdPath = '/test/id/path';
      var testKeyPath = '/test/key/path';
      var testUrl = 'http://testurl.com';
      var credentials = {email: 'testemail@something.com', password: 'testpassword'};
      utilsStub.getCredentials = function(cb) {
        cb(null, credentials);
      };
      var clientStub = {
        addPublicKey(pubkey, cb) {
          cb();
        }
      };
      var addPubKeySpy = sinon.spy(clientStub, 'addPublicKey');
      var keypairStub = {
        getPublicKey: sinon.stub().returns(testPubkey),
        getPrivateKey: sinon.stub().returns(testPrivkey)
      }
      storjStub.utils = {
        existsSync: sinon.stub().returns(false)
      };
      storjStub.BridgeClient = sinon.stub().returns(clientStub);
      storjStub.KeyPair = sinon.stub().returns(keypairStub);
      Account._storj.getURL = sinon.stub().returns(testUrl);
      Account._storj.idpath = testIdPath;
      Account._storj.keypath = testKeyPath;
      fsStub.writeFileSync = sinon.stub();

      Account.login();

      expect(fsStub.writeFileSync.callCount).to.equal(2);
      expect(fsStub.writeFileSync.calledWithMatch(testIdPath, credentials.email)).to.be.ok;
      expect(fsStub.writeFileSync.calledWithMatch(testKeyPath, testPrivkey)).to.be.ok;
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info', 'This device has been successfully paired')).to.be.ok;
    });
  });

  describe('#logout', function() {
    it('should log an error if there is a problem revoking the key, but should still unpair the key', function() {
      expect(1).to.equal(3);
    });

    it('should successfully revoke and unpair the key if there is no error', function() {
      expect(1).to.equal(3);
    });
  });

  describe('#resetpassword', function() {
    it('should log an error if there is a problem resetting the password', function() {
      expect(1).to.equal(3);
    });

    it('should log a success message if the password reset request succeeds', function() {
      expect(1).to.equal(3);
    });
  });
});
