'use strict';
var url       = require('url')
  , http      = require('http')
  , fs        = require('fs')
  , path      = require('path')
  , express   = require('express')
  , oboe      = require('./lib/oboe-requester')
  , API       = require('./lib/api')
  , Heap      = require('heap')
  , WordCloud = require('./lib/wordcloud')
  , app       = express();  

app.get('/generate', function(req, res, next) {
  var api = new API(req.query.server, req.query.vizId, req.query.apiToken)
    , docStream = api.getAllDocuments(oboe, req.query.documentSetId)
    , cloud = new WordCloud()
    , docSetSize, incrementSize, tilNextRender, renderNumber = 0;

  res.header('Content-Type', 'application/json');

  docStream
    .node("pagination.total", function(total) {
      docSetSize = total;
      incrementSize = Math.floor(total/5);
      tilNextRender = incrementSize;
      res.write('[');
    })
    .node('items.*', function(doc){
      cloud.processDocument(doc.text);
      tilNextRender--;
      if(tilNextRender==0) {
        res.write(JSON.stringify(cloud.getTopTokens(150, Heap)));
        renderNumber++;
        if(renderNumber!=5) {
          res.write(', ');
        }
        tilNextRender = incrementSize;
      }
      return oboe.drop;
    })
    .done(function() {
      res.write(']');
      res.end();
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
app.listen(3000); //we'll figure out https on deployment.