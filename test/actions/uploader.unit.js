'use strict';
/* jshint maxstatements: 30 */
var expect = require('chai').expect;
var proxyquire = require('proxyquire');
var sinon = require('sinon');

var sandbox;

var LoggerStub = {
  log: sinon.stub()
};
var utilsStub = {};
var clientStub = {};
var fsStub = {};
var storjStub = {};
var globuleStub = {};

var testClient = sinon.stub().returns(clientStub);
var testBucket = 'testbucket';
var testOptions = {
  keypass: 'testkeypass',
  filepath: 'test/file/path',
  env: {
    concurrency: 3,
    fileconcurrency: 2
  }
};
var testFiles = [
  'test/file/path/file1',
  'test/file/path/file2',
  'test/file/path/file3'
];

var Uploader = proxyquire('../../bin/actions/uploader.js', {
  './../logger': function() {
    return LoggerStub;
  },
  './../utils': utilsStub,
  'fs': fsStub,
  'globule': globuleStub,
  'storj-lib': storjStub
});

var uploader;

describe('uploader', function() {
  beforeEach(function() {
    LoggerStub.log.reset();
    testClient.reset();
  });

  describe('@constructor', function() {
    before(function() {
      sandbox = sinon.sandbox.create();
      Uploader.oldValidate = Uploader.prototype._validate;
      Uploader.prototype._validate = sinon.stub();
      Uploader.oldGetAllFiles = Uploader.prototype._getAllFiles;
      Uploader.prototype._getAllFiles = sinon.stub().returns(testFiles);
    });
    beforeEach(function() {
      Uploader.prototype._validate.reset();
      Uploader.prototype._getAllFiles.reset();
    });
    after(function() {
      Uploader.prototype._validate = Uploader.oldValidate;
      delete Uploader.oldValidate;
      Uploader.prototype._getAllFiles = Uploader.oldGetAllFiles;
      delete Uploader.oldGetAllFiles;
      sandbox.restore();
    });

    it('should create an instance without the new keyword', function() {
      expect(Uploader(testClient, testBucket, testOptions))
        .to.be.instanceOf(Uploader);
    });

    it('should properly set all instance variables and validate', function() {
      uploader = new Uploader(testClient, testBucket, testOptions);

      expect(uploader.shardConcurrency)
        .to.equal(testOptions.env.concurrency);
      expect(uploader.fileConcurrency)
        .to.equal(testOptions.env.fileconcurrency);
      expect(uploader.bucket).to.equal(testBucket);
      expect(uploader.client).to.equal(clientStub);
      expect(testClient.calledWithMatch({
        transferConcurrency: testOptions.env.concurrency,
        requestTimeout: 10000
      })).to.equal(true);
      expect(uploader.keypass).to.equal(testOptions.keypass);
      expect(uploader.filepaths).to.equal(testFiles);
      expect(uploader.fileCount).to.equal(testFiles.length);
      expect(uploader.uploadedCount).to.equal(0);
      expect(uploader.fileMeta).to.deep.equal([]);
      expect(uploader.nextFileCallback).to.deep.equal({});
      expect(uploader._validate.callCount).to.equal(1);
    });

    it('should properly set concurrency instance variables if they are not ' +
      'set in options', function() {
      testOptions.env = {};
      uploader = new Uploader(testClient, testBucket, testOptions);

      expect(uploader.shardConcurrency).to.equal(3);
      expect(uploader.fileConcurrency).to.equal(1);
      expect(uploader.client).to.equal(clientStub);
      expect(testClient.calledWithMatch({
        transferConcurrency: 3,
        requestTimeout: 10000
      })).to.equal(true);
    });
  });

  describe('#_validate', function() {
    before(function() {
      sandbox = sinon.sandbox.create();
      Uploader.oldValidate = Uploader.prototype._validate;
      Uploader.prototype._validate = sinon.stub();
      Uploader.oldGetAllFiles = Uploader.prototype._getAllFiles;
      Uploader.prototype._getAllFiles = sinon.stub().returns(testFiles);
      uploader = new Uploader(testClient, testBucket, testOptions);
      Uploader.prototype._validate = Uploader.oldValidate;
      delete Uploader.oldValidate;
      Uploader.prototype._getAllFiles = Uploader.oldGetAllFiles;
      delete Uploader.oldGetAllFiles;
      sandbox.restore();
    });

    it('should log a warning if fileConcurrency is greater than 6', function() {
      uploader.fileConcurrency = 7;
      uploader._validate();

      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('warn',
        'A file concurrency of %s may result in issues!',
        [uploader.fileConcurrency])).to.equal(true);
    });

    it('should throw an error if fileConcurrency is less than 1', function() {
      uploader.fileConcurrency = 0;

      expect(function() {
        uploader._validate();
      }).to.throw('File Concurrency cannot be less than 1');
    });

    it('should throw an error if fileCount is 0', function() {
      uploader.fileConcurrency = 3;
      uploader.fileCount = 0;

      expect(function() {
        uploader._validate();
      }).to.throw('0 files specified to be uploaded.');
    });
  });

  describe('#_getAllFiles', function() {
    it('should throw an error if a file does not exist', function() {
      process.argv = [
        'arg1',
        'arg2',
        'test/file/1',
        'test/file/2',
        'test/file/3'
      ];
      globuleStub.find = function(file) {
        return [file];
      };
      storjStub.utils = {
        existsSync: sinon.stub().returns(false)
      };

      expect(function() {
        uploader._getAllFiles('test/file/1');
      }).to.throw('test/file/1 could not be found');
    });

    it('should log a warning if a file is smaller than 1 byte', function() {
      process.argv = [
        'arg1',
        'arg2',
        'test/file/1',
        'test/file/2',
        'test/file/3'
      ];
      globuleStub.find = function(file) {
        return [file];
      };
      storjStub.utils = {
        existsSync: sinon.stub().returns(true)
      };
      fsStub.statSync = sinon.stub().returns({
        size: 0.5,
        isFile: sinon.stub().returns(false)
      });

      uploader._getAllFiles('test/file/1');

      expect(LoggerStub.log.callCount).to.equal(3);
      for (var i=2; i<process.argv.length; i++) {
        var filePath = process.argv[i];
        expect(LoggerStub.log.calledWithMatch('warn',
          'Skipping [ %s ]... we don\'t support files smaller than 1 Byte.',
          [filePath])).to.equal(true);
      }
    });

    it('should throw an error if a file is not readable', function() {
      process.argv = [
        'arg1',
        'arg2',
        'test/file/1',
        'test/file/2',
        'test/file/3'
      ];
      globuleStub.find = function(file) {
        return [file];
      };
      storjStub.utils = {
        existsSync: sinon.stub().returns(true)
      };
      fsStub.statSync = sinon.stub().returns({
        size: 5,
        isFile: sinon.stub().returns(true)
      });
      var errMsg = 'this is an error';
      fsStub.accessSync = sinon.stub().throws(new Error(errMsg));

      expect(function() {
        uploader._getAllFiles('test/file/1');
      }).to.throw(errMsg);
    });

    it('should concatenate files together and return this list', function() {
      process.argv = [
        'arg1',
        'arg2',
        'test/file/1',
        'test/file/2',
        'test/file/3'
      ];
      globuleStub.find = function(file) {
        return [file];
      };
      storjStub.utils = {
        existsSync: sinon.stub().returns(true)
      };
      fsStub.statSync = sinon.stub().returns({
        size: 5,
        isFile: sinon.stub().returns(true)
      });
      fsStub.accessSync = sinon.stub();

      var result = uploader._getAllFiles('test/file/1');

      expect(result).to.deep.equal(process.argv.splice(2, process.argv.length));
    });
  });

  describe('#_cleanup', function() {
    it('should call the tmpCleanup function passed in', function() {
      var testFile = '/test/file/path';
      var tmpCleanup = sinon.stub();

      uploader._cleanup(testFile, tmpCleanup);

      expect(tmpCleanup.callCount).to.equal(1);
      expect(LoggerStub.log.callCount).to.equal(2);
      expect(LoggerStub.log.calledWithMatch('info', 'Cleaning up', testFile));
      expect(LoggerStub.log.calledWithMatch('info', 'Finished cleaning',
        testFile));
    });
  });

  describe('#_getKeyRing', function() {
    it('should properly set the keyring', function() {
      var testKeyRing = 'testkeyring';
      var testKeyPass = 'testkeypass';

      uploader.keypass = testKeyPass;
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);

      var cb = sinon.stub();
      uploader._getKeyRing(cb);

      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(uploader.keyring).to.equal(testKeyRing);
      expect(cb.callCount).to.equal(1);
    });
  });

  describe('#_loopThroughFiles', function() {
    it('should pass an error message to the callback if a file is not found',
      function(done) {
      var fileList = ['/file/1/path', '/file/2/path', '/file/3/path'];
      uploader.filepaths = fileList;
      uploader.fileConcurrency = 3;
      storjStub.utils = {
        existsSync: sinon.stub().returns(false)
      };

      var cb = sinon.stub();
      uploader._loopThroughFiles(cb);

      setTimeout(function() {
        expect(cb.callCount).to.equal(3);
        fileList.forEach(function(file) {
          expect(cb.calledWithMatch('No file found', file)).to.equal(true);
        });
        done();
      }, 50);
    });

    it('should call the callback with no error if a file exists',
      function(done) {
      var fileList = ['/file/1/path', '/file/2/path', '/file/3/path'];
      uploader.filepaths = fileList;
      uploader.fileConcurrency = 3;
      storjStub.utils = {
        existsSync: sinon.stub().returns(true)
      };

      var cb = sinon.stub();
      uploader._loopThroughFiles(cb);

      setTimeout(function() {
        expect(cb.callCount).to.equal(3);
        fileList.forEach(function(file) {
          expect(cb.calledWithMatch(null, file)).to.equal(true);
          expect(uploader.nextFileCallback[file]).to.be.a('function');
        });
        done();
      }, 50);
    });
  });

  describe('#_checkFileExistence', function() {
    it('should log a warning and create a new name if the file ' +
      'already exists in the bucket', function() {
      var now = new Date();
      var clock = sinon.useFakeTimers(now.getTime());

      var testFilePath = '/test/file/path/filename.xyz';
      var testFileId = 'testfileid';
      var testBucket = 'testbucket';
      uploader.bucket = testBucket;
      var cb = sinon.stub();
      storjStub.utils = {
        calculateFileId: sinon.stub().returns(testFileId)
      };
      clientStub.getFileInfo = sinon.stub().callsArgWith(2, null, {});

      uploader._checkFileExistence(testFilePath, cb);

      var isoStr = now.toISOString().replace(/:/g, ';');
      var newFileName = '(' + isoStr + ')-filename.xyz';
      expect(storjStub.utils.calculateFileId.calledWithMatch(testBucket,
        'filename.xyz')).to.equal(true);
      expect(clientStub.getFileInfo.calledWithMatch(testBucket, testFileId,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('warn', 'Already exists in bucket',
        'filename.xyz')).to.equal(true);
      expect(uploader.filename).to.equal(newFileName);
      expect(cb.callCount).to.equal(1);
      expect(cb.calledWithMatch(null, testFilePath)).to.equal(true);
      clock.restore();
    });

    it('should not rename the file if it does not exist already', function() {
      var testFilePath = '/test/file/path/filename.xyz';
      var testFileId = 'testfileid';
      var testBucket = 'testbucket';
      uploader.bucket = testBucket;
      var cb = sinon.stub();
      storjStub.utils = {
        calculateFileId: sinon.stub().returns(testFileId)
      };
      clientStub.getFileInfo = sinon.stub().callsArg(2);

      uploader._checkFileExistence(testFilePath, cb);

      expect(storjStub.utils.calculateFileId.calledWithMatch(testBucket,
        'filename.xyz')).to.equal(true);
      expect(clientStub.getFileInfo.calledWithMatch(testBucket, testFileId,
        sinon.match.func)).to.equal(true);
      expect(cb.callCount).to.equal(1);
      expect(cb.calledWithMatch(null, testFilePath)).to.equal(true);
    });
  });

  describe('#_makeTempDir', function() {
    it('should log and return an error if utils responds with one', function() {
      var testFilePath = 'test/file/path';
      var err = new Error('this is an error');
      utilsStub.makeTempDir = sinon.stub().callsArgWith(0, err);
      var cb = sinon.stub();

      uploader._makeTempDir(testFilePath, cb);

      expect(cb.callCount).to.equal(1);
      expect(cb.calledWithMatch(err, testFilePath)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error',
        'Unable to create temp directory for file',
        testFilePath)).to.equal(true);
    });

    it('should properly set file information if an encryption key is provided',
      function() {
      var testFilePath = 'test/file/path';
      var testFileName = 'testfilename.xyz';
      var testFileId = 'testfileid';
      uploader.filename = testFileName;
      var tmpDir = 'temp/dir';
      var tmpCleanup = sinon.stub();
      utilsStub.makeTempDir = sinon.stub().callsArgWith(0, null,
        tmpDir, tmpCleanup);
      utilsStub.calculateFileId = sinon.stub().returns(testFileId);
      var testDeterministicKey = 'testdeterministickey';
      storjStub.DeterministicKeyIv = sinon.stub();
      storjStub.DeterministicKeyIv.getDeterministicKey =
        sinon.stub().returns(testDeterministicKey);
      storjStub.EncryptStream = sinon.stub();
      var cb = sinon.stub();
      uploader.token = {
        encryptionKey: 'testencryptionkey'
      };

      uploader._makeTempDir(testFilePath, cb);

      expect(storjStub.DeterministicKeyIv.getDeterministicKey.calledWithMatch(
        uploader.token.encryptionKey, testFileId)).to.equal(true);
      expect(storjStub.DeterministicKeyIv.calledWithMatch(testDeterministicKey,
        testFileId)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info',
        'Encrypting file', [testFilePath])).to.equal(true);
      var fileMeta = uploader.fileMeta[testFilePath];
      expect(fileMeta.filename).to.equal(testFileName);
      expect(fileMeta.tmpDir).to.equal(tmpDir);
      expect(fileMeta.tmppath).to.equal(tmpDir + '/' + testFileName + '.crypt');
      expect(fileMeta.tmpCleanup).to.equal(tmpCleanup);
      expect(fileMeta.secret).to.be.instanceOf(storjStub.DeterministicKeyIv);
      expect(fileMeta.encrypter).to.be.instanceOf(storjStub.EncryptStream);
      expect(cb.callCount).to.equal(1);
      expect(cb.calledWithMatch(null, testFilePath)).to.equal(true);
    });

    it('should properly set file information if an encryption key ' +
      'is not provided', function() {
      var testFilePath = 'test/file/path';
      var testFileName = 'testfilename.xyz';
      var testFileId = 'testfileid';
      uploader.filename = testFileName;
      var tmpDir = 'temp/dir';
      var tmpCleanup = sinon.stub();
      utilsStub.makeTempDir = sinon.stub().callsArgWith(0, null,
        tmpDir, tmpCleanup);
      utilsStub.calculateFileId = sinon.stub().returns(testFileId);
      storjStub.EncryptStream = sinon.stub();
      var testSecret = 'testsecret';
      uploader.keyring = {
        generateFileKey: sinon.stub().returns(testSecret)
      };
      var cb = sinon.stub();
      uploader.token = {};
      var testBucket = 'testbucket';
      uploader.bucket = testBucket;

      uploader._makeTempDir(testFilePath, cb);

      expect(uploader.keyring.generateFileKey.calledWithMatch(testBucket,
        testFileId)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info',
        'Encrypting file', [testFilePath])).to.equal(true);
      var fileMeta = uploader.fileMeta[testFilePath];
      expect(fileMeta.filename).to.equal(testFileName);
      expect(fileMeta.tmpDir).to.equal(tmpDir);
      expect(fileMeta.tmppath).to.equal(tmpDir + '/' + testFileName + '.crypt');
      expect(fileMeta.tmpCleanup).to.equal(tmpCleanup);
      expect(fileMeta.secret).to.equal(testSecret);
      expect(fileMeta.encrypter).to.be.instanceOf(storjStub.EncryptStream);
      expect(cb.callCount).to.equal(1);
      expect(cb.calledWithMatch(null, testFilePath)).to.equal(true);
    });
  });

  describe('#_createReadStream', function() {

  });

  describe('#_createToken', function() {

  });

  describe('#_storeFileInBucket', function() {

  });

  describe('#_handleFailure', function() {

  });

  describe('#start', function() {

  });
});
