var WordCloud = function() {
  this.uniqueTokenCount = 0;
  this.frequencies = {};
}

WordCloud.prototype.stopWords = {
  "a": true, "about": true, "above": true, "after": true, "again": true, 
  "against": true, "all": true, "am": true, "an": true, "and": true, 
  "any": true, "are": true, "aren't": true, "as": true, "at": true, "be": true,
  "because": true, "been": true, "before": true, "being": true, "below": true, 
  "between": true, "both": true, "but": true, "by": true, "can't": true, 
  "cannot": true, "could": true, "couldn't": true, "did": true, "didn't": true,
  "do": true, "does": true, "doesn't": true, "doing": true, "don't": true, 
  "down": true, "during": true, "each": true, "few": true, "for": true, 
  "from": true, "further": true, "had": true, "hadn't": true, "has": true, 
  "hasn't": true, "have": true, "haven't": true, "having": true, "he": true, 
  "he'd": true, "he'll": true, "he's": true, "her": true, "here": true, 
  "here's": true, "hers": true, "herself": true, "him": true, "himself": true,
  "his": true, "how": true, "how's": true, "i": true, "i'd": true, "i'll": true,
  "i'm": true, "i've": true, "if": true, "in": true, "into": true, "is": true,
  "isn't": true, "it": true, "it's": true, "its": true, "itself": true, 
  "let's": true, "me": true, "more": true, "most": true, "mustn't": true, 
  "my": true, "myself": true, "no": true, "nor": true, "not": true, "of": true,
  "off": true, "on": true, "once": true, "only": true, "or": true, 
  "other": true, "ought": true, "our": true, "ours  ourselves": true, 
  "out": true, "over": true, "own": true, "same": true, "shan't": true, 
  "she": true, "she'd": true, "she'll": true, "she's": true, "should": true,
  "shouldn't": true, "so": true, "some": true, "such": true, "than": true, 
  "that": true, "that's": true, "the": true, "their": true, "theirs": true, 
  "them": true, "themselves": true, "then": true, "there": true, 
  "there's": true, "these": true, "they": true, "they'd": true, "they'll": true,
  "they're": true, "they've": true, "this": true, "those": true, 
  "through": true, "to": true, "too": true, "under": true, "until": true, 
  "up": true, "very": true, "was": true, "wasn't": true, "we": true, 
  "we'd": true, "we'll": true, "we're": true, "we've": true, "were": true, 
  "weren't": true, "what": true, "what's": true, "when": true, "when's": true, 
  "where": true, "where's": true, "which": true, "while": true, "who": true, 
  "who's": true, "whom": true, "why": true, "why's": true, "with": true, 
  "won't": true, "would": true, "wouldn't": true, "you": true, "you'd": true, 
  "you'll": true, "you're": true, "you've": true, "your": true, "yours": true, 
  "yourself": true, "yourselves": true
};

WordCloud.prototype.tokenize = function(text) {
  var punctuatedTokens, i, len, token, finalTokens = [];

  function stripEdgePunctuation(punctuatedToken) {
    //strip inter-word punctuation (punctuation on the edge of each token)
    return punctuatedToken.replace(
      /(^[\.!\-#%*\,\-\/:;\?@\[-\]_\{\}]+)|([\.!\-#%*\,\-\/:;\?@\[-\]_\{\}]+$)/g,
      ""
    );
  };

  //lower case text, normalize space-like characters, and split at spaces.
  punctuatedTokens = text.toLowerCase().replace(/(?:--)|\s+/g, ' ').split(' ');

  //remove punctuation from tokens, and filter out invalid ones.
  for(i = 0, len = punctuatedTokens.length; i < len; i++) {
    token = stripEdgePunctuation(punctuatedTokens[i]);

    if(token.length > 3 && !this.stopWords[token]) {
      finalTokens.push(token);
    }
  }

  return finalTokens;
};

WordCloud.prototype.processDocument = function(doc) {
  var frequencies = this.frequencies
    , tokens = this.tokenize(doc)
    , seenTokensInDoc = {}
    , self = this;

  tokens.forEach(function(token) {
    if(frequencies.hasOwnProperty(token)) {
      frequencies[token][0]++;
      if(!seenTokensInDoc.hasOwnProperty(token)) {
        frequencies[token][1]++;
        seenTokensInDoc[token] = true;
      }
    }
    else {
      frequencies[token] = [1,1];
      seenTokensInDoc[token] = true;
      self.uniqueTokenCount++;
    }
  });

  return true;
};

WordCloud.prototype.getTopTokens = function(tokenLimit, Heap) {
  var frequencies = this.frequencies
    , topHeap = new Heap(function(a, b) {
        return a[1] - b[1];
      })
    , key, sampled = 0;

  //Find and keep only the top tokenLimit terms.
  for(key in frequencies) {
    if(sampled < tokenLimit) {
      topHeap.push([key, frequencies[key][0], frequencies[key][1]]);
      sampled++;
    }
    else {
      topHeap.pushpop([key, frequencies[key][0], frequencies[key][1]]);
    }
  }

  return topHeap.toArray();
};


module.exports = WordCloud;