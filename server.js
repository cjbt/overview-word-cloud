#!/usr/bin/env node

'use strict';
var express            = require('express')
  , morgan             = require('morgan')
  , bodyParser         = require('body-parser')
  , oboe               = require('oboe')
  , API                = require('overview-api-node')
  , tokenize           = require('overview-js-tokenizer').tokenize
  , TokenBin           = require('overview-js-token-bin')
  , SendInterval       = 500 // ms between sends
  , MaxNTokens         = 150 // tokens sent to client
  , app                = express();

app.use(morgan('combined'));
app.use(bodyParser.json());

var nextRequestId = 1;
var Stopwords = {
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
  "who's": true, "whom": true, "why": true, "why's": true, "with": true, "will": true,
  "won't": true, "would": true, "wouldn't": true, "you": true, "you'd": true, 
  "you'll": true, "you're": true, "you've": true, "your": true, "yours": true, 
  "yourself": true, "yourselves": true
};
/*
 * Storage version format: 2
 *
 * 1: { progress: 1, tokens: [ [ 'foo', 2 ], ... ] }
 * 2: { version: 2, tokens: [ { name: 'foo', nDocuments: 2, frequency: 5 } ] },
 *    with overview-js-tokenizer 0.0.2.
 */
var StorageFormatVersion = 2;

app.get('/generate', function(req, res, next) {
  var api = new API(req.query.server, req.query.apiToken, oboe)
    , requestId = nextRequestId++, requestStartDate = new Date()
    , storeStream = api.store().getState(), docStream
    , tokenStream, tokenBin = new TokenBin([])
    , sendTimeoutId;

  res.header('Content-Type', 'application/json');

  //Check the store. If we don't have a saved result, generate + save one.
  storeStream.done(function(json) {
    if (typeof(json) === 'object' && json.version == StorageFormatVersion) {
      res.json([ { progress: 1, tokens: json.tokens } ]);
      console.log(
        '[req %d] sent the JSON for docset %d from the store - %d ms elapsed',
        requestId,
        req.query.documentSetId,
        new Date() - requestStartDate
      );
    }

    else {
      var nDocumentsTotal
        , firstSend = true;

      docStream = api.docSet(req.query.documentSetId).getDocuments(undefined, "random");
      docStream
        .node('pagination.total', function(total) {
          nDocumentsTotal = total;

          sendTimeoutId = setTimeout(sendSnapshotAndQueue, SendInterval);
        })
        .node('items.*', function(doc) {
          tokenStream = tokenize(doc.text)
            .map(function(t) { return t.toLowerCase(); })
            .filter(function(t) { return !(t in Stopwords); });
          tokenBin.addTokens(tokenStream);

          return oboe.drop; //remove the doc from memory
        })
        .done(function () {
          var lastJson = getSnapshotJson();
          clearTimeout(sendTimeoutId);
          sendSnapshot(true, lastJson);
          api.store().setState({
            version: StorageFormatVersion,
            tokens: lastJson.tokens
          });
        });
    }

    function getSnapshotJson() {
      var tokens = tokenBin.getTokensByFrequency().slice(0, MaxNTokens)
        , progress = nDocumentsTotal ? (tokenBin.nDocuments / nDocumentsTotal) : 0;

      return {
        "progress": progress,
        "tokens": tokens
      };
    }

    function sendSnapshot(lastSend, json) {
      res.write((firstSend ? "[" : ",") + JSON.stringify(json));
      firstSend = false;

      if (lastSend) {
        res.end("]");
      }

      console.log(
        '[req %d] pushed %s JSON for docset %d - %d ms elapsed',
        requestId,
        lastSend ? 'last' : 'some',
        req.query.documentSetId,
        new Date() - requestStartDate
      );
    }

    function sendSnapshotAndQueue() {
      sendSnapshot(false, getSnapshotJson());
      sendTimeoutId = setTimeout(sendSnapshotAndQueue, SendInterval);
    }
  });

  function abort() {
    console.log('[req %d] abort', requestId);
    storeStream.abort();
    if(docStream && docStream.abort) {
      docStream.abort(); // docStream will fire no more callbacks
    }
    if (sendTimeoutId) { clearTimeout(sendTimeoutId); }
    res.end();
  }

  req.on('close', abort);
});

app.get('/show', function(req, res, next) {
  //just render the view. it'll make requests from
  //the client to /generate with any selection info.
  res.render('show.jade', req.query);
});

app.get('/metadata', function(req, res, next) {
  res.status(204).header('Access-Control-Allow-Origin', '*').send();
})


// Below, we read/write the hidden tokens to a separate StoreObject, not
// the Store's main state, because doing so means we don't have to worry
// about a race condition in which the client posts back some hidden
// tokens before main state has been completely computed and saved (such
// that saving the main state would override the hidden words).
app.get('/hidden-tokens', function(req, res, next) {
  var api = new API(req.query.server, req.query.apiToken, oboe)
    , storeStream = api.store().getObjects();

  storeStream.done(function(storeObjects) {
    if(storeObjects[0]) {
      res.send(JSON.stringify(storeObjects[0].json));
    }
    else {
      res.send('{"hidden-tokens": []}');
    }
  });
});

app.put('/hidden-tokens', function(req, res, next) {
  var api = new API(req.query.server, req.query.apiToken, oboe)
    , storeStream = api.store().getObjects()
    , storeData = {
        "indexedString": "hidden tokens",
        "json": {"hidden-tokens": req.body["hidden-tokens"]}
      };

  storeStream.done(function(storeObjects) {
    if(storeObjects[0]) {
      api.store().object(storeObjects[0].id).update(storeData);
    }
    else {
      api.store().createObject(storeData);
    }
    res.status(204).end();
  });
});

app.use('/static', express.static(__dirname + '/public'));
app.listen(process.env.PORT || 3000);
console.log('Listening on port ' + (process.env.PORT || 3000));
