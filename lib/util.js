/**
 * @param {array} vector A simple array of numbers.
 */
function l2Norm(vector) {
  return Math.sqrt(vector.reduce(function(prev, d) { 
    return d*d + prev; 
  }, 0));
}

/**
 * @param {object} obj1 An object of form {'term': frequency}
 * @param {object} obj2 An object of form {'term': frequency}
 */
function euclideanDistance(obj1, obj2) {
  var distances = [], k;
  //if k in obj1 and obj2, distance = 1[k] - 2[k]
  //if k in 1 only or 2 only, distance = 1[k] or 2[k].
  for(k in obj1) {
    distances.push(obj1[k] - (obj2[k] || 0))
  }

  for(k in obj2) {
    if(typeof obj1[k] == 'undefined') {
      distances.push(obj2[k]);
    }
  }

  return l2Norm(distances);
};

/**
 * @param {object} obj1 An object of form {'term': frequency}
 * @param {object} obj2 An object of form {'term': frequency}
 */
function cosineSimilarity(obj1, obj2) {
  var k, obj1Arr = [], obj2Arr = [], dotProduct = 0;

  for(k in obj1) {
    //dotproduct terms must be in both obj1 and obj2.
    if(typeof obj2[k] !== 'undefined') {
      dotProduct += (obj1[k] * obj2[k]);
    }
    obj1Arr.push(obj1[k]);
  }

  for(k in obj2) {
    obj2Arr.push(obj2[k]);
  }

  return dotProduct/(l2Norm(obj1Arr)*l2Norm(obj2Arr));
};

module.exports = {
  euclideanDistance: euclideanDistance,
  l2Norm: l2Norm,
  cosineSimilarity: cosineSimilarity
};