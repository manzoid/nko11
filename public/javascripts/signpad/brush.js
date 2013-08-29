/**
 * Note: Relies on globals from drawpad.js
 */
function Brush() {
}

Brush.prototype.context = null;
Brush.prototype.prevMouseX = null;
Brush.prototype.prevMouseY = null;

Brush.prototype.init = function(context) {
	this.context = context;
};

Brush.prototype.destroy = function() {
};

Brush.prototype.strokeStart = function(mouseX, mouseY) {
	this.prevMouseX = mouseX;
	this.prevMouseY = mouseY;
};

Brush.prototype.stroke = function(mouseX, mouseY) {
	this.context.lineWidth = BRUSH_SIZE;	
	this.context.strokeStyle = "rgba(" + COLOR[0] + ", " + COLOR[1] + ", " + COLOR[2] + ", " + 0.5 * BRUSH_PRESSURE + ")";
	
	this.context.beginPath();
	this.context.moveTo(this.prevMouseX, this.prevMouseY);
	this.context.lineTo(mouseX, mouseY);
	this.context.stroke();

	this.prevMouseX = mouseX;
	this.prevMouseY = mouseY;
};

Brush.prototype.strokeEnd = function() {
};
