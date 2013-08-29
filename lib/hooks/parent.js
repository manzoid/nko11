var util = require('util'),
    EventEmitter2 = require('eventemitter2').EventEmitter2;

var Parent = function() {
  this.emitter = new EventEmitter2({verbose: true});
  
  require('./image')({prefix: "image", emitter: this.emitter});
  require('./data')({prefix: "data", emitter: this.emitter});
  require('./theme')({prefix: "theme", emitter: this.emitter})

  return this.emitter;
};

module.exports = function() {
  return new Parent();
}
