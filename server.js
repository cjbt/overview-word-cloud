#!/usr/bin/env node
'use strict';

const express       = require('express')
const fs            = require('fs')
const morgan        = require('morgan')
const bodyParser    = require('body-parser')
const util          = require('util')
const oboe          = require('oboe')
const API           = require('overview-api-node')
const TokenBin      = require('overview-js-token-bin')
const SendInterval  = 500 // ms between sends
const MaxNTokens    = 150 // tokens sent to client
const app           = express();

app.use(morgan('short'));
app.use(bodyParser.json());

let nextRequestId = 1;
const MinWordLength = 3;
// Stopwords: hash of token => null
const Stopwords = "a about above after again against all am an and any are aren't as at be because been before being below between both but by can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with will won't would wouldn't you you'd you'll you're you've your yours yourself yourselves"
  .split(/ /g)
  .reduce((a, t) => { a[t] = null; return a }, {})

/*
 * Storage version format: 2
 *
 * 1: { progress: 1, tokens: [ [ 'foo', 2 ], ... ] }
 * 2: { version: 2, tokens: [ { name: 'foo', nDocuments: 2, frequency: 5 } ] },
 *    with overview-js-tokenizer 0.0.2.
 */
const StorageFormatVersion = 2;

app.get('/generate', function(req, res, next) {
  const api = new API(req.query.server, req.query.apiToken, oboe)
  const requestId = nextRequestId++
  const requestStartDate = new Date()
  const tokenBin = new TokenBin([])
  const storeStream = api.store().getState()
  let docStream = null
  let sendTimeoutId = null

  res.header('Content-Type', 'application/json')

  // Check the store. If we don't have a saved result, generate + save one.
  storeStream.done(json => {
    let nDocumentsTotal = null
    let firstSend = true

    if (typeof(json) === 'object' && json.version == StorageFormatVersion) {
      res.json([ { progress: 1, tokens: json.tokens } ])
      console.log(
        '[req %d] sent the JSON for docset %d from the store - %d ms elapsed',
        requestId,
        req.query.documentSetId,
        new Date() - requestStartDate
      )
    } else {
      docStream = api.docSet(req.query.documentSetId).getDocuments([ "tokens" ], "random");
      docStream
        .node('pagination.total', total => {
          nDocumentsTotal = total
          sendTimeoutId = setTimeout(sendSnapshotAndQueue, SendInterval)
        })
        .node('items.*', doc => {
          const tokenStream = doc.tokens
            .toLowerCase()
            .split(' ')
            .filter(t => !Stopwords.hasOwnProperty(t) && t.length >= MinWordLength)
          tokenBin.addTokens(tokenStream)

          return oboe.drop // remove the doc from memory
        })
        .done(() => {
          const lastJson = getSnapshotJson();
          clearTimeout(sendTimeoutId);
          sendSnapshot(true, lastJson);
          api.store().setState({
            version: StorageFormatVersion,
            tokens: lastJson.tokens
          })
        })
    }

    function getSnapshotJson() {
      const tokens = tokenBin.getTokensByFrequency().slice(0, MaxNTokens)
      const progress = nDocumentsTotal ? (tokenBin.nDocuments / nDocumentsTotal) : 0;

      return {
        progress: progress,
        tokens: tokens,
      }
    }

    function sendSnapshot(lastSend, json) {
      res.write((firstSend ? '[' : ',') + JSON.stringify(json))
      firstSend = false

      if (lastSend) {
        res.end(']')
      }

      console.log(
        '[req %d] pushed %s JSON for docset %d - %d ms elapsed',
        requestId,
        lastSend ? 'last' : 'some',
        req.query.documentSetId,
        new Date() - requestStartDate
      )
    }

    function sendSnapshotAndQueue() {
      sendSnapshot(false, getSnapshotJson())
      sendTimeoutId = setTimeout(sendSnapshotAndQueue, SendInterval)
    }
  })

  function abort() {
    console.log('[req %d] abort', requestId)
    storeStream.abort()
    if (docStream && docStream.abort) {
      docStream.abort() // docStream will fire no more callbacks
    }
    if (sendTimeoutId) {
      clearTimeout(sendTimeoutId)
    }
    res.end()
  }

  req.on('close', abort);
})

const readFilePromise = util.promisify(fs.readFile)
const setTimeoutPromise = util.promisify(setTimeout)
function readShowHtml() {
  return readFilePromise('./dist/show')
    .catch((e) => {
      if (e.code === 'ENOENT') {
        console.log('Waiting 1s for Webpack to generate dist/show')

        return setTimeoutPromise(1000, null)
          .then(() => readShowHtml())
      }
    })
}

app.get('/show', (req, res, next) => {
  readShowHtml()
    .then(htmlBytes => {
      res
        .status(200)
        .header('Content-Type', 'text/html; charset=utf-8')
        .header('Cache-Control', 'public; max-age=10')
        .send(htmlBytes)
    })
})

app.get('/metadata', (req, res, next) => {
  res
    .status(200)
    .header('Access-Control-Allow-Origin', '*')
    .header('Content-Type', 'application/json')
    .header('Cache-Control', 'public; max-age=10')
    .send('{}')
})

// Below, we read/write the hidden tokens to a separate StoreObject, not
// the Store's main state, because doing so means we don't have to worry
// about a race condition in which the client posts back some hidden
// tokens before main state has been completely computed and saved (such
// that saving the main state would override the hidden words).
app.get('/hidden-tokens', (req, res, next) => {
  const api = new API(req.query.server, req.query.apiToken, oboe)
  const storeStream = api.store().getObjects()

  res
    .status(200)
    .header('Content-Type', 'application/json')
    .header('Cache-Control', 'private; max-age=0')

  storeStream.done(storeObjects => {
    if (storeObjects[0]) {
      res.send(JSON.stringify(storeObjects[0].json))
    } else {
      res.send('{"hidden-tokens": []}')
    }
  })
})

app.put('/hidden-tokens', (req, res, next) => {
  const api = new API(req.query.server, req.query.apiToken, oboe)
  const storeStream = api.store().getObjects()
  const storeData = {
    indexedString: 'hidden tokens',
    json: {
      'hidden-tokens': req.body['hidden-tokens'],
    },
  }

  storeStream.done(storeObjects => {
    if (storeObjects[0]) {
      api.store().object(storeObjects[0].id).update(storeData)
    } else {
      api.store().createObject(storeData)
    }
    res.status(204).end()
  })
})

app.use(express.static(__dirname + '/dist', {
  immutable: true,
  index: false,
}))

const PORT = parseFloat(process.env.PORT) || 80
app.listen(PORT, () => { console.log('Listening on port ' + PORT) })
