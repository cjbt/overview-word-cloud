function registerObserver(event, fn) {
  (this.listeners[event] || (this.listeners[event] = [])).push(fn);
}

function dispatch(event, argsArr) {
  if(this.listeners[event] instanceof Array) {
    this.listeners[event].forEach((listener) => listener.apply(this, argsArr));
  }
};

//Takes in a constructor function and returns a new one that will
//give constructed objects an observer pattern implementation.
export function Observable(constructorFn) {
  if(!constructorFn.prototype.observe) {
    constructorFn.prototype.observe = registerObserver;
  }

  //Add a function to the object for dispatching events.
  if(!constructorFn.prototype._dispatch) {
    constructorFn.prototype._dispatch = dispatch;
  }

  return function() {
    var obj = Object.create(constructorFn.prototype);
    obj.listeners = {};
    constructorFn.apply(obj, arguments);
    return obj;
  }
}

//read points that come in as {x, y} or [x, y] or {r, theta} or [r, theta]
//and always convert them to a 2d array.
function readPoint(point) {
  if(point instanceof Array) { return point; }
  return point.x !== undefined ? [point.x, point.y] : [point.r, point.theta];
}

export function polarToCartesian(point) {
  var [r, theta] = readPoint(point);

  return [r*Math.cos(theta), r*Math.sin(theta)];
}

export function cartesianToPolar(point) {
  var [x, y] = readPoint(point);

  //below, atan2 handles x = 0 smoothly.
  return [Math.sqrt(x*x + y*y), Math.atan2(y, x)];
}

//Convert the browser's grid (top, left) offsets
//To a cartesian point in a plane with newOrigin.
export function offsetsToCartesian(point, newOrigin) {
  var [pointX, pointY] = readPoint(point);
  var [newOriginX, newOriginY] = readPoint(newOrigin);

  return [pointX - newOriginX, newOriginY - pointY];
}

export function cartesianToOffsets(point, origin) {
  var [x, y] = readPoint(point);
  var [originX, originY] = readPoint(origin);

  return [x + originX, originY - y]
}