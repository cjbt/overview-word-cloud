import WebFont from 'lib/webfont'
import d3 from 'lib/d3'
import {polarToCartesian, cartesianToPolar, offsetsToCartesian, cartesianToOffsets} from './utils'

// Kick off the font loading, and get a Promise for its success.
// (Right now we're not using this promise for anything.)
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
                    .on('tick', this._tick.bind(this));

    this.layout.charge(((d, i) => {
      var size = this.layout.size();
      return (-.15*(120/this.tokensToShow)*size[0]*size[1]*d.value)/this.totalTokenFreqs;
    }));

    this.totalTokenFreqs = null;
    this.tokensToShow = null;

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
      this.fontScale.range([7, 40]);
      this.container.style.width = size[0] + 'px';
      this.container.style.height = size[1] + 'px'; 
      this.containerSvgElm.attr('width', size[0]).attr('height', size[1]); 
    }
  }

  setPercentComplete(percentComplete) {
    this.containerSvgElm
      .style('transform', 'scale('+ percentComplete + ')')
      .style('filter', 'grayscale('+ (1 - percentComplete) + ')')
      .style('-webkit-filter', 'grayscale('+ (1 - percentComplete) + ')');
  }

  setTokens(tokens) {
    var size = this.layout.size()
      , center = size.map((it) => it/2)
      , maxValue, nodes, tokensArray;

    this.tokensToShow = Math.ceil(120/(1+Math.pow(Math.E, (-1*size[0]*size[1] + 125000)/200000)));

    tokensArray = tokensToArray(tokens).slice(0, this.tokensToShow);
    this.totalTokenFreqs = tokensArray.reduce(((prev, v) => prev + v.value), 0);

    //update the scales that depend on the max value
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
      , center = size.map((it) => it/2)
      , nodes = this.layout.nodes()
      , fontSizer = this.nodeHelpers.fontSize.bind(null, this.fontScale)
      , buffer = 8
      , gravity = (distance, strength) => {
          return Math.pow(Math.abs(distance), strength)*(distance < 0 ? -1 : 1)
        };

    nodes.forEach((d, i) => {
      var nodeSize = this.nodeHelpers.visualSize(d, this.fontScale);
      var amount = this.toCenterScale(d.value);
      var dxFromCenter = center[0] - d.x;
      var dyFromCenter = center[1] - d.y;
      var thisBufferX = buffer + nodeSize[0]/2 + size[0]*.1*amount; // divide by 2 bc d.x and d.y
      var thisBufferY = buffer + nodeSize[1]/2 + size[0]*.1*amount; // refer to the point's center

      // Move nodes toward center in proportion to their distance from it.
      // This is basically a reimplementation of the gravity force, but it
      // seems to work better with more unevenly distributed charges.
      d.x += gravity(dxFromCenter, .93)*event.alpha*(.7*center[1]/center[0] + .3);
      d.y += gravity(dyFromCenter, .93)*event.alpha*(.7*center[0]/center[1] + .3);

      //enforce a hard bounding so nothing escapes
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
      .text(this.nodeHelpers.text)
      .attr('text-anchor', 'middle')
      .attr('transform', this.nodeHelpers.transform)
      .style('font-family', fontStack)
      .style('font-size', fontSizer)
      .style('fill', this.nodeHelpers.color)
      .style('opacity', 1-event.alpha)

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

    this.layout.stop();
    this.setContainer(container);
    this.setSize(size);
    this.setPercentComplete(percentComplete);
    this.setTokens(tokens);

    this.layout.start();
  }
}

CloudLayout.prototype.nodeHelpers = {
  transform:  function(d)    { return "translate(" + [d.x, d.y] + ")"; },
  text:       function(d)    { return d.text; },
  color:      function(d, i) { return 'hsl('+ Math.floor(i % 360) + ', 80%, 35%)'; },
  fontSize:   function(fontScale, d) { return fontScale(d.value) + 'px'; },
  visualSize: function(d, fontScale, leading = 1.2) { 
    return [d.text.length*fontScale(d.value), fontScale(d.value)*leading];
  }
};

function tokensToArray(tokens) {
  return Object.keys(tokens)
    .map((k) => ({text: k, value: tokens[k]}))
    .sort((o1, o2) => o2.value - o1.value);
}

export default CloudLayout


/* 
       rebuildCollisionChecker = (
        size[0] != currSize[0] || size[1] != currSize[1] ||
        tokens != this.tokens
      );    if(rebuildCollisionChecker) {
      this._renderCollisionHandler = this.nodeHelpers.preventCollision(
        .025, 
        this.layout.nodes(),
        0,
        size.map((it) => it/2),
        this.nodeHelpers.visualSize,
        this.fontScale,
        this.toCenterScale
      );
    }
preventCollision: function(alpha, nodes, padding, center, visualSize, fontScale, toCenterAdjustment) {
  var quadtree = d3.geom.quadtree(nodes);
  return function(d) {
    var nodeSize = visualSize(d, fontScale) 
      , nx1 = d.x - (nodeSize[0] + padding)
      , nx2 = d.x + (nodeSize[0] + padding)
      , ny2 = d.y + (nodeSize[1] + padding)
      , ny1 = d.y - (nodeSize[1] + padding);

    quadtree.visit(function(quad, x1, y1, x2, y2) {
      if (quad.point && (quad.point !== d)) {
        var x = d.x - quad.point.x,
            y = d.y - quad.point.y,
            l = Math.sqrt(x * x + y * y),
            r = nodeSize[0]/2 + visualSize(quad.point, fontScale)[0]/2 + padding,
            moreImportantPoint, moreImportantPolar, moreImportantPointNew,
            lessImportantPoint, lessImportantPolar, lessImportantPointNew,
            moreImportantToCenterAmount;

        if (l < r) {
          l = (l - r) / l * alpha;
          x *= l;
          y *= l;

          moreImportantPoint = d.value > quad.point.value ? d : quad.point;
          moreImportantPolar = cartesianToPolar(offsetsToCartesian(moreImportantPoint, center));
          moreImportantToCenterAmount = toCenterAdjustment(moreImportantPoint.value);

          lessImportantPoint = d.value > quad.point.value ? quad.point : d;
          lessImportantPolar = cartesianToPolar(offsetsToCartesian(lessImportantPoint, center));

          //bring the important point toward the center and move the other away.
          moreImportantPolar[0] -= 4//Math.sqrt((x*x) + (y*y))*moreImportantToCenterAmount
          moreImportantPointNew = cartesianToOffsets(polarToCartesian(moreImportantPolar), center);
          [moreImportantPoint.x, moreImportantPoint.y] = moreImportantPointNew;

          lessImportantPolar[0] += //Math.sqrt((x*x) + (y*y))//*(1 - moreImportantToCenterAmount)
          lessImportantPointNew = cartesianToOffsets(polarToCartesian(lessImportantPolar), center);
          [lessImportantPoint.x, lessImportantPoint.y] = lessImportantPointNew;
          /*
          d.x -= x;
          d.y -= y;
          quad.point.x += x;
          quad.point.y += y; *\/
        }
      }
      return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
    });
  }; 
}*/