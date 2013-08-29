// Globals.
var BRUSH_SIZE = 2,
    BRUSH_PRESSURE = 10,
    COLOR = [0, 0, 0],
    brush,
    saveTimeOut,
    mouseX = 0,
    mouseY = 0,
    container,
    canvas,
    context;

var spriteMaskFrame;
var canvasOffsetLeft;
var canvasOffsetRight;

$(document).ready(function() {
  init();
});

function init() {
	container = document.createElement('div');
	$('body').append(container);

	canvas = document.createElement("canvas");
	canvas.id = 'signpad-canvas'
	/*
	canvas.width = window.innerWidth;
	var height = window.innerHeight;
	// Narrow to compensate for smaller screens.
	canvas.height = height - (height > 600 ? 50 : 40);
	*/
	canvas.width = cardSpec.spriteWidth;
	canvas.height = cardSpec.spriteHeight;
	$(canvas).insertBefore('#signpad-footer');
	
	var offset = $(canvas).offset();
  canvasOffsetLeft = offset.left;
  canvasOffsetTop = offset.top;	

	context = canvas.getContext("2d");
	context.globalCompositeOperation = 'source-over';

	brush = new Brush();
	brush.init(context);

	$(canvas).bind('mousedown', onCanvasMouseDown, false);
	canvas.addEventListener('touchstart', onCanvasTouchStart, false);
	
	$('.btn-save:hidden').show().click(handleSave);
	$('#btn-clear:hidden').show().click(handleClear);
	
  spriteMaskFrame = $('#sprite-mask-frame')[0];
  
  
  setTimeout(overlayStaticSpriteFrame, 200);
}


function overlayStaticSpriteFrame() {
  // Draw the overlay atop what's been written.
  context.drawImage(spriteMaskFrame, 0, 0, 300, 300);
}

function handleClear() {
  window.location.reload(); // Oh yeah, this is brain dead but no time.
}

function handleClip() {
	context.globalCompositeOperation = 'destination-out';
  context.drawImage(spriteMaskFrame, 0, 0, 300, 300);
  // Restore the actual sprite outline, but without
  // the masking color.
	context.globalCompositeOperation = 'destination-over'; 
  var actualSprite = $('#sprite')[0];
  context.drawImage(actualSprite, 0, 0, 300, 300);
}

function handleSave() {
  handleClip();
  $('#payload').val(canvas.toDataURL());
  $('#form-upload').submit();

}

function onCanvasMouseDown(event) {
	clearTimeout(saveTimeOut);
	brush.strokeStart(event.clientX - canvasOffsetLeft + $(window).scrollLeft(), event.clientY - canvasOffsetTop + $(window).scrollTop());
	$(window).bind('mousemove', onCanvasMouseMove);
	$(window).bind('mouseup', onCanvasMouseUp);
}

function onCanvasMouseMove(event) {
	brush.stroke(event.clientX - canvasOffsetLeft + $(window).scrollLeft(), event.clientY - canvasOffsetTop + $(window).scrollTop());
	overlayStaticSpriteFrame();
}

function onCanvasMouseUp() {
	brush.strokeEnd();
	$(window).unbind('mousemove', onCanvasMouseMove);
	$(window).unbind('mouseup', onCanvasMouseUp);
}

function onCanvasTouchStart(event) {
	if (event.touches.length == 1) {
		event.preventDefault();
		brush.strokeStart(event.touches[0].pageX - canvasOffsetLeft + $(window).scrollLeft(), event.touches[0].pageY - canvasOffsetTop + $(window).scrollTop());
		window.addEventListener('touchmove', onCanvasTouchMove, false);
		window.addEventListener('touchend', onCanvasTouchEnd, false);
	}
}

function onCanvasTouchMove(event) {
	if (event.touches.length == 1) {
		event.preventDefault();
		brush.stroke(event.touches[0].pageX - canvasOffsetLeft + $(window).scrollLeft(), event.touches[0].pageY - canvasOffsetTop + $(window).scrollTop());
  	overlayStaticSpriteFrame();
	}
}

function onCanvasTouchEnd(event) {
	if (event.touches.length == 0) {
		event.preventDefault();
		brush.strokeEnd();
		window.removeEventListener('touchmove', onCanvasTouchMove, false);
		window.removeEventListener('touchend', onCanvasTouchEnd, false);
	}
}
