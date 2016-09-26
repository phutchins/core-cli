'use strict';
var log = require('./../logger')().log;
var utils = require('./../utils');
var fs = require('fs');
var path = require('path');
var storj = require('storj-lib');
var assert = require('assert');
var async = require('async');

function Downloader(client, keypass, options) {
  if (!(this instanceof Downloader)) {
    return new Downloader(client, keypass, options);
  }

  this.bucket = options.bucket;
  this.fileid = options.fileid;
  this.filepath = options.filepath;
  this.client = client();
  this.keypass = keypass();
  var self = this;

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
  var fileMatch = null;

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
        fileMatch = file;
      }
    });

    return callback(fileMatch);
  });
};

Downloader.prototype._determineSaveLocation = function(file, callback) {
  if (file === null) {
    callback(
      new Error(
        'file ' + this.fileid + ' does not exist in bucket ' + this.bucket
      )
    );
  }

  if (storj.utils.existsSync(this.filepath)) {
    // Check if given path is a directory
    if (fs.statSync(this.filepath).isDirectory() && file !== null) {

      // use the file name as the name of the file to be downloaded to
      var fullpath = path.join(this.filepath,file.filename);

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


Downloader.prototype.start = function(finalCallback) {
  var self = this;

  async.waterfall([
    function _getInfo(callback) {
      self._getInfo(callback);
    },
    function _determineSaveLocation(file, callback) {
      self._determineSaveLocation(file, callback);
    },
    function _getKeyRing(callback) {
      self._getKeyRing(callback);
    }
  ], function (err, filepath) {
    finalCallback(err, filepath);
  });

};

// module.exports.download = function(bucket, id, filepath, env) {
//   var self = this;
//   var destination = filepath;
//
//
//
//   module.exports.getInfo.call(self, bucket, id, function(file) {
//     var target;
//
//
//
//     // Check if path is an existing path

//     utils.getKeyRing(keypass, function(keyring) {
//       var secret = keyring.get(id);
//
//       if (!secret) {
//         return log('error', 'No decryption key found in key ring!');
//       }
//
//       var decrypter = new storj.DecryptStream(secret);
//       var received = 0;
//       var exclude = env.exclude.split(',');
//
//       target.on('finish', function() {
//         log('info', 'File downloaded and written to %s.', [destination]);
//       }).on('error', function(err) {
//         log('error', err.message);
//       });
//
//       client.createFileStream(bucket, id, {
//         exclude: exclude
//       },function(err, stream) {
//         if (err) {
//           return log('error', err.message);
//         }
//
//         stream.on('error', function(err) {
//           log('warn', 'Failed to download shard, reason: %s', [err.message]);
//           fs.unlink(filepath, function(unlinkFailed) {
//             if (unlinkFailed) {
//               return log('error', 'Failed to unlink partial file.');
//             }
//
//             if (!err.pointer) {
//               return;
//             }
//
//             log('info', 'Retrying download from other mirrors...');
//             exclude.push(err.pointer.farmer.nodeID);
//             module.exports.download.call(
//               self,
//               bucket,
//               id,
//               filepath,
//               { exclude: env.exclude.join(',')}
//             );
//           });
//         }).pipe(through(function(chunk) {
//           received += chunk.length;
//           log('info', 'Received %s of %s bytes', [received, stream._length]);
//           this.queue(chunk);
//         })).pipe(decrypter).pipe(target);
//       });
//     });
//   });
//
// };

module.exports = Downloader;
