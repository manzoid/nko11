var uuid = require('node-uuid'),
    riak = require('riak-js'),
    util = require('util'),
    db_options = {clientId: 'imageHook', host: '173.255.241.132' };

var Image = function(opts) {
  var emitter = opts.emitter;
  var self = this;

  emitter.on('image::signature', function(data) {
    var cb = data.cb;
    var signed = data.signed;

    if (!(data.buffer) && data.body.payload) data.buffer = new Buffer(data.body.payload.substring(22), 'base64');
    //TODO: Remove at some point but for now it fills the data in nicely.
    if (!(data.buffer)) data.buffer = new Buffer("Hai");

    //luwak
    var db = riak.getClient(db_options);
    db.saveLarge(data.signature_id, data.buffer, function(err) {
      if (err) throw err;
      cb(err);
    });
  });

  emitter.on('image::stretch', function(data) {
    var cb = data.cb;
    var signed = data.signed;

    if (!(data.buffer) && data.body.payload) data.buffer = new Buffer(data.body.payload.substring(22), 'base64');
    //TODO: Remove at some point but for now it fills the data in nicely.
    if (!(data.buffer)) data.buffer = new Buffer("Hai");

    //luwak
    var db = riak.getClient(db_options);
    db.saveLarge(data.signature_id, data.buffer, function(err) {
      if (err) throw err;
      cb(err);
    });
  });
}

module.exports = function(opts) {
  return new Image(opts);
}
