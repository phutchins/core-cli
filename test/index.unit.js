'use strict';
var expect = require('chai').expect;
var proxyquire = require('proxyquire');

var account = {};
var buckets = {};
var contacts = {};
var files = {};
var frames = {};
var keys = {};
var Uploader = {};
var Downloader = {};
var seed = {};

var index = proxyquire('../bin/index.js', {
  './actions/account': account,
  './actions/buckets': buckets,
  './actions/contacts': contacts,
  './actions/files': files,
  './actions/frames': frames,
  './actions/keys': keys,
  './actions/uploader': Uploader,
  './actions/downloader': Downloader,
  './actions/seed': seed,
});

describe('index', function() {
  it('should require all necessary classes', function() {
    expect(index.account).to.equal(account);
    expect(index.buckets).to.equal(buckets);
    expect(index.contacts).to.equal(contacts);
    expect(index.files).to.equal(files);
    expect(index.keys).to.equal(keys);
    expect(index.Uploader).to.equal(Uploader);
    expect(index.Downloader).to.equal(Downloader);
    expect(index.seed).to.equal(seed);
  });
});
