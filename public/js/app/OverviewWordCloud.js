import {Observable} from './utils';

class OverviewWordCloud {
  constructor(DataStreamer) {
    this.progress = 0;
    this.words = {};
    this.excluded = {};

    DataStreamer()
      .node("![*]", (data) => {
        this.words = data.tokens;
        this._dispatch("data", [this.words, this.progress]);
        this.updateProgress(data.progress);
        return oboe.drop;
      })
      .done(() => this._dispatch("done", [this.words, this.progress]));
  }

  updateProgress(newProgress) {
    var oldProgress = this.progress;
    if(newProgress > oldProgress) {
      this.progress = newProgress;
      this._dispatch("progress", [newProgress, oldProgress, this.words]);
    }
  }

  setExcludedWords(exclude) {
    for(var key in this.excluded) {
      this.words[key] = this.excluded[key];
    }

    this.excluded = {};

    exclude.forEach((it) => {
      if(this.words.hasOwnProperty(it)) {
        this.excluded[it] = this.words[it];
        delete this.words[it];
      }
    });

    this._dispatch("inclusionchange", [this.words, this.excluded]);
  }
}

export default Observable(OverviewWordCloud);