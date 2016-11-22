'use strict';
var expect = require('chai').expect;
var proxyquire = require('proxyquire');
var sinon = require('sinon');

var LoggerStub = {
  log: sinon.stub()
};
var storjStub = {};
var fsStub = {};

var Downloader = proxyquire('../../bin/actions/downloader.js', {
  './../logger': function() {
    return LoggerStub;
  },
  'storj-lib': storjStub,
  'fs': fsStub
});

var downloader;
var sandbox;
var clientStub = {};
var testClient = function() {
  return clientStub;
};
var testFileId = 'test file id';
var testBucketId = 'test bucket id';
var testOptions = {
  filepath: '/test/filepath/testfile.extension',
  keypass: 'test keypass',
  env: {
    exclude: 'test exclude'
  }
};

describe('contacts', function() {
  beforeEach(function() {
    LoggerStub.log.reset();
    for (var k in storjStub) {
      try {
        delete storjStub[k];
      } catch(e) {
        // occurs when a key in the object is not writable
      }
    }
  });

  describe('@constructor', function() {
    before(function() {
      sandbox = sinon.sandbox.create();
      Downloader.oldValidate = Downloader.prototype._validate;
      Downloader.prototype._validate = sinon.stub();
    });
    beforeEach(function() {
      Downloader.prototype._validate.reset();
    });
    after(function() {
      Downloader.prototype._validate = Downloader.oldValidate;
      delete Downloader.oldValidate;
      sandbox.restore();
    });

    it('should create an instance without the new keyword', function() {
      expect(Downloader(testClient, testFileId, testBucketId, testOptions))
        .to.be.instanceOf(Downloader);
    });

    it('should properly set all instance variables and validate', function() {
      var newDownloader = new Downloader(testClient, testFileId,
        testBucketId, testOptions);
      expect(newDownloader.bucket).to.equal(testBucketId);
      expect(newDownloader.fileid).to.equal(testFileId);
      expect(newDownloader.filepath).to.equal(testOptions.filepath);
      expect(newDownloader.client).to.equal(testClient());
      expect(newDownloader.keypass).to.equal(testOptions.keypass);
      expect(newDownloader.exclude).to.equal(testOptions.env.exclude);
      expect(newDownloader._validate.callCount).to.equal(1);
    });
  });

  describe('#_validate', function() {
    before(function() {
      sandbox = sinon.sandbox.create();
      var oldValidate = Downloader.prototype._validate;
      Downloader.prototype._validate = sinon.stub();
      downloader = new Downloader(testClient, testFileId, testBucketId,
        testOptions);
      Downloader.prototype._validate = oldValidate;
      sandbox.spy(Downloader.prototype, '_validate');
    });
    beforeEach(function() {
      Downloader.prototype._validate.reset();
    });
    after(function() {
      sandbox.restore();
    });

    it('should throw an error if the filepath already exists', function() {
      storjStub.utils = {
        existsSync: sinon.stub().returns(true)
      };
      var isFileStub = {
        isFile: sinon.stub().returns(true)
      };
      fsStub.statSync = sinon.stub().returns(isFileStub);

      expect(function() {
        downloader._validate();
      }).to.throw('Refusing to overwrite file at ' + testOptions.filepath);
    });

    it('should throw an error if file directory does not exist', function() {
      storjStub.utils = {
        existsSync: sinon.stub().returns(false)
      };
      var filepath = testOptions.filepath;
      var dirname = filepath.slice(0, filepath.lastIndexOf('/'));

      expect(function() {
        downloader._validate();
      }).to.throw(dirname + ' is not an existing folder');
    });

    it('should throw an error if path ends in a directory that does not exist',
      function() {
      downloader.filepath = '/new/test/filepath/';
      storjStub.utils = {
        existsSync: sinon.stub()
      };
      storjStub.utils.existsSync.returns(false);

      expect(function() {
        downloader._validate();
      }).to.throw(downloader.filepath + ' is not an existing folder');
    });

    it('should not throw an error if the path is valid', function() {
      downloader.filepath = testOptions.filepath;
      storjStub.utils = {
        existsSync: sinon.stub()
      };
      storjStub.utils.existsSync.onCall(0).returns(false);
      storjStub.utils.existsSync.onCall(1).returns(true);

      expect(function() {
        downloader._validate();
      }).to.not.throw();
    });
  });

  describe('#_stripISOString', function() {
    before(function() {
      var oldValidate = Downloader.prototype._validate;
      Downloader.prototype._validate = sinon.stub();
      downloader = new Downloader(testClient, testFileId, testBucketId,
        testOptions);
      Downloader.prototype._validate = oldValidate;
    });
    it('should remove the ISO portion of a string passed in', function() {
      var iso = (new Date().toISOString()).replace(/:/g, ';');
      var str = '(' + iso + ')-teststring';
      expect(downloader._stripISOString(str)).to.equal('teststring');
    });
  });

  describe('#_getInfo', function() {
    before(function() {
      sandbox = sinon.sandbox.create();
      var oldValidate = Downloader.prototype._validate;
      Downloader.prototype._validate = sinon.stub();
      downloader = new Downloader(testClient, testFileId, testBucketId,
        testOptions);
      Downloader.prototype._validate = oldValidate;
      sandbox.spy(Downloader.prototype, '_stripISOString');
    });
    after(function() {
      sandbox.restore();
    });

    it('should return an error if the client returns one', function() {
      var errorMsg = 'This is an error';
      clientStub.getFileInfo = function(bucket, fileid, cb) {
        cb(new Error(errorMsg));
      };

      downloader._getInfo(function(err) {
        expect(err).to.be.ok;
        expect(err.message).to.equal(errorMsg);
      });
    });

    it('should save the file metadata returned by the client', function() {
      var filename = 'testfilename';
      var mimetype = 'text/plain';
      var size = 2048;
      var id = 4524;
      clientStub.getFileInfo = function(bucket, fileid, cb) {
        var testFile = {
          filename: filename,
          mimetype: mimetype,
          size: size,
          id: id
        };
        cb(null, testFile);
      };

      downloader._getInfo(function() {});

      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info', sinon.match.any,
        [filename, mimetype, size, id])).to.be.ok;
      expect(downloader._stripISOString.calledWithMatch(filename)).to.be.ok;
      expect(downloader.fileMeta.filename).to.equal(filename);
      expect(downloader.fileMeta.mimetype).to.equal(mimetype);
      expect(downloader.fileMeta.size).to.equal(size);
      expect(downloader.fileMeta.id).to.equal(id);
    });
  });

  describe('#_determineSaveLocation', function() {
    it('should return an error if the file does not exist', function() {

    });

    it('should return an error if filepath is a directory and ' +
      'filepath + filename already exists', function() {

    });

    it('should properly set the destination if filepath is a directory and ' +
      'filepath + filename does not exist', function() {

    });

    it('should properly set the destination if filepath is a file', function() {

    });
  });

  describe('#_getKeyRing', function() {
    it('should save the keyring returned by utils', function() {

    });
  });

  describe('#_createFileStream', function() {

  });

  describe('#_handleFileStream', function() {

  });

  describe('#start', function() {

  });
});
