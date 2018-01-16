const SVGNS = 'http://www.w3.org/2000/svg'

export default class TextMeasurer {
  constructor() {
    this.measures = {} // cache of text => { width, height }
  }

  svg() {
    if (this.svgElement) return this.svgElement

    this.svgContainer = document.createElement('div')
    this.svgContainer.classList.add('text-measurer')
    this.svgContainer.style.position = 'absolute'
    this.svgContainer.style.overflow = 'hidden'
    this.svgContainer.style.width = '0'
    this.svgContainer.style.height = '0'
    this.svgElement = document.createElementNS(SVGNS, 'svg')
    this.svgElement.classList.add('text-measurer')
    this.svgContainer.appendChild(this.svgElement)

    document.body.appendChild(this.svgContainer)

    return this.svgElement
  }

  /**
   * Given an Array of Strings, return an Array of their { width, height } when
   * rendered on an SVG with the page's CSS and no SVG attributes.
   */
  measureTexts(texts) {
    const svg = this.svg()
    const measures = this.measures

    const textsAndEls = texts
      // 1. Find un-measured texts
      .filter(text => !measures.hasOwnProperty(text))
      // 2. Build a <text> for each one
      //    (we don't measure anything yet, so the browser needn't paint)
      .map(text => {
        const el = document.createElementNS(SVGNS, 'text')
        el.appendChild(document.createTextNode(text))
        svg.appendChild(el)
        return {
          el: el,
          text: text,
        }
      })

    // 3. Measure all <text>s. (This will involve a single paint.)
    textsAndEls.forEach(obj => {
      const rect = obj.el.getBoundingClientRect()
      measures[obj.text] = {
        width: rect.width,
        height: rect.height,
      }
    })

    // 4. Delete all <text>s
    textsAndEls.forEach(obj => svg.removeChild(obj.el))

    // 5. Use cache -- which now includes all texts -- to calculate retval
    return texts.map(text => this.measures[text])
  }
}
