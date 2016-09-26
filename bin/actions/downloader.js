'use strict';
var log = require('./../logger')().log;
var utils = require('./../utils');
var fs = require('fs');
var path = require('path');
var storj = require('../..');

function Downloader(client, keypass, options) {
  if (!(this instanceof Downloader)) {
    return new Downloader(client, keypass, options);
  }

  this.bucket = options.bucket;
  this.client = client;
  this.keypass = keypass;

}



module.exports.getInfo = function(bucketid, fileid, callback) {
  var client = this._storj.PrivateClient();
  var fileMatch = null;

  client.listFilesInBucket(bucketid, function(err, files) {
    if (err) {
      log('error', err.message);
      return callback(null);
    }

    if (!files.length) {
      log('warn', 'There are no files in this bucket.');
      return callback(null);
    }

    files.forEach(function(file) {
      if (fileid === file.id) {
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

module.exports.download = function(bucket, id, filepath, env) {
  var self = this;
  var destination = filepath;

  if (storj.utils.existsSync(filepath) && fs.statSync(filepath).isFile()) {
    return log('error', 'Refusing to overwrite file at %s', filepath);
  }

  if (!storj.utils.existsSync(path.dirname(filepath))) {
    return log('error', '%s is not an existing folder', path.dirname(filepath));
  } else if(fs.statSync(path.dirname(filepath)).isDirectory() === false) {
    return log('error', '%s is not an existing folder', path.dirname(filepath));
  }

  module.exports.getInfo.call(self, bucket, id, function(file) {
    var target;

    if (file === null) {
      return log('error', 'file %s does not exist in bucket %s', [id, bucket]);
    }

    // Check if path is an existing path
    if (storj.utils.existsSync(filepath) === true ) {
      // Check if given path is a directory
      if (fs.statSync(filepath).isDirectory() && file !== null) {

        // use the file name as the name of the file to be downloaded to
        var fullpath = path.join(filepath,file.filename);

        // Make sure fullpath doesn't already exist
        if (storj.utils.existsSync(fullpath)) {
          return log('error', 'Refusing to overwrite file at %s', fullpath);
        }

        destination = fullpath;
        target = fs.createWriteStream(fullpath);
      } else {
        target = fs.createWriteStream(filepath);
      }
    } else {
      if (filepath.slice(-1) === path.sep) {
        return log('error', '%s is not an existing folder', filepath);
      }
      target = fs.createWriteStream(filepath);
    }

    utils.getKeyRing(keypass, function(keyring) {
      var secret = keyring.get(id);

      if (!secret) {
        return log('error', 'No decryption key found in key ring!');
      }

      var decrypter = new storj.DecryptStream(secret);
      var received = 0;
      var exclude = env.exclude.split(',');

      target.on('finish', function() {
        log('info', 'File downloaded and written to %s.', [destination]);
      }).on('error', function(err) {
        log('error', err.message);
      });

      client.createFileStream(bucket, id, {
        exclude: exclude
      },function(err, stream) {
        if (err) {
          return log('error', err.message);
        }

        stream.on('error', function(err) {
          log('warn', 'Failed to download shard, reason: %s', [err.message]);
          fs.unlink(filepath, function(unlinkFailed) {
            if (unlinkFailed) {
              return log('error', 'Failed to unlink partial file.');
            }

            if (!err.pointer) {
              return;
            }

            log('info', 'Retrying download from other mirrors...');
            exclude.push(err.pointer.farmer.nodeID);
            module.exports.download.call(
              self,
              bucket,
              id,
              filepath,
              { exclude: env.exclude.join(',')}
            );
          });
        }).pipe(through(function(chunk) {
          received += chunk.length;
          log('info', 'Received %s of %s bytes', [received, stream._length]);
          this.queue(chunk);
        })).pipe(decrypter).pipe(target);
      });
    });
  });

};

module.exports = Downloader;
