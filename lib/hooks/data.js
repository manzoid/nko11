var uuid = require('node-uuid'),
    riak = require('riak-js'),
    util = require('util'),
    db_options = {clientId: 'dataHook', host: '173.255.241.132'};

var Data = function(opts) {
  var emitter = opts.emitter;
  var self = this;

  emitter.on('data::createCard', function(data) {
    var cb = data.cb;
    var body = data.body;
    var card = {uuid: uuid(), created: new Date().getTime()};
    for (var p in body) {
      card[p] = body[p];
    }

    var db = riak.getClient(db_options);
    db.save('cards', card.uuid, card, {}, function(err) {
      cb(err, card);
    });
  });
  
  emitter.on('data::generatePin', function(data) {
    var cb = data.cb,
        signature_id = data.signature_id;

    function generatePin(pinCb) {
      var pin = "" + Math.floor(Math.random()*99999),
          pin_len = pin.length,
          MAX_PIN = 5;
    
      for (var i = (MAX_PIN - pin.length); i > 0; i--) {
        var pinsplit = pin.split();
        pinsplit.shift('0')
        pin = pinsplit.join("");
      }

      db.get("pins", pin, function(err, _pin) {
        if (err) return pinCb(pin);
        //potential for infinite recursion...
        return generatePin(pinCb);
      });
    }

    var db = riak.getClient(db_options);

    generatePin(function(pin) {
      db.save('pins', pin, {signature_id: signature_id, created: new Date().getTime()}, {}, function(err) {
        cb(err, pin);
      });
    });
  });

  emitter.on('data::savePin', function(data) {
    var cb = data.cb;
    var body = data.body;
    var signature_id = data.signature_id;
    emitter.emit('data::generatePin', {
      signature_id: signature_id,
      cb: function(err, pin) {
        var db = riak.getClient(db_options);
        db.get('signatures', signature_id, function(err, signature, meta) {
          signature.pin = pin;
          db.save('signatures', signature_id, signature, meta, function(err) {
            cb(err, pin);
          });
        });
      }
    });
  });

  emitter.on('data::activateSignature', function(data) {
    var cb = data.cb;
    var body = data.body;
    var signature_id = data.signature_id;
    var db = riak.getClient(db_options);
    db.get('signatures', signature_id, function(err, signature, meta) {
      signature.active = true;
      db.save('signatures', signature_id, signature, meta, function(err) {
        emitter.emit('card::signature', signature);
        cb(err, data);
      });
    });
  });

  emitter.on('data::signCard', function(data) {
    var cb = data.cb;
    var body = data.body;
    var signature_id = uuid();
    emitter.emit('data::generatePin', {
      signature_id: signature_id,
      cb: function(err, pin) {
        var signed = {
          uuid: signature_id,
          card_id: data.card_id,
          created: new Date().getTime(),
          pin: pin
        };

        for (var p in body) {
          signed[p] = body[p];
        }

        var db = riak.getClient(db_options);
        db.save('signatures', signed.uuid, signed, {}, function(err) {
          //Possibly move after the last step in this process?
          cb(err, signed);
        });
      }
    });
  });
}

module.exports = function(opts) {
  return new Data(opts);
}
