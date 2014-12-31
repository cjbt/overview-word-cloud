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
      .on('tick', this._tick.bind(this))

    this.percentComplete = 0;

    this.fontScale = d3.scale.linear() 
      .domain([1, Infinity])
      .range([10, 54]);

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
      //.style('transform', 'scale('+ percentComplete + ')')
      //.style('filter', 'grayscale('+ (1 - percentComplete) + ')')
      //.style('-webkit-filter', 'grayscale('+ (1 - percentComplete) + ')');
  }

  setTokens(tokens) {
    var size = this.layout.size()
      , center = size.map((it) => it/2)
      , minValue, maxValue, tokensArray, nTokensToShow
      , nodes, links, oldNodePositions;

    nTokensToShow = Math.ceil(150/(1+Math.pow(Math.E, (-1*size[0]*size[1] + 140000)/65000)))*this.percentComplete;
    tokensArray = tokensToArray(tokens).slice(0, nTokensToShow);

    // update the scales that depend on the max value
    let tokenValues = tokensArray.map((d) => d.value);
    maxValue = Math.max.apply(null, tokenValues);
    minValue = Math.min.apply(null, tokenValues);
    this.fontScale.domain([minValue, maxValue]);
    this.toCenterScale.domain([minValue, maxValue]);

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
        let angle = 2*Math.PI*((node.value % 360)/360) + (i/nTokensToShow)*.001;

        let distanceToEdgeAtAngle = 
          distanceFromCenterToNearestEdgeAtAngle(center[0], center[1], angle);

        let r = distanceToEdgeAtAngle*(1-this.toCenterScale(node.value));

        [node.x, node.y] = cartesianToOffsets(polarToCartesian([r, angle]), center);
      }

      node.index = i;

      return node;
    });

    // Generate links--not for d3, but for our custom forces.
    this.links = d3.geom.voronoi().x(d => d.x).y(d => d.y).links(nodes);
    this.links.forEach((link) => {
      //initialize the nodes
      if(!link.source.linkIndices) {
        link.source.linkIndices = [];
        link.source.planarConstraints = [];
      }

      //initialize the nodes
      if(!link.target.linkIndices) {
        link.target.linkIndices = [];
        link.target.planarConstraints = [];
      }

      link.source.linkIndices.push(link.target.index);
      link.target.linkIndices.push(link.source.index);
    }); 

    // Store each node's opposite edge in the initial layout, so that we can
    // add a force to push the nodes back to a planar layout if they start to 
    // deviate. Below, we can't just use d3.geom.voronoi.triangles because it 
    // doesn't return a full triangulation--yet alone the same one as .links--
    // when multiple are possible.
    nodes.forEach(node => {
      // for each pair of nodes this node links to, see if 
      // they link to each other, in which case we have a triangle.
      for(var i = 0, len = (node.linkIndices || []).length; i < len; i++) {
        for(var j = i+1; j < len; j++) {
          let pair = [nodes[node.linkIndices[i]], nodes[node.linkIndices[j]]];
          if(linked(pair[0], pair[1])) {
            node.planarConstraints.push(pair);
          }
        }
      }
    });

    // initialize the layout with these nodes
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
      this._collisionFreeCompactor(d, alpha);

      //enforce a hard bounding so nothing escapes
      var nodeSize = visualSize(d);
      var thisBufferX = buffer + nodeSize[0]/2;
      var thisBufferY = buffer + nodeSize[1];
      d.x = Math.max(thisBufferX, Math.min(size[0] - thisBufferX, d.x));
      d.y = Math.max(thisBufferY, Math.min(size[1] - thisBufferY, d.y));
    })

    var text = this.containerGElm.selectAll('text')
      .data(nodes, this.nodeHelpers.text);

    var links = this.containerGElm.selectAll('line')
      .data(this.links);

    // Adjust existing links
    links
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });

    // Add new links
    links.enter().append('line')
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });

    // Adjust existing words
    text//.transition()
      //.duration(animationDuration)
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

    links.exit()
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
      this._collisionFreeCompactor = this.nodeHelpers.collisionFreeCompactor(
        this.layout.nodes(),
        10,
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
  visualSize: function(d, fontScale, leading = 1.38) { 
    return [d.text.length*fontScale(d.value)*.55, fontScale(d.value)*leading];
  },
  collisionFreeCompactor: function(nodes, padding, fontScale, toCenterAdjustment) {
    var quadtree = d3.geom.quadtree(nodes);
    var offsets = (node) => {
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

    return function(d, alpha) {
      let nodeOffsets = offsets(d);
      quadtree.visit(function(quad, x1, y1, x2, y2) {
        if (quad.point && (quad.point !== d)) {
          let quadOffsets = offsets(quad.point);
          let topNode  = nodeOffsets.top <= quadOffsets.top ? d : quad.point;
          let leftNode = nodeOffsets.left <= quadOffsets.left ? d : quad.point;

          // This is the (top node's bottom - the bottom node's top), i.e. how
          // much you would need to move the top node up (or the bottom node down)
          // to end the overlap. A negative value means there's no overlap.
          let overlapY = (topNode === d ? 
            nodeOffsets.bottom - quadOffsets.top :
            quadOffsets.bottom - nodeOffsets.top
          );

          // The equivalent calculation for x: how much we need to move 
          // the left node left (or the right node right) to end the overlap.
          let overlapX = (leftNode === d ? 
            nodeOffsets.right - quadOffsets.left :
            quadOffsets.right - nodeOffsets.left
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
              'x': overlapX*(d === leftNode ? -1 : 1),//*Math.sqrt(alpha)*3.1623,
              'y': overlapY*(d === topNode ? -1 : 1)//*Math.sqrt(alpha)*3.1623
            }

            d[dimension] += shifts[dimension]/2;
            quad.point[dimension] -= shifts[dimension]/2;

            //keep nodeOffsets in sync.
            let nodeOffsetsShift = shifts[dimension]/2;
            if(dimension == 'x') {
              nodeOffsets.left += nodeOffsetsShift;
              nodeOffsets.right += nodeOffsetsShift;
            }
            else {
              nodeOffsets.top += nodeOffsetsShift;
              nodeOffsets.bottom += nodeOffsetsShift; 
            }
          }

          // If the points don't overlap, pull them together.
          // check for .linkIndices as occasionally we have a disconnected node.
          else if(quad.point.linkIndices && quad.point.linkIndices.indexOf(d.index) !== -1) {
            let nodeCenter = center(nodeOffsets);
            let quadCenter = center(quadOffsets);
            let nodeWidth  = (nodeOffsets.right - nodeOffsets.left)/2;
            let quadWidth  = (quadOffsets.right - quadOffsets.left)/2;
            let nodeHeight = (nodeOffsets.bottom - nodeOffsets.top)/2;
            let quadHeight = (quadOffsets.bottom - quadOffsets.top)/2;

            // Find the line segment between the two centroids, and capture it
            // as the distance & angle between them relative to nodeCentroid.
            let [r, angle] = cartesianToPolar(
              offsetsToCartesian(quadCenter, nodeCenter)
            );

            // Now, of that line segment of length r, we don't want to count 
            // parts that are contained within either word's bounds, as we're
            // moving them together only to the extent that they don't overlap.
            // So, we find the distance from each word's centroid to its nearest
            // edge along angle, and we subtract those distances from r.
            let nodeDistanceToNearestEdge = 
              distanceFromCenterToNearestEdgeAtAngle(nodeWidth, nodeHeight, angle);

            let quadDistanceToNearestEdge = 
              distanceFromCenterToNearestEdgeAtAngle(quadWidth, quadHeight, angle);

            let distanceToMove = 
              r - quadDistanceToNearestEdge - nodeDistanceToNearestEdge;

            let distanceX = distanceToMove*Math.cos(angle)*alpha*.2;
            let distanceY = distanceToMove*Math.sin(angle)*alpha*.2;

            d.y -= distanceY;
            d.x += distanceX;

            quad.x -= distanceX;
            quad.y += distanceY;

            nodeOffsets.top -= distanceY;
            nodeOffsets.bottom -= distanceY;
            nodeOffsets.left += distanceX;
            nodeOffsets.right += distanceX;
          }
        }
      });
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

export default CloudLayout