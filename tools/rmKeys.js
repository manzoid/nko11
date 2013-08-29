var riak = require("riak-js"),
    db_options = {clientId: "rmKeys", host: '173.255.241.132'};

var db = riak.getClient(db_options);

db.keys(process.argv[2], function(err, keys) {
  console.log("Remove keys from ("+process.argv[2]+")...");
  keys.forEach(function(key) {
    db.remove(process.argv[2], key);
  });
});

