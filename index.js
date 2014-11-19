'use strict';
var express            = require('express')
  , morgan             = require('morgan')
  , oboe               = require('./lib/oboe-requester')
  , API                = require('./lib/api')
  , DocSetTokenCounter = require('./lib/doc-set-token-counter')
  , SendInterval       = 500 // ms between sends
  , app                = express();

app.use(morgan('combined'));

app.get('/generate', function(req, res, next) {
  var api = new API(req.query.server, req.query.apiToken)
    , docStream = api.getAllDocuments(oboe, req.query.documentSetId, "random")
    , counter = new DocSetTokenCounter()
    , nDocumentsProcessed = 0, nDocumentsTotal
    , firstSend = true, sendTimeoutId;

  res.header('Content-Type', 'application/json');

  function sendSnapshot(lastSend) {
    var vector   = tfdfArrayToTfMap(counter.getTopTokens(150))
      , progress = nDocumentsTotal ? (nDocumentsProcessed / nDocumentsTotal) : 0
      , json     = getResponseJson(vector, progress)
      , before   = firstSend ? "[" : ",";

    console.log("Pushed %d bytes of JSON on docset %d", json.length, req.query.documentSetId);

    res.write(before + json);
    firstSend = false;

    if (lastSend) {
      res.end("]");
    }
  }

  function sendSnapshotAndQueue() {
    sendSnapshot(false);
    sendTimeoutId = setTimeout(sendSnapshotAndQueue, SendInterval);
  }

  docStream
    .node('pagination.total', function(total) {
      nDocumentsTotal = total;

      sendTimeoutId = setTimeout(sendSnapshotAndQueue, SendInterval);
    })
    .node('items.*', function(doc) {
      nDocumentsProcessed += 1;
      counter.processDocument(doc.text);

      return oboe.drop; //remove the doc from memory
    })
    .done(function() {
      clearTimeout(sendTimeoutId);
      sendSnapshot(true);
    });
});

app.get('/show', function(req, res, next) {
  //just render the view. it'll make requests from
  //the client to /generate with any selection info.
  res.render('show.jade', req.query);
});

app.get('/metadata', function(req, res, next) {
  res.status(204).header('Access-Control-Allow-Origin', '*').send();
})

app.use('/static', express.static(__dirname + '/public'));
app.listen(process.env.PORT || 3000);
console.log('Listening on port ' + (process.env.PORT || 3000));

//Converts a [['term', tf, df], ...] array to {'term': tf, ...}
function tfdfArrayToTfMap(tfdf) {
  var obj = {};
  tfdf.forEach(function(it) { obj[it[0]] = it[1]; });
  return obj;
}

function getResponseJson(vector, progress) {
  return JSON.stringify({
    "progress": progress,
    "tokens": vector
  });
}
