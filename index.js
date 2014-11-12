'use strict';
var url                = require('url')
  , http               = require('http')
  , fs                 = require('fs')
  , path               = require('path')
  , express            = require('express')
  , morgan             = require('morgan')
  , oboe               = require('./lib/oboe-requester')
  , API                = require('./lib/api')
  , Heap               = require('heap')
  , DocSetTokenCounter = require('./lib/doc-set-token-counter')
  , util               = require('./lib/util')
  , app                = express();

app.use(morgan('combined'));

app.get('/generate', function(req, res, next) {
  var api = new API(req.query.server, req.query.apiToken)
    , docStream = api.getAllDocuments(oboe, req.query.documentSetId, "random")
    , counter = new DocSetTokenCounter()
    , docSetSize, incrementSize, tilNextRender
    , oldVector, priorSimilarities = []; //for convergence testing. 

  res.header('Content-Type', 'application/json');

  docStream
    .node("pagination.total", function(total) {
      docSetSize = total;
      incrementSize = Math.min(500, Math.max(100, Math.floor(docSetSize*.02)));
      tilNextRender = incrementSize + (docSetSize % incrementSize);
      res.write('[');
    })
    .node('items.*', function(doc){
      var newVector, progress;

      //process the doc
      counter.processDocument(doc.text);

      //special case: initially, populate oldVector from the first doc.
      if(!oldVector) {
        oldVector = tfdfArrayToTfMap(counter.getTopTokens(150, Heap)) || {'a': 1};
      }

      //after processing incrementSize docs...
      tilNextRender--;
      if(tilNextRender==0) {
        //track convergence
        newVector = tfdfArrayToTfMap(counter.getTopTokens(150, Heap));
        priorSimilarities.push(util.cosineSimilarity(oldVector, newVector));
        oldVector = newVector;
        progress = computeProgress(priorSimilarities);

        //restart counter
        tilNextRender = incrementSize;

        //write response
        res.write(getResponseJson(counter, progress));
        if(progress == 1) {
          res.write(']');
          res.end();
          this.abort();
        }

        else {
          res.write(', ');
        }
      }

      //remove the doc from memory
      return oboe.drop;
    })
    .done(function() {
      //If the cloud didn't converge and abort above, or if the convergence
      //checking was never even attempted--which happens when we have fewer
      //than incrementSize docs--we end the request manually here with the 
      //final data.
      res.write(getResponseJson(counter, 1)); 
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
app.listen(process.env.PORT || 3000);
console.log('Listening on port ' + (process.env.PORT || 3000));

function computeProgress(priorSimilarities) {
  var measurementCount = priorSimilarities.length
    , lastMeasurement  = priorSimilarities[measurementCount - 1]
    , oneMinusSimilarities, baseVal, projectDecayFromCount
    , projectedDecayRate = 0, remainingIterations = 1;

  //we mark the progress as complete (return 1), when 
  //the last cosSimilarity was greater than .9999
  if(lastMeasurement > .9999) {
    return 1;
  }

  //meanwhile, if we have only computed one cos similarity (i.e. a wordcloud
  //of the first doc compared to a wordcloud of the first incrementSize docs),
  //we can't predict the rate at which the cos similarity will converge, so we
  //just return that first value.
  if(measurementCount==1) {
    return priorSimilarities[0];
  }

  //if it's not complete, we want to project how many more iterations we
  //have to go. So we'll assume that (1-cosSimilarity) goes to zero
  //exponentially, and we'll then project what the decay rate will be.
  //(If this assumption is true, btw, our progress will grow linearly. And,
  //from a bit of experimenting, it does in fact seem to.)

  //we start by calculating the (1-cosSimilarity) terms.
  oneMinusSimilarities = priorSimilarities.map(function(it) { return 1 - it; });

  //Now we project the future decay rate (semi-arbitrarily) as a
  //weighted average of the prior four decays. (Or, if we don't have 
  //three prior decays, of however many we do have.)
  projectDecayFromCount = Math.min(5, measurementCount);
  for(var i = 1; i < projectDecayFromCount; i++) {
    projectedDecayRate += 
      (oneMinusSimilarities[i]/oneMinusSimilarities[i-1])/(projectDecayFromCount-1);
  }

  //and we estimate the number of remaining
  //iterations just by carrying the decay forward.
  baseVal = oneMinusSimilarities[measurementCount - 1];
  while(baseVal*Math.pow(projectedDecayRate, remainingIterations) > .0001) {
    remainingIterations++;
  }

  return measurementCount/(measurementCount+remainingIterations);
}

//Converts a [['term', tf, df], ...] array to {'term': tf, ...}
function tfdfArrayToTfMap(tfdf) {
  var obj = {};
  tfdf.forEach(function(it) { obj[it[0]] = it[1]; });
  return obj;
}

function getResponseJson(counter, progress) {
  return JSON.stringify({
    "progress": progress, 
    "tokens": counter.getTopTokens(150, Heap)
  });
}
