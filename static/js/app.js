//App will be our one global.
var App = function(jQuery, RSVP, Heap, WordCloud, host, apiTokenEncoded, documentSetId) {

  //API "class"
  var API = function(ajax, RSVP, host, apiTokenEncoded) {
    this.ajax = ajax;
    this.RSVP = RSVP;
    this.host = host;
    this.apiTokenEncoded = apiTokenEncoded;
  }

  API.prototype.request = function(path, method, body) {
    method = method || "GET";
    var self = this
      , url = this.host + '/api/v1' + path;

    return new this.RSVP.Promise(function(resolve, reject) {
      //configure ajax
      var ajaxSettings = {
        success: function(data) {
          resolve(data);
        },
        error: function(jqXHR, textStatus, errorThrown) {
          reject(errorThrown || new Error(textStatus));
        },
        headers: {
          'Authorization': 'Basic ' + self.apiTokenEncoded
        }
      };

      if(body) {
        ajaxSettings.contentType = 'application/json; charset=UTF-8';
      }
  
      self.ajax(url, ajaxSettings);
    });
  };

  API.prototype.getDocumentIds = function(docSetId) {
    return this.request("/document-sets/" + docSetId + "/documents?fields=id");
  };

  API.prototype.getDocument = function(docId, docSetId) {
    return this.request("/document-sets/" + docSetId + "/documents/" + docId)
      .then(function(doc) {
        return doc.text;
      });
  };

  //OverviewWordCloud "class"
  var OverviewWordCloud = function($, RSVP, Heap, API, documentSetId) {
    this.$ = $;
    this.API = API;
    this.RSVP = RSVP;
    this.Heap = Heap;
    this.documentSetId = documentSetId;
    this.uniqueTokenCount = 0;
    this.frequencies = {};
    this.documentsProcessed = 0; //for the progress bar
  }

  OverviewWordCloud.prototype.tokenize = function(doc) {
    return doc.toLowerCase().replace(/(?:--)|\s+/g, ' ').split(' ')
      .map(function(punctuated_token) {
      //strip inter-word punctuation
      //(i.e. punctuation that's on either edge of the token)
      return punctuated_token.replace(
        /^[\.\!\-\#\%\*\,\-\/:;\?@\[-\]_\{\}\¡]+|[\.\!\-\#\%\*\,\-\/:;\?@\[-\]_\{\}\¡]+$/g,
        ""
      );
    });
  };

  OverviewWordCloud.prototype.processDocument = function(doc) {
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

    this.documentsProcessed++;
    return true;
  }

  /**
   * Returns the top, valid tokens in a format amenable to the word cloud.
   * Used because the word cloud only really needs max 200 terms to show.
   */
  OverviewWordCloud.prototype.getTopTokens = function(tokenLimit) {
    var frequencies = this.frequencies
      , topHeap = new Heap(function(a, b) {
          return a[1] - b[1];
        })
      , key, sampled = 0;

    //delete any empty tokens the tokenizer let through.
    //it's easier to do this here than at each tokenization.
    delete frequencies[""];

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

  OverviewWordCloud.prototype.updateProgress = function($progress, max) {
    if(max) {
      $progress.attr('max', max);
    }
    $progress.attr('value', this.documentsProcessed);
  }

  OverviewWordCloud.prototype.render = function($container, cloudDrawer, tokenLimit) {
    var self = this
      , $window = $(window)
      , $progress = $container.find('progress').eq(0)
      , processDocument = self.processDocument.bind(self)
      , updateProgress = function() {
          return self.updateProgress($progress);
        }
      , renderer = function() {
          $container.css({
            'height': parseInt($window.height(), 10) + 'px',
            'width': parseInt($window.width(), 10) + 'px'
          });
          cloudDrawer($container[0], topTokenData);
        }
      , topTokenData; //will be populated when all docs are processed.

    this.API.getDocumentIds(this.documentSetId)
      //update progress bar now that we know the documentCount
      .then(function(ids) {
        self.updateProgress($progress, ids.length);
        return ids;
      })

      //queue up each document to be processed asynchronously,
      //and keep track of the promises for the processed results.
      .then(function(ids) {
        var processedDocPromises = [];
        ids.forEach(function(id) {
          processedDocPromises.push(
            self.API.getDocument(id, self.documentSetId)
              .then(processDocument)
              .then(updateProgress)
          );
        });
        return processedDocPromises;
      })

      //when all the docs are processed, save the topTokenData,
      //render the cloud, and set it up to re-render on window resizes. 
      .then(function(processedDocPromises) {
        self.RSVP.all(processedDocPromises)
          .then(function() {
            var topTokens = self.getTopTokens(tokenLimit)
              , scaler = topTokens.reduce(function(old, curr) { 
                  return old + curr[1]; 
                }, 0)/($window.width()*10); // <-- this is pretty arbitrary.
            
            topTokenData = {
              list: topTokens.map(function(v) { v[1] = v[1]/scaler; return v; })
            };

            $progress.remove();
            renderer();
            $(window).resize(renderer);
          });
      });
  };

  //initializataion
  var client = new API(jQuery.ajax.bind(jQuery), RSVP, host, apiTokenEncoded);
  var cloud = new OverviewWordCloud(jQuery, RSVP, Heap, client, documentSetId);
  cloud.render($('#cloud-container'), WordCloud, 150);
};