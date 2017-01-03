'use strict';
/* jshint maxstatements: 35 */

var expect = require('chai').expect;
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var stream = require('stream');

var LoggerStub = {
  log: sinon.stub()
};
var storjStub = {};
var utilsStub = {};

var Files = proxyquire('../../bin/actions/files.js', {
  './../logger': function() {
    return LoggerStub;
  },
  'storj-lib': storjStub,
  './../utils': utilsStub
});

describe('files', function() {
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

  describe('#list', function() {
    it('should log an error if the client responds with one', function() {
      var errMsg = 'this is an error';
      var testBucketId = 'testbucketid';

      var clientStub = {
        listFilesInBucket: sinon.stub().callsArgWith(1, new Error(errMsg))
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0)
      };

      Files.list(testBucketId);

      expect(clientStub.listFilesInBucket.callCount).to.equal(1);
      expect(clientStub.listFilesInBucket.calledWithMatch(testBucketId,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should log a warning if the file list is empty', function() {
      var testBucketId = 'testbucketid';

      var fileList = [];
      var clientStub = {
        listFilesInBucket: sinon.stub().callsArgWith(1, null, fileList)
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0)
      };

      Files.list(testBucketId);

      expect(clientStub.listFilesInBucket.callCount).to.equal(1);
      expect(clientStub.listFilesInBucket.calledWithMatch(testBucketId,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('warn',
        'There are no files in this bucket')).to.equal(true);
    });

    it('should log information about each file in the list', function() {
      var testBucketId = 'testbucketid';
      var fileList = [{
        filename: 'testfilename1',
        mimetype: 'text/plain',
        size: 125,
        id: 'testid1'
      }, {
        filename: 'testfilename2',
        mimetype: 'text/javascript',
        size: 342,
        id: 'testid2'
      }, {
        filename: 'testfilename3',
        mimetype: 'audio/midi',
        size: 54,
        id: 'testid3'
      }];

      var clientStub = {
        listFilesInBucket: sinon.stub().callsArgWith(1, null, fileList)
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0)
      };

      Files.list(testBucketId);

      expect(clientStub.listFilesInBucket.callCount).to.equal(1);
      expect(clientStub.listFilesInBucket.calledWithMatch(testBucketId,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(fileList.length);
      for (var i in fileList) {
        var nextFile = fileList[i];
        expect(LoggerStub.log.calledWithMatch('info',
          'Name: %s, Type: %s, Size: %s bytes, ID: %s',
          [nextFile.filename, nextFile.mimetype, nextFile.size, nextFile.id]))
          .to.equal(true);
      }
    });
  });

  describe('#getInfo', function() {
    it('should log an error if the client responds with one', function() {
      var errMsg = 'this is an error';
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';

      var clientStub = {
        getFileInfo: sinon.stub().callsArgWith(2, new Error(errMsg))
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1)
      };

      Files.getInfo(testBucketId, testFileId);

      expect(clientStub.getFileInfo.callCount).to.equal(1);
      expect(clientStub.getFileInfo.calledWithMatch(testBucketId, testFileId,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should log information about the file requested', function() {
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';
      var testFile = {
        filename: 'testfilename1',
        mimetype: 'text/plain',
        size: 125,
        id: 'testid1'
      };

      var clientStub = {
        getFileInfo: sinon.stub().callsArgWith(2, null, testFile)
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1)
      };

      Files.getInfo(testBucketId, testFileId);

      expect(clientStub.getFileInfo.callCount).to.equal(1);
      expect(clientStub.getFileInfo.calledWithMatch(testBucketId, testFileId,
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info',
        'Name: %s, Type: %s, Size: %s bytes, ID: %s',
        [testFile.filename, testFile.mimetype, testFile.size, testFile.id]))
        .to.equal(true);
    });
  });

  describe('#remove', function() {
    it('should get confirmation that the user wants to remove a file if -f ' +
      'is not used', function() {
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';
      var testKeyPass = 'testkeypass';

      utilsStub.getConfirmation = sinon.stub();
      var clientStub = {
        removeFileFromBucket: sinon.stub().callsArg(2)
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1),
        getKeyPass: sinon.stub().returns(testKeyPass)
      };

      Files.remove(testBucketId, testFileId, {force: false});

      expect(utilsStub.getConfirmation.callCount).to.equal(1);
      expect(utilsStub.getConfirmation.calledWithMatch(
        'Are you sure you want to destroy the file?', sinon.match.func))
        .to.equal(true);
    });

    it('should log an error if the client responds with one', function() {
      var errMsg = 'this is an error';
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';
      var testKeyPass = 'testkeypass';
      var testKeyRing = {
        del: sinon.stub()
      };

      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      var clientStub = {
        removeFileFromBucket: sinon.stub().callsArgWith(2, new Error(errMsg))
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1),
        getKeyPass: sinon.stub().returns(testKeyPass)
      };

      Files.remove(testBucketId, testFileId, {force: true});

      expect(utilsStub.getKeyRing.callCount).to.equal(1);
      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(clientStub.removeFileFromBucket.callCount).to.equal(1);
      expect(clientStub.removeFileFromBucket.calledWithMatch(
        testBucketId, testFileId, sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should successfully delete the file if there is no error', function() {
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';
      var testKeyPass = 'testkeypass';
      var testKeyRing = {
        del: sinon.stub()
      };

      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);
      var clientStub = {
        removeFileFromBucket: sinon.stub().callsArg(2)
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1),
        getKeyPass: sinon.stub().returns(testKeyPass)
      };

      Files.remove(testBucketId, testFileId, {force: true});

      expect(utilsStub.getKeyRing.callCount).to.equal(1);
      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(clientStub.removeFileFromBucket.callCount).to.equal(1);
      expect(clientStub.removeFileFromBucket.calledWithMatch(
        testBucketId, testFileId, sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info',
        'File was successfully removed')).to.equal(true);
      expect(testKeyRing.del.callCount).to.equal(1);
      expect(testKeyRing.del.calledWithMatch(testFileId)).to.equal(true);
    });
  });

  describe('#listMirrors', function() {
    it('should log an error if the client responds with one', function() {
      var errMsg = 'this is an error';
      var bucketId = 'testbucketid';
      var fileId = 'testfileid';

      var clientStub = {
        listMirrorsForFile: sinon.stub().callsArgWith(2, new Error(errMsg))
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1)
      };

      Files.listMirrors(bucketId, fileId);

      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should list information about established and available shards ' +
      'for each mirror', function() {
      var bucketId = 'testbucketid';
      var fileId = 'testfileid';
      var mirrorInfo = [
        {
          established: [
            {shardHash: 'testShardHash1', contact: 'testContact1'},
            {contact: 'testContact2'},
            {contact: 'testContact3'}
          ],
          available: [
            {shardHash: 'testShardHash2', contact: 'testContact4'},
            {contact: 'testContact5'},
            {contact: 'testContact6'}
          ]
        },
        {
          established: [
            {shardHash: 'testShardHash3', contact: 'testContact7'},
            {contact: 'testContact8'},
            {contact: 'testContact9'}
          ],
          available: [
            {shardHash: 'testShardHash4', contact: 'testContact10'},
            {contact: 'testContact11'},
            {contact: 'testContact12'}
          ]
        },
      ];

      var clientStub = {
        listMirrorsForFile: sinon.stub().callsArgWith(2, null, mirrorInfo)
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1)
      };
      storjStub.utils = {
        getContactURL: sinon.stub().returnsArg(0)
      };

      Files.listMirrors(bucketId, fileId);

      mirrorInfo.forEach((mirror, i) => {
        expect(LoggerStub.log.calledWithMatch('info',
          'Shard', [i])).to.equal(true);
        mirror.established.forEach((established, j) => {
          if (j === 0) {
            expect(LoggerStub.log.calledWithMatch('info',
              'Hash', [established.shardHash])).to.equal(true);
          }
          expect(LoggerStub.log.calledWithMatch('info',
            '', [established.contact])).to.equal(true);
        });
        mirror.established.forEach((available, j) => {
          if (j === 0) {
            expect(LoggerStub.log.calledWithMatch('info',
              'Hash', [available.shardHash])).to.equal(true);
          }
          expect(LoggerStub.log.calledWithMatch('info',
            '', [available.contact])).to.equal(true);
        });
      });
    });
  });

  describe('#stream', function() {
    it('should log an error if it cannot find a decryption key', function() {
      var testKeyPass = 'testkeypass';
      var testKeyRing = {
        get: sinon.stub().returns(null)
      };
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';
      var testEnv = {};

      storjStub.deps = {
        kad: {
          Logger: sinon.stub()
        }
      };
      var clientStub = {
        createFileStream: sinon.stub()
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1),
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);

      Files.stream(testBucketId, testFileId, testEnv);

      expect(utilsStub.getKeyRing.callCount).to.equal(1);
      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(testKeyRing.get.callCount).to.equal(1);
      expect(testKeyRing.get.calledWithMatch(testFileId)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error',
        'No decryption key found in key ring')).to.equal(true);
    });

    it('should log an error if the client responds with one', function() {
      var errMsg = 'this is an error';
      var testKeyPass = 'testkeypass';
      var testSecret = 'testsecret';
      var testKeyRing = {
        get: sinon.stub().returns(testSecret)
      };
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';
      var testEnv = {
        exclude: 'a,b,c'
      };
      var testDecryptStream = stream.Transform();

      storjStub.deps = {
        kad: {
          Logger: sinon.stub()
        }
      };
      storjStub.DecryptStream = sinon.stub().returns(testDecryptStream);
      var clientStub = {
        createFileStream: sinon.stub().callsArgWith(2, new Error(errMsg))
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1),
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);

      Files.stream(testBucketId, testFileId, testEnv);

      expect(utilsStub.getKeyRing.callCount).to.equal(1);
      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(testKeyRing.get.callCount).to.equal(1);
      expect(testKeyRing.get.calledWithMatch(testFileId)).to.equal(true);
      expect(storjStub.DecryptStream.callCount).to.equal(1);
      expect(storjStub.DecryptStream.calledWithMatch(testSecret))
        .to.equal(true);
      expect(clientStub.createFileStream.callCount).to.equal(1);
      expect(clientStub.createFileStream.calledWithMatch(testBucketId,
        testFileId, sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should log a warning if the stream emits an error', function() {
      var errMsg = 'this is an error';
      var testKeyPass = 'testkeypass';
      var testSecret = 'testsecret';
      var testKeyRing = {
        get: sinon.stub().returns(testSecret)
      };
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';
      var testEnv = {
        exclude: 'a,b,c'
      };
      var testDecryptStream = stream.Transform();
      var testFileStream = stream.Readable();

      storjStub.deps = {
        kad: {
          Logger: sinon.stub()
        }
      };
      storjStub.DecryptStream = sinon.stub().returns(testDecryptStream);
      var clientStub = {
        createFileStream: sinon.stub().callsArgWith(2, null, testFileStream)
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1),
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);

      Files.stream(testBucketId, testFileId, testEnv);

      testFileStream.emit('error', new Error(errMsg));

      expect(utilsStub.getKeyRing.callCount).to.equal(1);
      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(testKeyRing.get.callCount).to.equal(1);
      expect(testKeyRing.get.calledWithMatch(testFileId)).to.equal(true);
      expect(storjStub.DecryptStream.callCount).to.equal(1);
      expect(storjStub.DecryptStream.calledWithMatch(testSecret))
        .to.equal(true);
      expect(clientStub.createFileStream.callCount).to.equal(1);
      expect(clientStub.createFileStream.calledWithMatch(testBucketId,
        testFileId, sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('warn', 'Failed to download shard',
        [errMsg])).to.equal(true);
    });

    it('should retry the download if the stream emits an error and the error ' +
      'has a pointer attribute', function() {
      var errMsg = 'this is an error';
      var testKeyPass = 'testkeypass';
      var testSecret = 'testsecret';
      var testKeyRing = {
        get: sinon.stub().returns(testSecret)
      };
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';
      var testEnv = {
        exclude: 'a,b,c'
      };
      var testDecryptStream = stream.Transform();
      var testFileStream = stream.Readable();

      storjStub.deps = {
        kad: {
          Logger: sinon.stub()
        }
      };
      storjStub.DecryptStream = sinon.stub().returns(testDecryptStream);
      var clientStub = {
        createFileStream: sinon.stub().callsArgWith(2, null, testFileStream)
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1),
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);

      Files.stream(testBucketId, testFileId, testEnv);

      Files.oldStream = Files.stream;
      Files.stream = sinon.stub();
      var newErr = new Error(errMsg);
      newErr.pointer = {
        farmer: {
          nodeID: 'd'
        }
      };
      var newEnv = {
        exclude: testEnv.exclude + ',d'
      };
      testFileStream.emit('error', newErr);

      expect(utilsStub.getKeyRing.callCount).to.equal(1);
      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(testKeyRing.get.callCount).to.equal(1);
      expect(testKeyRing.get.calledWithMatch(testFileId)).to.equal(true);
      expect(storjStub.DecryptStream.callCount).to.equal(1);
      expect(storjStub.DecryptStream.calledWithMatch(testSecret))
        .to.equal(true);
      expect(clientStub.createFileStream.callCount).to.equal(1);
      expect(clientStub.createFileStream.calledWithMatch(testBucketId,
        testFileId, sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(2);
      expect(LoggerStub.log.calledWithMatch('warn', 'Failed to download shard',
        [errMsg])).to.equal(true);
      expect(LoggerStub.log.calledWithMatch('info',
        'Retrying download from other mirrors...')).to.equal(true);
      expect(Files.stream.callCount).to.equal(1);
      expect(Files.stream.calledWithMatch(testBucketId, testFileId,
        newEnv)).to.equal(true);
      Files.stream = Files.oldStream;
    });

    it('should pipe the stream through the decrypter and stdout',
      function(done) {
      var testKeyPass = 'testkeypass';
      var testSecret = 'testsecret';
      var testKeyRing = {
        get: sinon.stub().returns(testSecret)
      };
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';
      var testEnv = {
        exclude: 'a,b,c'
      };
      var testFileStream = stream.Readable({read: sinon.stub()});
      var testDecryptStream = stream.PassThrough();
      testDecryptStream.on('pipe', function(src) {
        expect(src).to.equal(testFileStream);
      });
      process.stdout.on('pipe', function(src) {
        expect(src).to.equal(testDecryptStream);
        done();
      });

      storjStub.deps = {
        kad: {
          Logger: sinon.stub()
        }
      };
      storjStub.DecryptStream = sinon.stub().returns(testDecryptStream);
      var clientStub = {
        createFileStream: sinon.stub().callsArgWith(2, null, testFileStream)
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1),
        getKeyPass: sinon.stub().returns(testKeyPass)
      };
      utilsStub.getKeyRing = sinon.stub().callsArgWith(1, testKeyRing);

      Files.stream(testBucketId, testFileId, testEnv);

      expect(utilsStub.getKeyRing.callCount).to.equal(1);
      expect(utilsStub.getKeyRing.calledWithMatch(testKeyPass,
        sinon.match.func)).to.equal(true);
      expect(testKeyRing.get.callCount).to.equal(1);
      expect(testKeyRing.get.calledWithMatch(testFileId)).to.equal(true);
      expect(storjStub.DecryptStream.callCount).to.equal(1);
      expect(storjStub.DecryptStream.calledWithMatch(testSecret))
        .to.equal(true);
      expect(clientStub.createFileStream.callCount).to.equal(1);
      expect(clientStub.createFileStream.calledWithMatch(testBucketId,
        testFileId, sinon.match.func)).to.equal(true);
    });
  });

  describe('#getpointers', function() {
    it('should log an error if the client responds with one when trying to ' +
      'create a token', function() {
      var errMsg = 'this is an error';
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';
      var testEnv = {
        skip: 3,
        limit: 5
      };

      var clientStub = {
        createToken: sinon.stub().callsArgWith(2, new Error(errMsg))
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1)
      };

      Files.getpointers(testBucketId, testFileId, testEnv);

      expect(clientStub.createToken.callCount).to.equal(1);
      expect(clientStub.createToken.calledWith(testBucketId, 'PULL',
        sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should log an error if the client responds with one when trying to ' +
      'get pointers', function() {
      var errMsg = 'this is an error';
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';
      var testEnv = {
        skip: 3,
        limit: 5
      };
      var testToken = {token: 'testtoken'};

      var clientStub = {
        createToken: sinon.stub().callsArgWith(2, null, testToken),
        getFilePointers: sinon.stub().callsArgWith(1, new Error(errMsg))
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1)
      };

      Files.getpointers(testBucketId, testFileId, testEnv);

      expect(clientStub.createToken.callCount).to.equal(1);
      expect(clientStub.createToken.calledWith(testBucketId, 'PULL',
        sinon.match.func)).to.equal(true);
      expect(clientStub.getFilePointers.callCount).to.equal(1);
      expect(clientStub.getFilePointers.calledWithMatch({
        bucket: testBucketId,
        file: testFileId,
        token: testToken.token,
        skip: testEnv.skip,
        limit: testEnv.limit
      }, sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should log a warning if no pointers are found', function() {
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';
      var testEnv = {
        skip: 3,
        limit: 5
      };
      var testToken = {token: 'testtoken'};
      var pointerList = [];

      var clientStub = {
        createToken: sinon.stub().callsArgWith(2, null, testToken),
        getFilePointers: sinon.stub().callsArgWith(1, null, pointerList)
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1)
      };

      Files.getpointers(testBucketId, testFileId, testEnv);

      expect(clientStub.createToken.callCount).to.equal(1);
      expect(clientStub.createToken.calledWith(testBucketId, 'PULL',
        sinon.match.func)).to.equal(true);
      expect(clientStub.getFilePointers.callCount).to.equal(1);
      expect(clientStub.getFilePointers.calledWithMatch({
        bucket: testBucketId,
        file: testFileId,
        token: testToken.token,
        skip: testEnv.skip,
        limit: testEnv.limit
      }, sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('warn',
        'There are no pointers to return for that range')).to.equal(true);
    });

    it('should log information about each pointer', function() {
      var testBucketId = 'testbucketid';
      var testFileId = 'testfileid';
      var testEnv = {
        skip: 3,
        limit: 5
      };
      var testToken = {token: 'testtoken'};
      var pointerList = [{
          hash: 'testhash1',
          token: 'testtoken1',
          farmer: 'testfarmer1'
        }, {
          hash: 'testhash2',
          token: 'testtoken2',
          farmer: 'testfarmer2'
        }, {
          hash: 'testhash3',
          token: 'testtoken3',
          farmer: 'testfarmer3'
        }];

      var clientStub = {
        createToken: sinon.stub().callsArgWith(2, null, testToken),
        getFilePointers: sinon.stub().callsArgWith(1, null, pointerList)
      };
      Files._storj = {
        PrivateClient: function() {
          return clientStub;
        },
        getRealBucketId: sinon.stub().returnsArg(0),
        getRealFileId: sinon.stub().returnsArg(1)
      };
      storjStub.utils = {
        getContactURL: sinon.stub().returnsArg(0)
      };

      Files.getpointers(testBucketId, testFileId, testEnv);

      expect(clientStub.createToken.callCount).to.equal(1);
      expect(clientStub.createToken.calledWith(testBucketId, 'PULL',
        sinon.match.func)).to.equal(true);
      expect(clientStub.getFilePointers.callCount).to.equal(1);
      expect(clientStub.getFilePointers.calledWithMatch({
        bucket: testBucketId,
        file: testFileId,
        token: testToken.token,
        skip: testEnv.skip,
        limit: testEnv.limit
      }, sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(3 + 5*pointerList.length);
      expect(LoggerStub.log.calledWithMatch('info',
        'Listing pointers for shards',
        [testEnv.skip, testEnv.skip + pointerList.length - 1])).to.equal(true);
      pointerList.forEach(function(ptr, i) {
        var adjustedIndex = testEnv.skip + i;
        expect(LoggerStub.log.calledWithMatch('info', 'Index',
          [adjustedIndex])).to.equal(true);
        expect(LoggerStub.log.calledWithMatch('info', 'Hash',
          [ptr.hash])).to.equal(true);
        expect(LoggerStub.log.calledWithMatch('info', 'Token',
          [ptr.token])).to.equal(true);
        expect(LoggerStub.log.calledWithMatch('info', 'Farmer',
          [ptr.farmer])).to.equal(true);
      });
    });
  });
});
