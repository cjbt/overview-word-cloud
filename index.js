'use strict';
var url       = require('url')
  , http      = require('http')
  , fs        = require('fs')
  , path      = require('path')
  , express   = require('express')
  , app       = express();  
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