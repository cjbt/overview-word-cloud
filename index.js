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
    , firstSend = true, sendIntervalId;

  res.header('Content-Type', 'application/json');

  function sendSnapshot(lastSend) {
    var vector   = tfdfArrayToTfMap(counter.getTopTokens(150))
      , progress = nDocumentsTotal ? (nDocumentsProcessed / nDocumentsTotal) : 0
      , json     = getResponseJson(vector, progress)
      , before   = firstSend ? "[" : ",";

    res.write(before + json);
    firstSend = false;

    if (lastSend) {
      res.end("]");
    }
  }

  docStream
    .node('pagination.total', function(total) {
      nDocumentsTotal = total;

      sendIntervalId = setInterval(sendSnapshot, SendInterval);
    })
    .node('items.*', function(doc) {
      nDocumentsProcessed += 1;
      counter.processDocument(doc.text);

      //remove the doc from memory
      return oboe.drop;
    })
    .done(function() {
      clearInterval(sendIntervalId);
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
