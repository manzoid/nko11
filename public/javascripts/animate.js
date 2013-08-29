var gamejs = require('gamejs');

var TEST_SPEED_BOOST = 1;

// TODO: Need to be able to set this from outside, both at init time and
// dynamically in response to socket.io events.
// In either case, we should be able to handle a list of Signature objects.
// See sample below for the spec.

var messageIconUrl = 'images/09-chat-2.png';
var soundIconUrl = 'images/120-headphones.png';

// Module globals.
var allSpriteGroups;
var actionPaused = false;
var closingOverlay = false;
var activeSprites = [];
var sigList;

function initSprites(initialSigList) {
  // Tuck this away for queue munging.
  sigList = initialSigList;
  
  // Other boilerplate sample stuff to load.
  // TODO: make these live, too, based on the card theme spec object, which still needs to be passed in.
  var resources = [messageIconUrl];
  
  resources.push(cardSpec.backgroundImageUrl);

  sigList.forEach(function(sig) {
    resources.push(sig.spriteImageUrl);
  });
  gamejs.preload(resources);
  gamejs.ready(main);
}
window['initSprites'] = initSprites; // Export function.

/**
 * Called when socket.io brings us fresh entries.
 */
function addLiveSigToSpriteQueue(sig) {
  sigList.unshift(sig);
  var urlBase = '/card/ ' + sig.card_id + '/' + sig.uuid;

  sig.spriteImageUrl = urlBase + '/image';
  var resources = gamejs.preload([sig.spriteImageUrl]);
  // Have to run this manually since it looks like gamejs isn't geared toward having
  // stuff load on the fly, which seems dumb...
  gamejs.image.preload(resources);
}
window['addLiveSigToSpriteQueue'] = addLiveSigToSpriteQueue; // Export function.

/**
 * @param {array} startCoord The starting coordinates.
 * @param {Object} signatureEntry The object, tbd, that stores the signature data.
 * @param {number} speed A speed value.
 * @param {string} opt_imageUrl Optional image url.
 * @param {function} opt_callback Optional click callback.
 */
function SignatureSprite(startCoord, signatureEntry, speed, opt_imageUrl, opt_callback) {
   SignatureSprite.superConstructor.apply(this, arguments);

   this.signatureEntry = signatureEntry;
   this.origImage = gamejs.image.load(opt_imageUrl ? opt_imageUrl : signatureEntry.spriteImageUrl);
   this.image = this.origImage;

   this.speed = speed;
   this.rect = new gamejs.Rect(startCoord, this.image.getSize());

   if (signatureEntry.soundUrl) {
     var soundParams = {
       id: signatureEntry.uuid,
       url: signatureEntry.soundUrl,
       volume: 100,
     }
     if (soundManagerReady) {
       this.sound = soundManager.createSound(soundParams);
     } else {
       // Queue until soundmanager is ready, if ever.
       soundInitQueue.push({
         soundParams: soundParams,
         sprite: this
       })    
     }
   }

   if (opt_callback) {
     this.onclick = $.proxy(opt_callback, this);
   }

   this.currentDelta = 0;
  
   return this;
};
gamejs.utils.objects.extend(SignatureSprite, gamejs.sprite.Sprite);

SignatureSprite.prototype.update = function(msDuration) {
  // "moveIp" = move in place. Mm-hmm.
  if (cardSpec.moveStyle == 'up' || cardSpec.moveStyle == 'down') {
   this.rect.moveIp(0, this.speed * (msDuration/1000));
  } else {
   this.rect.moveIp(this.speed * (msDuration/1000), 0);
  }

  // Determine when it's off-screen, and destroy it.
  if (this.rect.bottom < 0 || this.rect.top > cardSpec.height
      || this.rect.left > cardSpec.width || this.rect.right < 0) {
     if (this.hasBeenOnscreenBefore) {
       this.kill();
     }
  } else {
    this.hasBeenOnscreenBefore = true;
  }

  // Check if the delta from our original position is about half the screen?
  if (!(this instanceof SignatureButtonSprite)) {
    if (!this.launchedSuccessor) {
      this.currentDelta += Math.abs(this.speed * msDuration / 1000);
      var aboutHalfway = false;
      var nudge = 0.5 + 0.3*Math.random() + 0.2*Math.random();
      if (cardSpec.moveStyle == 'up' || cardSpec.moveStyle == 'down') {
        if (this.currentDelta > cardSpec.height * nudge) {
          aboutHalfway = true;
        }
      } else {
        if (this.currentDelta > cardSpec.width * nudge) {
          aboutHalfway = true;
        }
      }
      if (aboutHalfway) {
        this.launchedSuccessor = true;
        var delay = 2000 * Math.random() + 2000 * Math.random();
        setTimeout(addSpriteFromQueue, delay);
      }
    }
  }
};

function SignatureButtonSprite(startCoord, signatureEntry, speed, iconUrl, callback) {
  SignatureButtonSprite.superConstructor.apply(this, arguments);

  // Hm is there any point to having a separate child class at this point?
  // Seems like all the shit moved up into the parent. =/

  return this;
};
gamejs.utils.objects.extend(SignatureButtonSprite, SignatureSprite);

function addSpriteFromQueue() {
  var sig = sigList.shift();
  if (!sig) {
    // This should only ever happen if we initialized with zero signatures.
    return;
  }
  addSignatureSprite(sig);
  
  // Cycle it back to the back of the list.
  sigList.push(sig);
}

/**
 * Add "a" sprite, which is really 1 to 3 sprites in a sprite group,
 * the main sprite plus 0, 1, or 2 buttons (sound and text).
 */
function addSignatureSprite(signatureEntry) {
  var speed = 20 + 20 * Math.random() + 20 * Math.random() + 20 * Math.random();
  speed *= TEST_SPEED_BOOST;
  if (cardSpec.moveStyle == 'up' || cardSpec.moveStyle == 'left') {
    speed *= -1;
  }
  // Parameterize the entry point (top|bottom|left|right) according to the cardspec.
  // Randomize the entry point value along the chosen card side. 
  //var spriteSize = sprite.image.getSize();
  var spriteWidth = cardSpec.spriteWidth;//spriteSize[0];
  var spriteHeight = cardSpec.spriteHeight;//spriteSize[1];
  
  if (cardSpec.moveStyle == 'up' || cardSpec.moveStyle == 'down') {
    var startPoint = (cardSpec.width - spriteWidth) * Math.random();
    if (startPoint + spriteWidth > cardSpec.width) {
      startPoint = cardSpec.width - spriteWidth;
    }
    if (cardSpec.moveStyle == 'up') {
      var startCoord = [startPoint, cardSpec.height];
    } else {
      var startCoord = [startPoint, 0 - spriteHeight];
    }
  } else {
    startPoint = (cardSpec.height - spriteHeight) * Math.random();
    if (startPoint + spriteHeight > cardSpec.height) {
      startPoint = cardSpec.height - spriteHeight;
    }
    if (cardSpec.moveStyle == 'left') {
      startCoord = [cardSpec.width, startPoint];
    } else {
      startCoord = [0 - spriteWidth, startPoint];
    }
  }

  var signatureSpriteGroup = new gamejs.sprite.Group();

  // Add the main/background sprite.
  var signatureSprite = new SignatureSprite(startCoord, signatureEntry, speed, null, showText);
  signatureSpriteGroup.add(signatureSprite);
  
  // TODO - is there some way to get the dimensions of this thing
  // YES: sprite.image.getSize() = [300,300]
  
  // Draw icons, if any.
  if (signatureEntry.message) {
    // Draw the typed-message icon.
    iconStartCoord = [startCoord[0] + (cardSpec.spriteWidth/2 - 13), startCoord[1] + (cardSpec.spriteHeight-50)];
    var messageButtonSprite = new SignatureButtonSprite(
        iconStartCoord, signatureEntry, speed, messageIconUrl, showText);
    signatureSpriteGroup.add(messageButtonSprite);
  }

  allSpriteGroups.push(signatureSpriteGroup);
}


function pauseAllSprites() {
  actionPaused = true;
}

function restartAllSprites() {
  activeSprites.forEach(function(sprite) {
    if (sprite.sound) {
      sprite.sound.stop();
    }
  });
  activeSprites = [];
  actionPaused = false;
}

// This should be bound to the actual instance dynamically.
// We can do it other ways but this'll do for now.
function showText() {
  // Stop all the action
  pauseAllSprites();

  activeSprites.push(this);
  
  if (this.sound) {
    this.sound.play();
  }

  // Set the text to the current signature's message.
  $("#message-content").html(this.signatureEntry.message);

  // Center before showing...
  var canvasWidth = $('canvas').width();
  var width = MESSAGE_WIDTH;
  var left = (canvasWidth - width);
  //$("#message-overlay").css('left', left + 'px');

  var canvasHeight = $('canvas').height();
  var height = $("#message-overlay").height();
  if (canvasHeight - height < 0) {
    var top = 10; // Bit of margin for really long messages that go past bottom of card.
  } else {
    top = (canvasHeight - height) / 3;
  }
  // Have to set top in the overlay() init call below, not sure why.
  $("#message-overlay").css('top', top + 'px'); 

  
  $('body').bind('mouseup.card', handleTextCloseEvent);
  $('canvas').bind('touchstart.card', handleTextCloseEvent);
    
  $('canvas').css('cursor', 'pointer');
  $("#message-overlay").overlay({
    fixed: false,
    oneInstance: true,
    mask: '#FFF',
    closeOnClick: true,
    left: left,
    //top: top, // Not sure why this one has to be set -- left doesn't really work.
    api: false,
    load: true
  });

  $("canvas").fadeTo(300, 0.2);  
  $("#message-overlay")[0].style.top = top + 'px'; 
  $("#message-overlay").fadeIn(300, function() {
    $("#message-overlay")[0].style.top = top + 'px'; 
  });

}

function handleTextCloseEvent(evt) {
  closingOverlay = true;
  restartAllSprites();
  
  $("canvas").fadeTo(300, 1);
  $("#message-overlay").fadeOut(200, function() {
    $("#message-content").html('');
    var overlay = $('#message-overlay').overlay();
    if (overlay) {
      overlay.close();
    }
    
    
    $('canvas').unbind('touchstart.card');
    $('body').unbind('mouseup.card');
    
    evt.stopPropagation();
    evt.preventDefault();
    context = $('canvas')[0].getContext("2d");
    context.globalAlpha = 1;
    $('canvas').css('cursor', '');
    closingOverlay = false;
  })
}



function main() {
   $('canvas').width = cardSpec.width;
   $('canvas').height = cardSpec.height;
   
   // screen setup
   gamejs.display.setMode([cardSpec.width, cardSpec.height]);
   
   allSpriteGroups = [];
   
   // Add first sprite from queue.
   addSpriteFromQueue();

   // game loop
   var mainSurface = gamejs.display.getSurface();
   var bgImage = gamejs.image.load(cardSpec.backgroundImageUrl, cardSpec.width, cardSpec.height);

   // msDuration = time since last tick() call
   var tick = function(msDuration) {
     if (actionPaused) {
       return;
     }
     gamejs.event.get().forEach(evaluateEvent);
         mainSurface.blit(bgImage);
         // update and draw the signatures.
         allSpriteGroups.forEach(function(spriteGroup) {
           spriteGroup.update(msDuration);
           spriteGroup.draw(mainSurface);
         })
   };
   gamejs.time.fpsCallback(tick, this, 20);
}

function evaluateEvent(event) {
    if (closingOverlay) {
      return;
    }
    if (event.type === gamejs.event.MOUSE_UP) {
      for (var i = 0; i < allSpriteGroups.length; i++) {
        var spriteGroup = allSpriteGroups[i];
        var clickedSprites = spriteGroup.collidePoint(event.pos);
        if (clickedSprites.length) {
          for (var j = 0; j < clickedSprites.length; j++) {
            var clickedSprite = clickedSprites[j];
            if (clickedSprite.onclick) {
              clickedSprite.onclick();
              // We'll take the first onclick we find, to avoid confusion.
              break;
            }
          }
          
         // No need to look at other sprite groups.
         break; 
        }
      }
    }
}

// Call back out to the global context to grab data... this is irritating.
initData();
