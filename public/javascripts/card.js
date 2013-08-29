var MESSAGE_WIDTH = 800;

var soundInitQueue = [];
var soundManagerReady = false;

// Set up the url base for finding the fallback swiffage.
soundManager.url = '/swf/';

soundManager.onready(function() {
  // Just in case, queue up any sprite inits that happened before
  // SM2 is done with all its probe-age.
	soundManagerReady = true;
  soundInitQueue.forEach(function(soundInitRequest) {
    var sound = soundManager.createSound(soundInitRequest.soundParams);
    soundInitRequest.sprite.sound = sound;
    soundInitRequest.sprite = null;
  })
});

var soundPlaying = false;
var currentListSounds = [];
function clearSound() {
  resetMessageLinkOrIconToPlay(this.sID);
  currentListSounds.filter(function(sound) {
    return sound.sID != this.sID;
  });
}
// Handle live updates of signatures.
$(document).ready(function() {
  now.receiveSignature = function(name, signature){
    addLiveSigToSpriteQueue(signature);
    addLiveSigToBottomList(signature);
  }
});

function addLiveSigToBottomList(newSignature) {
  console.log('addLiveSigToBottomList: ' + newSignature);
  var urlBase = "/card/" + newSignature.card_id + '/' + newSignature.uuid;
  $.ajax({
    url: urlBase + '/single-signature',
    cache: false,
    success: function(html){
      $('#signature-list-box').prepend(html).fadeIn(500);
    }
  });
}

function resetMessageLinkOrIconToPlay(sID) {
  // Reset link or icon to play state.
  $('.message-link[recording-url="' + sID + '"]').html('PLAY');
}

$(document).ready(function() {
  $("#signature-list-box .timestamp").cuteTime();
  
  $('.message-link').click(function(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    $this = $(this);
    var soundUrl = $this.attr('recording-url');

    // Clear out anything currently playing.
    var wasThisSoundPlaying = false;
    currentListSounds.forEach(function(sound) {
      if (sound.sID == soundUrl) {
        wasThisSoundPlaying = true;
      }
      resetMessageLinkOrIconToPlay(sound.sID);
      sound.stop();
    })
    currentListSounds = [];

    if (wasThisSoundPlaying) {
      // Reset link or icon to play state.
      $this.html('PLAY');
      return false;
    }

    // Start a new play for this sound.
    // Set link or icon to playing (stop) state.
    $this.html('STOP');
        
    var soundParams = {
      id: soundUrl,
      url: soundUrl,
      volume: 100,
      onfinish: $.proxy(clearSound, {sID: soundUrl})
    }
    var sound = soundManager.createSound(soundParams);
    sound.play();
    currentListSounds.push(sound);

    return false;
  });
});
