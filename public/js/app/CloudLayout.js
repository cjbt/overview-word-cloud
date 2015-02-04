import WebFont from 'lib/webfont'
import d3 from 'lib/d3'
import {polarToCartesian, cartesianToPolar, offsetsToCartesian, cartesianToOffsets, distance} from './utils'

// Kick off the font loading, and get a Promise for its success.
// (Right now we're not using this promise for anything, bc we're
// generating the cloud based on rough estimates of how much space
// each word will take up, rather than typesetting it and measuring
// the actual space. See CloudLayout.prototype.nodeHelpers.visualSize).
var fontsDonePromise = new Promise((resolve, reject) => {
  WebFont.load({
    google: {families: ['Open Sans:400,700']},
    timeout: 5000,
    active: resolve,
    inactive: reject
  });
});

class CloudLayout {
  constructor(friction = .9) {
    this.layout = d3.layout.force()
      .friction(friction)
      .gravity(0)
      .charge(0) //(d) => 30*d.value/this.fontScale.domain()[1]
      .on('tick', this._tick.bind(this))

    this.percentComplete = 0;

    this.fontScale = d3.scale.linear() 
      .domain([1, Infinity])
      .range([10, 54]);

    //so we can interpolate font-size changes.
    this.oldFontScale = d3.scale.linear()
      .domain([1, Infinity])
      .range([10, 54]);

    this.toCenterScale = d3.scale.sqrt()
      .domain([1, Infinity])
      .range([0, 1]);

    this.container = null;
    this.containerSvgElm = null;
    this.containerGElm   = null;
  }

  setContainer(container) {
    if(container != this.container) {
      this.container = container;
      this.containerSvgElm = d3.select(container).append('svg');
      this.containerGElm   = this.containerSvgElm.append('g');
    }
  }

  setSize(size) {
    var currSize = this.layout.size();

    if(size[0] != currSize[0] || size[1] != currSize[1]) {
      this.layout.size(size);
      this.container.style.width = size[0] + 'px';
      this.container.style.height = size[1] + 'px'; 
      this.containerSvgElm.attr('width', size[0]).attr('height', size[1]); 
    }
  }

  setPercentComplete(percentComplete) {
    this.percentComplete = percentComplete;
    this.containerSvgElm
      //.style('transform', 'scale('+ percentComplete + ')')
      //.style('filter', 'grayscale('+ (1 - percentComplete) + ')')
      //.style('-webkit-filter', 'grayscale('+ (1 - percentComplete) + ')');
  }

  setTokens(tokens) {
    var size = this.layout.size()
      , center = size.map((it) => it/2)
      , xAccessor = d => d.x, yAccessor = d => d.y
      , nodes, oldNodePositions;

    var tokensArray = tokensToArray(tokens)
      , tokensArrayLen = tokensArray.length
      , minValue = Infinity, maxValue = 0, nTokensToShow = 0
      , tokenArea = 0, goalArea = .48*size[0]*size[1];

    var getTokenArea = (token) => {
      var tokenSize = this.nodeHelpers.visualSize(token, this.fontScale);
      return tokenSize[0]*tokenSize[1];
    }

    //put the current scale's values into oldFontScale
    this.oldFontScale.domain(this.fontScale.domain());

    //figure out how many tokens to include now, and the new scale.
    //old: Math.ceil(150/(1+Math.pow(Math.E, (-1*/85000 + 2.75)))*this.percentComplete);
    while(tokenArea < goalArea && nTokensToShow < tokensArrayLen) {
      //if we're going to include this token, see how it'd effect the area.
      let potentialToken = tokensArray[nTokensToShow];
      let doScalesUpdate = false;
      if(potentialToken.value > maxValue) {
        maxValue = potentialToken.value;
        doScalesUpdate = true;
      }

      if(potentialToken.value < minValue) {
        minValue = potentialToken.value;
        doScalesUpdate = true;
      }

      if(doScalesUpdate) {
        this.fontScale.domain([minValue, maxValue]);
        this.toCenterScale.domain([minValue, maxValue]);
        tokenArea = 0;
        for(var i = 0; i < nTokensToShow; i++) {
          tokenArea += getTokenArea(tokensArray[i]);
        }
      }
      else {
        nTokensToShow += 1; 
        tokenArea += getTokenArea(potentialToken);
      }
    }
    tokensArray = tokensArray.slice(0, Math.ceil(nTokensToShow*this.percentComplete));


    // Save the [x, y] of the existing nodes into an object, 
    // so we can keep their if they're still in the cloud.
    oldNodePositions = this.layout.nodes().reduce((prev, d) => { 
      prev[d.text] = [d.x, d.y]; 
      return prev; 
    }, {});

    // Build the new nodes.
    nodes = tokensArray.map((node, i) => {
      // Use the word's existing position if possible
      if(oldNodePositions[node.text]) {
        [node.x, node.y] = oldNodePositions[node.text]
      }

      // Otherwise, generate initial position for the node.
      else {
        let angle = 2*Math.PI*((hashString(node.text) % 360)/360);

        let distanceToEdgeAtAngle = 
          distanceFromCenterToNearestEdgeAtAngle(center[0], center[1], angle);

        let r = distanceToEdgeAtAngle*(1-this.toCenterScale(node.value));

        [node.x, node.y] = cartesianToOffsets(polarToCartesian([r, angle]), center);
      }

      node.index = i;

      return node;
    });

    // initialize the layout with these nodes
    this.layout.nodes(nodes);
  }

  render(container, size, tokens, percentComplete) {
    var currSize = this.layout.size()
      , rebuildCollisionHandler = (
          size[0] != currSize[0] || size[1] != currSize[1] ||
          tokens != this.tokens
    );

    this.layout.stop();
    this.setContainer(container);
    this.setSize(size);
    this.setPercentComplete(percentComplete);
    this.setTokens(tokens);

    //must do this after setTokens.
    if(rebuildCollisionHandler) {
      this._collisionFreeCompactor = this.nodeHelpers.collisionFreeCompactor(
        this.layout.nodes(),
        10,
        this.toCenterScale.domain()[1],
        size,
        this
      );
    }

    this.layout.start();
  }

  _tick(event) {
    var size = this.layout.size()
      , nodes = this.layout.nodes()
      , interpolatedScale = (d) => (1-10*event.alpha)*this.fontScale(d) + 10*event.alpha*this.oldFontScale(d)
      , visualSize = (d) => this.nodeHelpers.visualSize(d, interpolatedScale)
      , fontSizer = this.nodeHelpers.fontSize.bind(null, interpolatedScale)
      , buffer = 8;

    nodes.forEach((d, i) => {
      //prevent collisions
      this._collisionFreeCompactor(d, event.alpha, interpolatedScale);

      //enforce a hard bounding so nothing escapes
      var nodeSize = visualSize(d);
      var thisBufferX = buffer + nodeSize[0]/2;
      var thisBufferY = buffer + nodeSize[1];
      d.x = Math.max(thisBufferX, Math.min(size[0] - thisBufferX, d.x));
      d.y = Math.max(thisBufferY, Math.min(size[1] - thisBufferY, d.y));
    });

    this._draw(event.alpha, fontSizer);
  }

  _draw(alpha, fontSizer) {
    var fontStack = "'Open Sans', Helvetica, Arial, sans-serif"
      , nodes = this.layout.nodes();

    var text = this.containerGElm.selectAll('text')
      .data(nodes, this.nodeHelpers.text);

    // Adjust existing words
    text
      .attr('transform', this.nodeHelpers.transform)
      .style('font-size', fontSizer)
      .style('fill', this.nodeHelpers.color);

    // Add new words
    text.enter().append('text')
      .attr('transform', this.nodeHelpers.transform)
      .text(this.nodeHelpers.text)
      .attr('text-anchor', 'middle')
      .style('font-family', fontStack)
      .style('font-size', fontSizer)
      .style('fill', this.nodeHelpers.color)
      .style('opacity', 1);

    var exitGroup = this.containerSvgElm.append('g')
      .attr('transform', this.containerGElm.attr('transform'));

    var exitGroupNode = exitGroup.node();

    // Remove old words
    text.exit()
      .each(function() { exitGroupNode.appendChild(this); });

    exitGroup.transition()
      .duration(500)
      .style('opacity', 0)
      .remove();
  }
}

CloudLayout.prototype.nodeHelpers = {
  transform:  function(d)    { return "translate(" + [d.x, d.y] + ")"; },
  text:       function(d)    { return d.text; },
  color:      function(d, i) { return 'hsl('+ Math.floor(i % 360) + ', 80%, 35%)'; },
  fontSize:   function(fontScale, d) { return fontScale(d.value) + 'px'; },
  visualSize: function(d, fontScale, leading = 1.4) { 
    return [d.text.length*fontScale(d.value)*.55, fontScale(d.value)*leading];
  },
  collisionFreeCompactor: function(nodes, padding, maxImportance, canvasSize, self) {
    var offsets = (node, fontScale) => {
      var size = this.visualSize(node, fontScale);
      return {
        left: node.x - size[0]/2 - padding,
        right: node.x + size[0]/2 + padding,
        top: node.y - size[1]*.75 + padding,    //.75 and .25 are an adjustment for 
        bottom: node.y + size[1]*.25 + padding, //descenders, as .x and .y refer to text-bottom.
      };
    };

    var center = (offsets) => [
      offsets.left + (offsets.right-offsets.left)/2, 
      offsets.top + (offsets.bottom - offsets.top)/2
    ];

    return function(d, alpha, fontScale) {
      var nodeOffsets = offsets(d, fontScale), i, len;

      // This loop starts at d.index, making the function (when it's used in a
      // loop over all nodes) take (n^2)/2 iterations instead of n^2. Using a
      // quadtree would be O(nlog(n)), but it doesn't work well, (without more
      // sophistication, anyway) because the node's position as a point bears
      // so little relation to its real position as a rectangle on screen.
      for(i = 0, len = nodes.length; i < len; i++) {
        let currNode = nodes[i];
        if(currNode !== d) {
          let currOffsets = offsets(currNode, fontScale);
          let topNode  = nodeOffsets.top <= currOffsets.top ? d : currNode;
          let leftNode = nodeOffsets.left <= currOffsets.left ? d : currNode;

          // This is the (top node's bottom - the bottom node's top), i.e. how
          // much you would need to move the top node up (or the bottom node down)
          // to end the overlap. A negative value means there's no overlap.
          let overlapY = (topNode === d ? 
            nodeOffsets.bottom - currOffsets.top :
            currOffsets.bottom - nodeOffsets.top
          );

          // The equivalent calculation for x: how much we need to move 
          // the left node left (or the right node right) to end the overlap.
          let overlapX = (leftNode === d ? 
            nodeOffsets.right - currOffsets.left :
            currOffsets.right - nodeOffsets.left
          );

          // Two points overlap only if they overlap in both x and y.
          if(overlapX >= 0 && overlapY >= 0) {
            // To end the collision, we're going to we're going to move 
            // the nodes along the dimension that requires less displacement.
            // It's tempting to try to only move one of the colliding nodes, 
            // e.g. only the one with the lower value, but doing this seems to 
            // bias the node placement so the whole graph ends up moving away
            // from the center.
            let dimension = overlapY < overlapX ? 'y' : 'x';
            let shifts = {
              'x': overlapX*(d === leftNode ? -1 : 1),
              'y': overlapY*(d === topNode ? -1 : 1)
            }

            let shift = (1.4*alpha)*shifts[dimension]/2;
            
            d[dimension] += shift;
            currNode[dimension] -= shift;

            //keep nodeOffsets in sync.
            if(dimension == 'x') {
              nodeOffsets.left += shift;
              nodeOffsets.right += shift;
            }
            else {
              nodeOffsets.top += shift;
              nodeOffsets.bottom += shift; 
            }
          }

          // If the points don't overlap, pull them together.
          else {
            let nodeCenter = center(nodeOffsets);
            let currCenter = center(currOffsets);
            let nodeWidth  = (nodeOffsets.right - nodeOffsets.left)/2;
            let currWidth  = (currOffsets.right - currOffsets.left)/2;
            let nodeHeight = (nodeOffsets.bottom - nodeOffsets.top)/2;
            let currHeight = (currOffsets.bottom - currOffsets.top)/2;

            // Find the line segment between the two centroids, and capture it
            // as the distance & angle between them relative to nodeCentroid.
            let [r, angle] = cartesianToPolar(
              offsetsToCartesian(currCenter, nodeCenter)
            );

            // Now, of that line segment of length r, we don't want to count 
            // parts that are contained within either word's bounds, as we're
            // moving them together only to the extent that they don't overlap.
            // So, we find the distance from each word's centroid to its nearest
            // edge along angle, and we subtract those distances from r.
            let nodeDistanceToNearestEdge = 
              distanceFromCenterToNearestEdgeAtAngle(nodeWidth, nodeHeight, angle);

            let currDistanceToNearestEdge = 
              distanceFromCenterToNearestEdgeAtAngle(currWidth, currHeight, angle);

            let distanceToMove = 
              r - currDistanceToNearestEdge - nodeDistanceToNearestEdge;

            let strength  = .00038*Math.sqrt(d.value*currNode.value)/maxImportance;
            let distanceX = distanceToMove*Math.cos(angle)*Math.pow(alpha, 1.4)*strength;
            let distanceY = distanceToMove*Math.sin(angle)*Math.pow(alpha, 1.4)*strength;

            d.y -= distanceY;
            d.x += distanceX;

            currNode.x -= distanceX;
            currNode.y += distanceY;

            nodeOffsets.top -= distanceY;
            nodeOffsets.bottom -= distanceY;
            nodeOffsets.left += distanceX;
            nodeOffsets.right += distanceX;
          }
        }
      }
    }; 
  }
};

function distanceFromCenterToNearestEdgeAtAngle(canvasWidth, canvasHeight, angle) {
  return Math.min(
    Math.abs(canvasWidth/Math.cos(angle)),
    Math.abs(canvasHeight/Math.sin(angle))
  ); 
}

function tokensToArray(tokens) {
  return Object.keys(tokens)
    .map((k) => ({text: k, value: tokens[k]}))
    .sort((o1, o2) => o2.value - o1.value);
}

function hashString(string) {
  var hash = 0, i, chr, len;
  if (string.length == 0) return hash;
  for(i = 0, len = string.length; i < len; i++) {
    chr   = string.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

export default CloudLayout