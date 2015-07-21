import {Observable} from './utils';

class OverviewWordCloud {
  constructor() {
    this.progress = 0;
    this.tokens = [];
    this.excluded = {};
    this.excludedKeysOrdered = []
  }

  start(DataStreamer) {
    DataStreamer()
      .node("![*]", (data) => {
        this.tokens = data.tokens;
        this.updateProgress(data.progress);
        return oboe.drop;
      })
      .done(() => this._dispatch("done", []));
  }

  getTokens() {
    return this.tokens.filter((token) => !this.excluded.hasOwnProperty(token.name))
  }

  updateProgress(newProgress) {
    var oldProgress = this.progress;
    if(newProgress > oldProgress) {
      this.progress = newProgress;
      this._dispatch("progress", [newProgress]);
    }
  }

  setExcludedWords(exclude) {
    this.excluded = {};
    this.excludedKeysOrdered = exclude.slice(0);
    exclude.forEach((word) => this.excluded[word] = null);

    this._dispatch("inclusionchange", [this.excludedKeysOrdered]);
  }

  includeWord(word) {
    if (this.excluded.hasOwnProperty(word)) {
      delete this.excluded[word];
      this.excludedKeysOrdered.splice(this.excludedKeysOrdered.indexOf(word), 1);
      this._dispatch("inclusionchange", [this.excludedKeysOrdered]);
    }
  }

  excludeWord(word) {
    if (!this.excluded.hasOwnProperty(word)) {
      this.excluded[word] = null;
      this.excludedKeysOrdered.push(word);
      this._dispatch("inclusionchange", [this.excludedKeysOrdered]);
    }
  }
}

export default Observable(OverviewWordCloud);
