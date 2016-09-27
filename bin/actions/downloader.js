'use strict';
var log = require('./../logger')().log;
var utils = require('./../utils');
var fs = require('fs');
var path = require('path');
var storj = require('storj-lib');
var assert = require('assert');
var async = require('async');
var through = require('through');

function Downloader(client, keypass, options) {
  if (!(this instanceof Downloader)) {
    return new Downloader(client, keypass, options);
  }

  this.bucket = options.bucket;
  this.fileid = options.fileid;
  this.filepath = options.filepath;
  this.client = client();
  this.keypass = keypass();
  this.fileMeta = null;
  this.exclude = options.env.exclude;

  this._validate();
}

Downloader.prototype._validate = function() {
  // Don't overwrite a file that already exists
  if (storj.utils.existsSync(this.filepath)) {
    assert(
      !fs.statSync(this.filepath).isFile(),
      'Refusing to overwrite file at ' + this.filepath
    );
  }

  // Make sure the subdirectory exists
  assert(
    storj.utils.existsSync(path.dirname(this.filepath)),
     path.dirname(this.filepath) + ' is not an existing folder'
   );

  // If the path ends with a directory make sure it exists
  if (this.filepath.slice(-1) === path.sep) {
    assert(
      fs.statSync(this.filepath).isDirectory(),
      this.filepath + 'is not an existing folder'
    );
  }
};


Downloader.prototype._getInfo = function(callback) {
  var self = this;

  this.client.listFilesInBucket(this.bucket, function(err, files) {
    if (err) {
      callback(err);
    }

    files.forEach(function(file) {
      if (self.fileid === file.id) {
        log(
          'info',
          'Name: %s, Type: %s, Size: %s bytes, ID: %s',
          [file.filename, file.mimetype, file.size, file.id]
        );
        self.fileMeta = file;
      }
    });

    return callback(null);
  });
};

Downloader.prototype._determineSaveLocation = function(callback) {
  if (this.fileMeta === null) {
    callback(
      new Error(
        'file ' + this.fileid + ' does not exist in bucket ' + this.bucket
      )
    );
  }

  if (storj.utils.existsSync(this.filepath)) {
    // Check if given path is a directory
    if (fs.statSync(this.filepath).isDirectory() && this.file !== null) {

      // use the file name as the name of the file to be downloaded to
      var fullpath = path.join(this.filepath,this.fileMeta.filename);

      // Make sure fullpath doesn't already exist
      if (storj.utils.existsSync(fullpath)) {
        return log('error', 'Refusing to overwrite file at %s', fullpath);
      }

      this.destination = fullpath;
    } else {
      this.destination = this.filepath;
    }
  } else if (this.filepath.slice(-1) === path.sep) {
    callback(new Error(this.filepath + ' is not an existing folder'));
  } else {
    this.destination = this.filepath;
  }
  callback(null);
};

/**
 * set this.keyring using this.keypass
 * @private
 */
Downloader.prototype._getKeyRing = function(callback) {
  var self = this;

  utils.getKeyRing(this.keypass, function(keyring) {
    self.keyring = keyring;
    callback(null);
    return;
  });
};

/**
 * set this.keyring using this.keypass
 * @private
 */
Downloader.prototype._createFileStream = function(callback) {
  var self = this;
  this.target = fs.createWriteStream(this.destination);

  this.target.on('finish', function() {
    log('info', 'File downloaded and written to %s.', [self.destination]);
  }).on('error', function(err) {
    callback(err);
  });

  this.client.createFileStream(
    this.bucket,
    this.fileid,
    {exclude: this.exclude.split(',')},
    callback
  );
};

Downloader.prototype._handleFileStream = function(stream, callback) {
  var self = this;
  var received = 0;
  var secret = this.keyring.get(this.fileid);

  if (!secret) {
    return log('error', 'No decryption key found in key ring!');
  }

  var decrypter = new storj.DecryptStream(secret);

  stream.on('error', function(err) {
    log('warn', 'Failed to download shard, reason: %s', [err.message]);
    fs.unlink(this.destination, function(unlinkFailed) {
      if (unlinkFailed) {
        callback(new Error('Failed to unlink partial file.'));
      }

      if (!err.pointer) {
        return;
      }

      log('info', 'Retrying download from other mirrors...');
      var exclude = this.exclude.split(',');
      exclude.push(err.pointer.farmer.nodeID);
      self.start(this.finalCallback);
    });
  }).pipe(through(function(chunk) {
    received += chunk.length;
    log('info', 'Received %s of %s bytes', [received, stream._length]);
    this.queue(chunk);
  })).pipe(decrypter).pipe(this.target);
};

Downloader.prototype.start = function(finalCallback) {
  var self = this;
  this.finalCallback = finalCallback;

  async.waterfall([
    function _getInfo(callback) {
      self._getInfo(callback);
    },
    function _determineSaveLocation(callback) {
      self._determineSaveLocation(callback);
    },
    function _getKeyRing(callback) {
      self._getKeyRing(callback);
    },
    function _createFileStream(callback) {
      self._createFileStream(callback);
    },
    function _handleFileStream(stream, callback) {
      self._handleFileStream(stream, callback);
    }
  ], function (err, filepath) {
    finalCallback(err, filepath);
  });

};

module.exports = Downloader;
