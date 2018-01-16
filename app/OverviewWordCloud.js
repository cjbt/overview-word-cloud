export default class OverviewWordCloud {
  constructor() {
    this.progress = 0
    this.tokens = []
    this.excluded = {}
    this.excludedKeysOrdered = []
    this.listeners = {}
  }

  observe(ev, fn) {
    (this.listeners[ev] || (this.listeners[ev] = [])).push(fn)
  }

  _dispatch(ev, ...args) {
    if (this.listeners[ev] instanceof Array) {
      try {
        this.listeners[ev].forEach(listener => listener.apply(this, args))
      } catch (e) {
        console.error(e)
      }
    }
  }

  start(DataStreamer) {
    DataStreamer()
      .node("![*]", (data) => {
        this.tokens = data.tokens;
        this.updateProgress(data.progress);
        return oboe.drop;
      })
      .done(() => this._dispatch("done"));
  }

  getTokens() {
    return this.tokens
      .filter(token => !this.excluded.hasOwnProperty(token.name))
  }

  updateProgress(newProgress) {
    if (newProgress > this.progress) {
      this.progress = newProgress;
      this._dispatch("progress", newProgress);
    }
  }

  setExcludedWords(exclude) {
    this.excluded = {}
    this.excludedKeysOrdered = exclude.slice()
    exclude.forEach(word => this.excluded[word] = null)
    console.log(this.excluded, this.excludedKeysOrdered)

    this._dispatch("inclusionchange", this.excludedKeysOrdered)
  }

  includeWord(word) {
    if (this.excluded.hasOwnProperty(word)) {
      delete this.excluded[word]
      this.excludedKeysOrdered.splice(this.excludedKeysOrdered.indexOf(word), 1)
      this._dispatch("inclusionchange", this.excludedKeysOrdered)
    }
  }

  excludeWord(word) {
    if (!this.excluded.hasOwnProperty(word)) {
      this.excluded[word] = null
      this.excludedKeysOrdered.push(word)
      this._dispatch("inclusionchange", this.excludedKeysOrdered)
    }
  }
}
