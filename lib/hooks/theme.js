var uuid = require('node-uuid'),
    riak = require('riak-js'),
    zip = require('zip'),
    uuid = require('node-uuid'),
    fs = require('fs'),
    util = require('util'),
    db_options = {clientId: 'themeHook', host: '173.255.241.132' };

var Theme = function(opts) {
  var emitter = opts.emitter;

  emitter.on('themes::upload', function(data) {
    var cb = data.cb,
        files = data.files,
        fields = data.fields,
        db = riak.getClient(db_options);

    fs.readFile(files.payload.path, function(err, buf) {
      var reader = zip.Reader(buf),
          file = reader.toObject('base64'),
          theme_uuid = uuid(),
          background = null,
          supporting_files = [],
          zip_files_len = Object.keys(file).length,
          theme = {
            uuid: theme_uuid,
            title: fields.title,
            width: fields.width,
            height: fields.height,
            spriteWidth: fields.spriteWidth,
            spriteHeight: fields.spriteHeight,
            moveStyle: fields.moveStyle
          },
          i = 0;
      
      reader.forEach(function(entry) {
        //console.log(entry);
        if (entry.isFile()) {
          var entry_key = (theme_uuid + '-' + entry.getName()).replace('/', '-');
          if (!(entry_key.match(/__MACOSX-\./))) {
            if (entry_key.match(/background/)) {
              background = entry_key;
            } else {
              supporting_files.push(entry_key);
            }

            db.saveLarge(entry_key, entry.getData(), function(err) {
              if (err) throw err;
            });
          }
        }
        i++;
      });
      reader.iterator();

      function saveTheme() {
        if (i < (zip_files_len - 1)) return setTimeout(saveTheme, 50);
        theme.background = background;
        theme.supporting_files = supporting_files;
        db.save('themes', theme_uuid, theme, {}, function(err) {
          cb(err, theme);
        }); 
      }

      setTimeout(saveTheme, 50);
    });
  });
}

module.exports = function(opts) {
  return new Theme(opts);
}
