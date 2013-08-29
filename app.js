var http = require('http'),
    express = require('express'),
    connectForm = require('connect-form'),
    riak = require('riak-js'),
    sass = require('sass'),
    fs = require('fs'),
    email = require('nodemailer'),
    nowjs = require('now'),
    jade = require('jade'),
    TropoWebApi = require('tropo-webapi'),
    TropoJSON = TropoWebApi.TropoJSON,
    db_options = {clientId: 'imageHook', host: '173.255.241.132' },

    //hooks
    parentEmitter = require('./lib/hooks/parent')();

email.SMTP = {
  host: "localhost",
  port: 25,
  domain: "localhost"
};


var app = module.exports = express.createServer();

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');

  var pub = __dirname + '/public';
  app.use(connectForm({keepExtensions: true}));
  app.use(express.compiler({ src: pub, enable: ['sass'] }));
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  app.use(express.session({
    secret: 'de29dce7b5fc9ab7ceff133f1f37a132'
  }));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});


var getSignaturesRevChron = {
  map: function(v, k, args) {
         var data = Riak.mapValuesJson(v)[0];
         if (data.card_id == args[0]) {
           return [data];
         }
         return [];
       },
  reduce: function(values, args) {
            return values.sort(function(a, b) {
              if (a.created && b.created) return a.created < b.created;
              return 0;
            });
          }
};

//
// Routes

app.get('/no_ie', function(req, res) {
  res.render('no_ie', {title: 'No IE'});
});

app.get('/cards', function(req, res) {
  var db = riak.getClient(db_options);
  db.getAll('cards', function(err, cards) {
    res.render('cards', { title: "Card list", cards: cards });
  });
});

//
// The signature-capture page.
app.post('/card/:card_id/:signature_id/signpad', function(req, res){
  req.form.complete(function(err, fields, files) {
    parentEmitter.emit(
      'image::signature',
      {
        signature_id: req.params.signature_id,
        body: fields,
        cb: function(err, data) {
          res.redirect('/card/'+req.params.card_id+"/"+req.params.signature_id+"/preview");
        }
      });
  });
});

function decorateThemeObject(theme) {
  if (!(theme.width)) theme.width = 960;
  if (!(theme.height)) theme.height = 640;
  if (!(theme.spriteWidth)) theme.spriteWidth = 300;
  if (!(theme.spriteHeight)) theme.spriteHeight = 300;
  if (!(theme.moveStyle)) theme.moveStyle = 'down';
  theme.defaultSpriteImageUrl = '/images/yellow_balloon_300_sprite.png';
  theme.defaultSpriteImageEditMaskUrl = '/images/yellow_balloon_300_mask_frame.png';

  theme.backgroundImageUrl = '/themes/' + theme.uuid + '/images/' + theme.background;
  if (theme.supporting_files) {
    theme.supporting_files.forEach(function(file){
      if (file.indexOf('sprite.png') != -1) {
        theme.spriteImageUrl = '/themes/' + theme.uuid + '/images/' + file;
      } else if (file.indexOf('sprite_edit.png') != -1) {
        theme.spriteImageEditMaskUrl = '/themes/' + theme.uuid + '/images/' + file;
      }
    });
  }
}

// The signature-capture page.
app.get('/card/:card_id/:signature_id/signpad', function(req, res){
  var db = riak.getClient(db_options);
  db.get('cards', req.params.card_id, function(err, card) {
    db.get('themes', card.theme, function(err, theme) {
      
      // Dump
      for(var prop in theme) {
        console.log(prop + ': ' + theme[prop]);
      }
      
      decorateThemeObject(theme);

      res.render('signpad', {
        card: card,
        theme: theme,
        title: 'Draw or write on the card',
      });
    });
  });
});

app.get('/card/:card_id/:signature_id/recording', function(req, res) {
  var db = riak.getClient(db_options);
  db.getLarge("recording-"+req.params.signature_id, {}, function(err, buf) {
    if (err) {
      console.log('err: ' + err);
      res.writeHead(err.statusCode, {});
      res.end();
      return;
    }

    res.writeHead(200, {"Content-Type":"audio/mp3", 'Content-Length': buf.length});
    res.end(buf);
  });
});

app.get('/card/:card_id/:signature_id/regen-pin', function(req, res) {
  parentEmitter.emit('data::savePin', {
    signature_id: req.params.signature_id,
    cb: function(err, pin) {
      res.redirect('/card/'+req.params.card_id+'/'+req.params.signature_id+'/preview');
    }
  });
});

app.get('/card/:card_id/:signature_id/preview', function(req, res){
  var db = riak.getClient(db_options);
  db.get('signatures', req.params.signature_id, function(err, signature, meta) {
    res.render('signature_preview', {
      title: "Signature preview",
      card_id: req.params.card_id,
      signature_id: req.params.signature_id,
      signature: signature,
      });
  });
});


app.post('/card/:card_id/sign', function(req, res) {
  req.form.complete(function(err, fields, files) {
    parentEmitter.emit(
      'data::signCard',
      {
        card_id: req.params.card_id,
        body: fields,
        cb: function(err, data) {
            //res.json(data);
            res.redirect('/card/'+req.params.card_id+'/'+data.uuid+'/signpad');
          }
      });
  });
});

app.post('/card/:card_id/:signature_id/save-signature', function(req, res) {
  req.form.complete(function(err, fields, files) {
    parentEmitter.emit('data::activateSignature', {
      card_id: req.params.card_id,
      signature_id: req.params.signature_id,
      cb: function(err, data) {
        // TODO(nick): fire off activation event.
        res.redirect('/card/' + data.card_id);
      }
    });
  });

});


app.get('/card/:card_id/:signature_id/image', function(req, res) {
  var db = riak.getClient(db_options);
  db.get('signatures', req.params.signature_id, function(err, signature, meta) {
    db.getLarge(meta.key, {}, function(err, buf) {
      if (err) {
        console.log('err: ' + err);
        res.writeHead(err.statusCode, {});
        res.end();
        return;
      }

      res.writeHead(200, {'Content-Type': 'image/png', 'Content-Length':buf.length});
      res.end(buf);
    });
  });
});

app.post('/card/:card_id/sign', function(req, res) {
  req.form.complete(function(err, fields, files) {
    parentEmitter.emit(
      'data::signCard',
      {
        card_id: req.params.card_id,
        body: fields,
        cb: function(err, data) {
            //res.json(data);
            res.redirect('/card/'+req.params.card_id+'/'+data.uuid+'/signpad');
          }
      });
  });
});

app.get('/card/:card_id/sign', function(req, res) {
  var db = riak.getClient(db_options);
  db.get('cards', req.params.card_id, function(err, card) {
    res.render('sign', {
        card: card,
        title: 'Sign it up!'
    });
  });
});

// Render the delivered card.
app.get('/card/:card_id', function(req, res){
  var db = riak.getClient(db_options);
  db.get('cards', req.params.card_id, function(err, card) {
    db.get('themes', card.theme, function(err, theme) {
      decorateThemeObject(theme);

      db
        .add('signatures')
        .map(getSignaturesRevChron.map, [req.params.card_id])
        .reduce(getSignaturesRevChron.reduce)
        .run(function(err, signatures) {
          res.render('card', {
            card: card,
            signaturesJSON: JSON.stringify(signatures),
            signatures: signatures,
            layout: false,
            theme: theme
          });
        });
    });
  });

  everyone.on('join', function() {
    var card_id = req.params.card_id;
    var group = null;
    if (!(nowGroups[card_id])) {
      nowGroups[card_id] = new nowjs.Group();
    }
    group = nowGroups[card_id];
    group.addUser(this.user.clientId);
  });
});

// Render a single signature
app.get('/card/:card_id/:signature_id/single-signature', function(req, res){
  var db = riak.getClient(db_options);
  db.get('signatures', req.params.signature_id, function(err, signature, meta) {
    res.render('signature', {
      title: "Single signature",
      card_id: req.params.card_id,
      signature_id: req.params.signature_id,
      signature: signature,
      layout: false,
      });
  });
});


app.get('/card', function(req, res) {
  res.render('card_land', {
    layout: false
  });
});

app.get('/card_test', function(req, res) {
  res.render('card_test', {
    layout: false
  });
});

app.post('/create-card', function(req, res) {
  req.form.complete(function(err, fields, files) {
    parentEmitter.emit(
      'data::createCard',
      {
        body: fields,
        cb: function(err, card) {
          res.redirect('/card/'+card.uuid+'/sign');
          
          //send emails

          var card_url = 'http://bearshark.nko2.nodeknockout.com/card/'+card.uuid;
          //to the recip
          email.send_mail({
              to: card.to_email,
              sender: '"Greetings Cardling" <noreply@bearshark.nko2.nodeknockout.com>',
              subject: "A greeting card has been created just for you.",
              html: "Greetings "+card.to_email+",<br /><br />You have recieved <a href=\""+card_url+"\">a card<a/>. Why not take a peek and see who's signing it?<br />The card can be found at: <a href=\""+card_url+"\">"+card_url+"</a><br /><br />---<br /><br />This is an automated message from <a href=\"http://bearshark.nko2.nodeknockout.com/\">Greetings Cardling</a><br/>a project written for <a href=\"http://nodeknockout.com/\">Node Knockout</a>."
          }, function(err, res) {
            if (err) console.log(err);
          });
          
          //to creator
          email.send_mail({
                to: card.from_email,
                sender: '"Greetings Cardling" <noreply@bearshark.nko2.nodeknockout.com>',
                subject: "Information about the greeting card you created.",
                html: "Greetings,<br /><br />You created a greeting card so we wanted to provide you with some information.<br /><br />Because this is collaborative you may want to share this with friends of "+card.to_name+". To do so just copy "+card_url+"/sign and paste it into your social media outlet or email client and fire away.<br/><br/>You can also see who else has signed <a href=\""+card_url+"\">the card you made</a>.<br />The card can be found at: <a href=\""+card_url+"\">"+card_url+"</a><br /><br />---<br /><br />This is an automated message from <a href=\"http://bearshark.nko2.nodeknockout.com/\">Greetings Cardling</a><br/>a project written for <a href=\"http://nodeknockout.com/\">Node Knockout</a>."
          }, function(err, res) {
            if (err) console.log(err);
          });

        }
      })
  });
});

function themeDataForCreate(v, k, args) {
  var data = Riak.mapValuesJson(v)[0];
  return [{title: data.title, key: v.key}];
}

app.get('/create-card', function(req, res) {
  var db = riak.getClient(db_options);
  db
    .add('themes')
    .map(themeDataForCreate)
    .run(function(err, themes) {
      res.render('create', {
          title: 'Create Me A Card',
          themes: themes
      });
    });
});


//Themes stuff
app.post('/themes/upload', function(req, res) {
  req.form.complete(function(err, fields, files) {
    parentEmitter.emit(
      'themes::upload',
      {
        fields: fields,
        files: files,
        cb: function(err, data) {
          res.redirect('/themes/'+data.uuid);
        }
      });
  });
});

app.get('/themes/:theme_id/images/:image_id', function(req, res) {
  var db = riak.getClient(db_options);
  db.getLarge(req.params.image_id, {}, function(err, buf) {
    if (err) {
      console.log('err: ' + err);
      res.writeHead(err.statusCode, {});
      res.end();
      return;
    }

    res.writeHead(200, {'Content-Type': 'image/png', 'Content-Length': buf.length});
    res.end(buf);
  });
});

app.get('/themes/:theme_id', function(req, res) {
  var db = riak.getClient(db_options);
  db.get("themes", req.params.theme_id, function(err, theme, meta) {
    res.render('theme', {
      title: 'Theme Page',
      theme: theme
    });
  });
});

app.get('/themes', function(req, res) {
  var db = riak.getClient(db_options);
  db.getAll('themes', function(err, themes) {
    res.render('themes', {
      title: 'Themes',
      themes: themes
    });
  });
});

app.post('/tropo/verify-pin', function(req, res) {
  //had to handle this shit for some reason connect-form wasn't having it...
  var chunks = [],
      total = 0;
  req.on('data', function(data) {
    chunks.push(data);
    total += data.length;
  });
  req.on('end', function() {
    var buf = new Buffer(total);
    var chunk_count = chunks.length;
    var offset = 0;
    for (var i = chunk_count; i > 0; i--) {
      var chunk = chunks.pop();
      chunk.copy(buf, offset, 0);
      offset += chunk.length;
    }

    var data = JSON.parse(buf.toString());
    
    var pin = data.result.actions.value;
    var db = riak.getClient(db_options);
    db.get("pins", pin, function(err, pin, meta) {
      var tropo = new TropoWebApi.TropoWebAPI();
      if ((err && err.statusCode === 404) || ((new Date().getTime()) - pin.created >= 600000)) {
        tropo.say("Invalid pin number, please create another and try again later");
      } else {
        var say = new Say("You have thirty seconds to record your message. If you finish before, hang up.");
        tropo.record(1, null, true, null, 'audio/mp3', 5, 30, null, 5, "message", true, say, 30, null, "http://bearshark.nko2.nodeknockout.com/tropo/recordings/"+pin.signature_id);
        tropo.say("Thank you. Your message has been recorded. Goodbye");
      }

      var _j = TropoJSON(tropo);
      res.send(_j);
      
      //lazily cleanup the pin
      db.remove("pins", meta.key, function(err) {
      });
    });
  });
});

app.post('/tropo/handle-call', function(req, res) {
  var tropo = new TropoWebApi.TropoWebAPI();
  tropo.say("Greetings earthling.");
  var say = new Say("Please enter your 5 digit pin.");
  var choices = new Choices("[5 DIGITS]");
  tropo.ask(choices, 3, null, null, "validate", null, true, say, 5, null);
  tropo.on("continue", null, "http://bearshark.nko2.nodeknockout.com/tropo/verify-pin", true);

  var _j = TropoJSON(tropo);
  res.send(_j);
});

app.post('/tropo/recordings/:signature_id', function(req, res) {
  req.form.complete(function(err, fields, files) {
    var signature_id = req.params.signature_id,
        recording_id = 'recording-'+signature_id;
    var db = riak.getClient(db_options);
    db.get('signatures', signature_id, function(err, signature, meta) {
      fs.readFile(files.filename.path, function(err, buf) {

        signature.recording_id = recording_id;
        db.save("signatures", signature_id, signature, meta, function(err_sig) {
          db.saveLarge(recording_id, buf, function(err2) {
            res.send('');
          });
        });
      });
    });
  });
});

//
// TODO: Make a landing page.
app.get('/', function(req, res){
  var db = riak.getClient(db_options);
  db
    .add('themes')
    .map(themeDataForCreate)
    .run(function(err, themes) {
      res.render('index', {
        title: 'Real-time, collaborative greetings for humanoids and their friends.',
        themes: themes
    });
  });
});


app.listen(process.env.NODE_ENV === 'production' ? 80 : 8000); 

console.log('Server listening on ' + app.address().port);

process.on("exit", function() {
  console.log("Shutdown Server.");
});

process.on("SIGINT", function() {
  console.log("Server interupted.");
  process.exit(0);
});

// nowjs integration
var everyone = nowjs.initialize(app);
var nowGroups = {};

parentEmitter.on("card::signature", function(signature) {
  var group = nowGroups[signature.card_id];
  if (group) {
    group.now.receiveSignature("new", signature);
  }
});
