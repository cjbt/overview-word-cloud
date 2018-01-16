import * as d3 from 'd3'
import d3BBoxCollide from './bbox-collide'
import {polarToCartesian, cartesianToPolar, offsetsToCartesian, cartesianToOffsets, distance} from './utils'
import TextMeasurer from './TextMeasurer'

// Kick off the font loading. (Right now we're not using this for anything, bc
// we're generating the cloud based on rough estimates of how much space
// each word will take up, rather than typesetting it and measuring
// the actual space. See CloudLayout.prototype.nodeHelpers.visualSize).
require('webfontloader').load({
  google: {families: ['Open Sans:400,700']},
  timeout: 5000,
})

class CloudLayout {
  constructor(velocityDecay = .92, alphaDecay = 0.9) {
    this.textMeasurer = new TextMeasurer()
    this.percentComplete = 0

    this.container = null;
    this.containerSvgElm = null;
    this.containerGElm   = null;

    let nOutputs = 0

    const bboxCollide = d3BBoxCollide(node => {
      const w_2 = node.svgWidth * node.scale * 0.5 + 3
      const h_2 = node.svgHeight * node.scale * 0.5 + 3
      return [
        [ -w_2, -h_2 ],
        [ w_2, h_2 ],
      ]
    })
      .strength(0.2)
      .iterations(3)

    const boundsForce = (alpha) => {
      if (!this.container) return

      const w = this.container.clientWidth
      const h = this.container.clientHeight

      // adjusts vx and vy so each node should end within bounds

      const nodes = this.layout.nodes()
      for (const node of nodes) {
        const w_2 = node.svgWidth * node.scale * 0.5 + 3
        const h_2 = node.svgHeight * node.scale * 0.5 + 3
        // bounds
        const x0 = w_2
        const y0 = h_2
        const x1 = w - w_2
        const y1 = h - h_2
        const x = node.x
        const y = node.y
        const vx = node.vx
        const vy = node.vy
        if (x + vx < x0) {
          // divide by velocityDecay because d3 is about to multiply by it
          node.vx = (x0 - x) / velocityDecay
        }
        if (x + vx > x1) {
          node.vx = (x1 - x) / velocityDecay
        }
        if (y + vy < y0) {
          node.vy = (y0 - y) / velocityDecay
        }
        if (y + vy > y1) {
          node.vy = (y1 - y) / velocityDecay
        }
      }
    }

    this.centerX = d3.forceX().strength(0.2)
    this.centerY = d3.forceY().strength(0.1)

    this.layout = d3.forceSimulation()
      .force('bounds', boundsForce)
      .force('centerX', this.centerX)
      .force('centerY', this.centerY)
      .force('collide', bboxCollide)
      .velocityDecay(velocityDecay)
      .on('tick', () => this._tick())
  }

  setContainer(container) {
    if (container != this.container) {
      this.container = container;
      this.containerSvgElm = d3.select(container).append('svg');
      this.containerGElm = this.containerSvgElm.append('g');
    }
  }

  setPercentComplete(percentComplete) {
    this.percentComplete = percentComplete;
  }

  setTokens(tokens) {
    if (!this.container) return

    const w = this.container.clientWidth
    const h = this.container.clientHeight
    const center = [ w * 0.5, h * 0.5 ]

    const frequencies = tokens.map(t => t.frequency)
    const minFrequency = Math.min(...frequencies)
    const maxFrequency = Math.max(...frequencies)

    const textScale = d3.scalePow()
      .exponent(0.6)
      .domain([ minFrequency, maxFrequency ])
      .range([ 0.1, 1 ])

    const toCenterScale = d3.scaleLinear()
      .domain([ minFrequency, maxFrequency ])
      .range([ 1, 0.00001 ])

    // text => node
    const textToExistingNode = this.layout.nodes()
      .reduce((acc, node) => { acc[node.text] = node; return acc }, {})

    const measures = this.textMeasurer.measureTexts(tokens.map(t => t.name))

    const nodes = tokens
      .map((token, i) => {
        let ret

        if (textToExistingNode.hasOwnProperty(token.name)) {
          ret = textToExistingNode[token.name]
        } else {
          ret = { text: token.name }

          // This token hasn't been placed, ever. Give it an initial position.
          const angle = 2 * Math.PI / 360 * (hashString(token.name) % 360)
          const distanceToEdgeAtAngle = distanceFromCenterToNearestEdgeAtAngle(center[0], center[1], angle)
          const r = distanceToEdgeAtAngle * toCenterScale(token.frequency)
          const xy = cartesianToOffsets(polarToCartesian([ r, angle ]), center)
          ret.x = xy[0]
          ret.y = xy[1]

          // Also, measure its size. We _scale_ the <text> after placing it, but
          // _font size_ is constant.
          ret.svgWidth = measures[i].width
          ret.svgHeight = measures[i].height
        }

        ret.value = token.frequency           // it changes
        ret.scale = textScale(ret.value) // store it: we refer to it often

        return ret
      })

    this._setLayoutNodes(nodes)
  }

  _setLayoutNodes(nodes) {
    if (!this.container) return

    const w = this.w = this.container.clientWidth
    const h = this.h = this.container.clientHeight

    this.centerX.x(w * 0.5)
    this.centerY.y(h * 0.5)

    const text = this.containerGElm.selectAll('text')
      .data(nodes, d => d.text)

    // Adjust existing words
    text
      .attr('fill', this.nodeHelpers.color)
      .attr('transform', this.nodeHelpers.transform)

    // Add new words
    text.enter().append('text')
      .text(d => d.text)
      .attr('transform', this.nodeHelpers.transform)
      .attr('fill', this.nodeHelpers.color)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'central')
      .style('opacity', 1)

    // Remove old words
    const exitNodes = []
    text.exit()
      .each(function() { exitNodes.push(this) })
    if (exitNodes.length > 0) {
      const exitG = this.containerSvgElm.append('g')
      const exitGNode = exitG.node()
      exitNodes.forEach(node => exitGNode.appendChild(node))
      console.log(exitGNode.innerHTML)
      exitG.transition()
        .duration(200)
        .style('opacity', 0)
        .remove()
    }

    console.log(nodes.length, this.containerGElm.node())
    console.log(nodes.length, this.containerGElm.node().childNodes.length)

    this.layout.nodes(nodes) // now wait for calls to _tick()
  }

  render(container, tokens, percentComplete) {
    this.setContainer(container)
    this.setPercentComplete(percentComplete)
    this.setTokens(tokens)

    this.layout.alpha(1).restart()
  }

  _tick() {
    if (!this.container) return

    const text = this.containerGElm.selectAll('text')

    text.attr('transform', this.nodeHelpers.transform)
  }
}

CloudLayout.prototype.nodeHelpers = {
  transform: function(d) {
    return `translate(${d.x || 0}, ${d.y || 0}) scale(${d.scale || 0})`
  },
  color: function(d, i) { return 'hsl('+ Math.floor(i % 360) + ', 80%, 35%)'; },
}

function distanceFromCenterToNearestEdgeAtAngle(canvasWidth, canvasHeight, angle) {
  return Math.min(
    Math.abs(canvasWidth/Math.cos(angle)),
    Math.abs(canvasHeight/Math.sin(angle))
  );
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
