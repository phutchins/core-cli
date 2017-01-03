'use strict';

var expect = require('chai').expect;
var proxyquire = require('proxyquire');
var sinon = require('sinon');

var LoggerStub = {
  log: sinon.stub()
};
var utilsStub = {};

var Frames = proxyquire('../../bin/actions/frames.js', {
  './../logger': function() {
    return LoggerStub;
  },
  './../utils': utilsStub
});

describe('frames', function() {
  beforeEach(function() {
    LoggerStub.log.reset();
  });

  describe('#add', function() {
    it('should log an error if the client responds with one', function() {
      var errMsg = 'this is an error';

      var clientStub = {
        createFileStagingFrame: sinon.stub().callsArgWith(0, new Error(errMsg))
      };
      Frames._storj = {
        PrivateClient: sinon.stub().returns(clientStub)
      };

      Frames.add();

      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should log information about the frame if there is no error',
      function() {
      var newFrame = {
        id: 'testid',
        created: Date.now()
      };
      var clientStub = {
        createFileStagingFrame: sinon.stub().callsArgWith(0, null, newFrame)
      };
      Frames._storj = {
        PrivateClient: sinon.stub().returns(clientStub)
      };

      Frames.add();

      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info', 'ID: %s, Created: %s',
        [newFrame.id, newFrame.created])).to.equal(true);
    });
  });

  describe('#list', function() {
    it('should log an error if the client responds with one', function() {
      var errMsg = 'this is an error';

      var clientStub = {
        getFileStagingFrames: sinon.stub().callsArgWith(0, new Error(errMsg))
      };
      Frames._storj = {
        PrivateClient: sinon.stub().returns(clientStub)
      };

      Frames.list();

      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should log a warning if there are no frames', function() {
      var testFrames = [];

      var clientStub = {
        getFileStagingFrames: sinon.stub().callsArgWith(0, null, testFrames)
      };
      Frames._storj = {
        PrivateClient: sinon.stub().returns(clientStub)
      };

      Frames.list();

      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('warn',
        'There are no frames to list')).to.equal(true);
    });

    it('should log information about each frame', function() {
      var testFrames = [{
        id: 'testid1',
        created: 12345,
        shards: [1, 2, 3, 4, 5]
      }, {
        id: 'testid2',
        created: 54321,
        shards: [7, 4, 1]
      }];

      var clientStub = {
        getFileStagingFrames: sinon.stub().callsArgWith(0, null, testFrames)
      };
      Frames._storj = {
        PrivateClient: sinon.stub().returns(clientStub)
      };

      Frames.list();

      expect(LoggerStub.log.callCount).to.equal(testFrames.length);
      testFrames.forEach(function(frame) {
        expect(LoggerStub.log.calledWithMatch('info',
          'ID: %s, Created: %s, Shards: %s',
          [frame.id, frame.created, frame.shards.length])).to.equal(true);
      });
    });
  });

  describe('#get', function() {
    it('should log an error if the client responds with one', function() {
      var errMsg = 'this is an error';
      var frameId = 'testframeid';

      var clientStub = {
        getFileStagingFrameById: sinon.stub().callsArgWith(1, new Error(errMsg))
      };
      Frames._storj = {
        PrivateClient: sinon.stub().returns(clientStub)
      };

      Frames.get(frameId);

      expect(clientStub.getFileStagingFrameById.callCount).to.equal(1);
      expect(clientStub.getFileStagingFrameById.calledWithMatch(
        frameId, sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should log information about the frame if there is no error',
      function() {
      var frameId = 'testframeid';
      var testFrame = {
        id: 'testid1',
        created: 12345,
        shards: [1, 2, 3, 4, 5]
      };

      var clientStub = {
        getFileStagingFrameById: sinon.stub().callsArgWith(1, null, testFrame)
      };
      Frames._storj = {
        PrivateClient: sinon.stub().returns(clientStub)
      };

      Frames.get(frameId);

      expect(clientStub.getFileStagingFrameById.callCount).to.equal(1);
      expect(clientStub.getFileStagingFrameById.calledWithMatch(
        frameId, sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info',
        'ID: %s, Created: %s, Shards: %s',
        [testFrame.id, testFrame.created, testFrame.shards.length]))
        .to.equal(true);
    });
  });

  describe('#remove', function() {
    it('should request confirmation if -f is not used', function() {
      var frameId = 'testframeid';
      var testEnv = {
        force: false
      };

      var clientStub = {
        destroyFileStagingFrameById: sinon.stub()
      };
      Frames._storj = {
        PrivateClient: sinon.stub().returns(clientStub)
      };
      utilsStub.getConfirmation = sinon.stub();

      Frames.remove(frameId, testEnv);

      expect(utilsStub.getConfirmation.callCount).to.equal(1);
      expect(utilsStub.getConfirmation.calledWithMatch(
        'Are your sure you want to destroy this frame?',
        sinon.match.func)).to.equal(true);
    });

    it('should log an error if the client responds with one', function() {
      var errMsg = 'this is an error';
      var frameId = 'testframeid';
      var testEnv = {
        force: true
      };

      var clientStub = {
        destroyFileStagingFrameById: sinon.stub().callsArgWith(1,
          new Error(errMsg))
      };
      Frames._storj = {
        PrivateClient: sinon.stub().returns(clientStub)
      };

      Frames.remove(frameId, testEnv);

      expect(clientStub.destroyFileStagingFrameById.callCount).to.equal(1);
      expect(clientStub.destroyFileStagingFrameById.calledWithMatch(
        frameId, sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('error', errMsg)).to.equal(true);
    });

    it('should log a success message if the frame is removed', function() {
      var frameId = 'testframeid';
      var testEnv = {
        force: true
      };

      var clientStub = {
        destroyFileStagingFrameById: sinon.stub().callsArg(1)
      };
      Frames._storj = {
        PrivateClient: sinon.stub().returns(clientStub)
      };

      Frames.remove(frameId, testEnv);

      expect(clientStub.destroyFileStagingFrameById.callCount).to.equal(1);
      expect(clientStub.destroyFileStagingFrameById.calledWithMatch(
        frameId, sinon.match.func)).to.equal(true);
      expect(LoggerStub.log.callCount).to.equal(1);
      expect(LoggerStub.log.calledWithMatch('info',
        'Frame was successfully removed')).to.equal(true);
    });
  });
});
