import WebFont from 'lib/webfont'
import d3 from 'lib/d3'
import {polarToCartesian, cartesianToPolar, offsetsToCartesian, cartesianToOffsets} from './utils'

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
      .charge(0)
      .linkStrength(.5)
      .on('tick', this._tick.bind(this))

    this.percentComplete = 0;
    this.totalTokenFreqs = null;

    this.fontScale = d3.scale.linear() 
      .domain([1, Infinity])
      .range([7, 45]);

    this.toCenterScale = d3.scale.linear()
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
      .style('transform', 'scale('+ percentComplete + ')')
      .style('filter', 'grayscale('+ (1 - percentComplete) + ')')
      .style('-webkit-filter', 'grayscale('+ (1 - percentComplete) + ')');
  }

  setTokens(tokens) {
    var size = this.layout.size()
      , center = size.map((it) => it/2)
      , maxValue, tokensArray, nodes, links, oldNodePositions, nTokensToShow;

    nTokensToShow = Math.ceil(150/(1+Math.pow(Math.E, (-1*size[0]*size[1] + 164000)/65000)))*this.percentComplete;
    tokensArray = tokensToArray(tokens).slice(0, nTokensToShow);
    this.totalTokenFreqs = tokensArray.reduce(((prev, v) => prev + v.value), 0);

    // update the scales that depend on the max value
    maxValue = Math.max.apply(null, tokensArray.map((d) => d.value));
    this.fontScale.domain([1, maxValue]);
    this.toCenterScale.domain([1, maxValue]);

    //set the initial position on each node.
    nodes = tokensArray.map((d) => {
      var angle = 2*Math.PI*((d.value % 360)/360);

      var distanceToEdgeAtAngle = Math.min(
        Math.abs(center[0]/Math.cos(angle)),
        Math.abs(center[1]/Math.sin(angle))
      );

      var offsets = cartesianToOffsets(polarToCartesian([
        distanceToEdgeAtAngle*(1-this.toCenterScale(d.value)), 
        angle
      ]), center);

      d.x = offsets[0];
      d.y = offsets[1];

      return d;
    });

    this.layout
      .nodes(nodes);
  }

  _tick(event) {
    var animationDuration = 500
      , fontStack = "'Open Sans', Helvetica, Arial, sans-serif"
      , size = this.layout.size()
      , alpha = this.layout.alpha()
      , center = size.map((it) => it/2)
      , nodes = this.layout.nodes()
      , fontSizer = this.nodeHelpers.fontSize.bind(null, this.fontScale)
      , visualSize = (d) => this.nodeHelpers.visualSize(d, this.fontScale)
      , buffer = 8;

    nodes.forEach((d, i) => {
      //prevent collisions
      this._collisionHandler(d, alpha);

      //enforce a hard bounding so nothing escapes
      var nodeSize = visualSize(d);
      var thisBufferX = buffer + nodeSize[0]/2;
      var thisBufferY = buffer + nodeSize[1]/2;
      d.x = Math.max(thisBufferX, Math.min(size[0] - thisBufferX, d.x));
      d.y = Math.max(thisBufferY, Math.min(size[1] - thisBufferY, d.y));
    })

    var text = this.containerGElm.selectAll('text')
      .data(nodes, this.nodeHelpers.text);

    // Adjust existing words
    text.transition()
      .duration(animationDuration)
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
      .style('opacity', 1-event.alpha);

    var exitGroup = this.containerSvgElm.append('g')
      .attr('transform', this.containerGElm.attr('transform'));

    var exitGroupNode = exitGroup.node();

    // Remove old words
    text.exit()
      .each(function() { exitGroupNode.appendChild(this); });

    exitGroup.transition()
      .duration(animationDuration)
      .style('opacity', 0)
      .remove();
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
      this._collisionHandler = this.nodeHelpers.collisionHandler(
        this.layout.nodes(),
        5,
        size.map((it) => it/2),
        this.fontScale,
        this.toCenterScale
      );
    }

    this.layout.start();
  }
}

CloudLayout.prototype.nodeHelpers = {
  transform:  function(d)    { return "translate(" + [d.x, d.y] + ")"; },
  text:       function(d)    { return d.text; },
  color:      function(d, i) { return 'hsl('+ Math.floor(i % 360) + ', 80%, 35%)'; },
  fontSize:   function(fontScale, d) { return fontScale(d.value) + 'px'; },
  visualSize: function(d, fontScale, leading = 1.36) { 
    return [d.text.length*fontScale(d.value)*.55, fontScale(d.value)*leading];
  },
  collisionHandler: function(nodes, padding, center, fontScale, toCenterAdjustment) {
    var quadtree = d3.geom.quadtree(nodes);
    var coordinates = (node) => {
      var size = this.visualSize(node, fontScale);
      return {
        left: node.x - size[0]/2 - padding,
        right: node.x + size[0]/2 + padding,
        top: node.y - size[1]*.75 + padding,    //.75 and .25 are an adjustment for 
        bottom: node.y + size[1]*.25 + padding, //descenders, as .x and .y refer to text-bottom.
        width: size[0],
        height: size[1]
      };
    };

    return function(d, alpha) {
      let nodeCoordinates = coordinates(d);

      quadtree.visit(function(quad, x1, y1, x2, y2) {
        if (quad.point && (quad.point !== d)) {
          let quadCoordinates = coordinates(quad.point);
          let topNode  = nodeCoordinates.top <= quadCoordinates.top ? d : quad.point;
          let leftNode = nodeCoordinates.left <= quadCoordinates.left ? d : quad.point;

          // This is the (top node's bottom - the bottom node's top), i.e. how
          // much you would need to move the top node up (or the bottom node down)
          // to end the overlap. A negative value means there's no overlap.
          let overlapY = (topNode === d ? 
            nodeCoordinates.bottom - quadCoordinates.top :
            quadCoordinates.bottom - nodeCoordinates.top
          );

          // The equivalent calculation for x: how much we need to move 
          // the left node left (or the right node right) to end the overlap.
          let overlapX = (leftNode === d ? 
            nodeCoordinates.right - quadCoordinates.left :
            quadCoordinates.right - nodeCoordinates.left
          );

          // Two points overlap only if they overlap in both x and y.
          if(overlapX >= 0 && overlapY >= 0) {
            // To end the collision, we're going to we're going to move 
            // the nodes along the dimension that requires less displacement.
            //
            // It's tempting to try to only move one of the colliding nodes, 
            // e.g. only the one with the lower value, but doing this seems to 
            // bias the node placement so the whole graph ends up moving away
            // from the center.
            let dimension = overlapY < overlapX ? 'y' : 'x';
            let shifts = {
              // below, we include alpha so the simlulation dies down faster.
              // But we use sqrt(alpha) to give preventing collisions more 
              // priority than if we just linearly multiplied by alpha.
              // The 3.1623 multiplier is b/c sqrt(initial alpha)*3.1623 = 1.
              'x': overlapX*(d === leftNode ? -1 : 1)*Math.sqrt(alpha)*3.1623,
              'y': overlapY*(d === topNode ? -1 : 1)*Math.sqrt(alpha)*3.1623
            }

            d[dimension] += shifts[dimension]/2;
            quad.point[dimension] -= shifts[dimension]/2;

            //keep nodeCoordinates in sync.
            let nodeCoordinatesShift = shifts[dimension]/2;
            if(dimension == 'x') {
              nodeCoordinates.left += nodeCoordinatesShift;
              nodeCoordinates.right += nodeCoordinatesShift;
            }
            else {
              nodeCoordinates.top += nodeCoordinatesShift;
              nodeCoordinates.bottom += nodeCoordinatesShift; 
            }
          }
        }
      });
    }; 
  }
};

function tokensToArray(tokens) {
  return Object.keys(tokens)
    .map((k) => ({text: k, value: tokens[k]}))
    .sort((o1, o2) => o2.value - o1.value);
}

export default CloudLayout