var App = function(oboe, jQuery, d3, d3Cloud, paramString, server, fontsDonePromise) {

  //A flight style component; just bound to dom nodes and handling its own events
  var ChipList = function($container, id) {
    var self = this;
    this.id = id;
    this.listeners = {};
    this.$container = $('<ul id="chiplist-'+ id + '" class="chipList"></ul>');
    this.$container.appendTo($container);

    this.$container.selectonic({
      multi: true,
      keyboard: true,
      focusBlur: true,
      selectionBlur: true,
      select: function(e, ui) {
        //focusing the new selected elm to allow for consecutive deletes
        ui.items.eq(0).focus();
      }
    })

    this.$container.click(function(e) {
      var $target = $(e.target), selected, prevLI;
      if($target.hasClass('delete')) {
        var selected  = self.$container.selectonic("getSelected")
           , prevLI   = selected.eq(0).prev('li')
           , toSelect;

        self.delete($target.parent('li').get(0));
        toSelect  = prevLI.length ? prevLI : self.$container.find('li').eq(0);
        self.$container.selectonic('select', toSelect);
      }
    });

    this.$container.keydown(function(e) {
      switch(e.which) {
        case 8: //delete
          e.preventDefault();
          var selected = self.$container.selectonic("getSelected")
            , prevLI   = selected.eq(0).prev('li')
            , toSelect;

          selected.each(function() {
            self.delete(this);
          });

          toSelect = prevLI.length ? prevLI : self.$container.find('li').eq(0);
          self.$container.selectonic('select', toSelect);
          break;

        case 37: //left or right arrows
        case 39: //re throw it, but mapped to up/down
          e.preventDefault();
          e.which += 1;
          $(e.target).trigger(e);
      }
    });
  }

  ChipList.prototype.delete = function(item) {
    var $item = $(item)
      , value = $item.text();

    $item.remove();
    dispatch("delete", this.listeners, this, [value]);
    this.$container.selectonic("refresh");
  }

  ChipList.prototype.prepend = function(value) {
    $('<li class="chip" tabindex="0"><span class="word">' + value + '</span><span class="delete"></span></li>').prependTo(this.$container);
  }

  //note: deleteAll doesn't dispatch delete events
  ChipList.prototype.deleteAll = function() {
    this.$container.empty();
    this.$container.selectonic("refresh");
  }

  ChipList.prototype.getAll = function() {
    return this.$container.find('li').map(function() { return this.textContent; }).get();
  }

  ChipList.prototype.registerListener = registerListener;

  //OverviewWordCloud "class". This just handles the data logic
  //and triggers events that ui components can respond to.
  var OverviewWordCloud = function(DataStreamer) {
    var self = this;
    this.progress = 0;
    this.words = [];
    this.toExclude = {};
    this.listeners = {};

    DataStreamer()
      .node("![*]", function(data) {
        self.words = data.tokens;
        dispatch(
          "data", 
          self.listeners,
          self, [self.words, self.progress]
        );
        self.updateProgress(data.progress);
        return oboe.drop;
      })
      .done(function() {
        dispatch(
          "done", 
          self.listeners, 
          self, 
          [self.words, self.progress]
        );
      })
  }

  //Event can be "progress", "data", "done", or "inclusionchange".
  OverviewWordCloud.prototype.registerListener = registerListener;

  OverviewWordCloud.prototype.updateProgress = function(newProgress) {
    var oldProgress = this.progress;
    if(newProgress > oldProgress) {
      this.progress = newProgress;
      dispatch(
        "progress", 
        this.listeners, 
        this, [newProgress, oldProgress, this.words]
      );
    }
  }

  OverviewWordCloud.prototype.setExcludedWords = function(exclude) {
    var self = this, includedWords = [], excludedWords = [];

    if(this.progress < 1) {
      throw new Error("At least for now, you can't change included " + 
                      "words until the words are done loading initially.");
    }

    this.toExclude = {};

    exclude.forEach(function(it) {
      self.toExclude[it] = true;
    });

    this.words.forEach(function(wordData) {
      if(self.toExclude[wordData[0]]) {
        excludedWords.push(wordData);
      }
      else {
        includedWords.push(wordData);
      }
    })

    dispatch(
      "inclusionchange", 
      this.listeners,
      this, [includedWords, excludedWords, exclude]
    );
  }

  //Utility functions that OverviewWordCloud depends on.
  function dispatch(event, listenersObj, thisVal, argsArr) {
    if(listenersObj[event] instanceof Array) {
      listenersObj[event].forEach(function(listener) {
        listener.apply(thisVal, argsArr);
      });
    }
  }

  function registerListener(event, fn) {
    (this.listeners[event] || (this.listeners[event] = [])).push(fn);
  }

  function drawCloud(container, size, tokens, percentComplete) {
    //don't do any rendering until the fonts are ready.
    fontsDonePromise.then(function() {
      //this scaler is sorta arbitrary, but it works.
      //It grows linearly w/ docCount, which we expect the tfs to do as well.
      var scaler = tokens.reduce(function(prev, v) { return prev + v[1]; }, 0)/(size[0]*4)
        , fontStack = '"Open Sans", Helvetica, Arial, sans-serif';

      container.style.width = size[0] + 'px';
      container.style.height = size[1] + 'px';

      d3Cloud()
        .size(size)
        .words(tokens.map(function(d) { 
          return {'text': d[0], 'size': d[1]/scaler}; 
        }))
        .padding(4)
        .timeInterval(10)
        .rotate(function() { return 0; })
        .font(fontStack)
        .fontSize(function(d) { return d.size; })
        .on("end", function(words) {
          var oldClouds = d3.select('#cloud') 
            , svg = d3.select(container).append('svg')
                .attr("width", size[0])
                .attr('id', 'cloud')
                .attr("height", size[1]);

            //chrome blurs elements with filters on retina displays, so don't apply
            //the filters to the final wordcloud (where they don't make sense anyway)
            if(percentComplete !== 1) {
              svg = svg
                .style('transform', 'scale('+ percentComplete + ')')
                .style('filter', 'grayscale('+ (1 - percentComplete) + ')')
                .style('-webkit-filter', 'grayscale('+ (1 - percentComplete) + ')')
            }
            
          svg
            .append("g")
              .attr("transform", "translate(" + [size[0] >> 1, size[1] >> 1] + ")")
            .selectAll("text")
              .data(words)
            .enter().append("text")
              .style("font-size", function(d) { return d.size + "px"; })
              .style("font-family", fontStack)
              .style("fill", function(d, i) { return 'hsl('+ Math.floor(i % 360) + ', 80%, 35%)'; })
              .attr("text-anchor", "middle")
              .attr("transform", function(d) {
                return "translate(" + [d.x, d.y] + ")";
              })
              .text(function(d) { return d.text; });

          oldClouds.remove();

        })
        .start();
    });
  }

  var handleClick = (function () {
    //state to track between clicks, stored in a closure.
    var oldMarginTop = 0, oldMarginLeft = 0, oldScaleFactor = 1;

    return function(e, $container) {
      var $target = $(e.target), term, termRect, windowWidth, windowCenter
        , marginTop, marginLeft, scaleFactor, scaleChange;

      if(e.target.tagName.toLowerCase() !== 'text') {  
        window.parent.postMessage({
          call: 'setDocumentListParams',
          args: [{name: 'in document set'}]
        }, server);

        $container
          .removeClass('with-selection')
          .css({
            'transform': 'scale(1)',
            'margin-top': 0, 
            'margin-left': 0
          }).find('.active').attr('class', '');
      }

      else {
        //postMessage first, so overview can start searching.
        term = e.target.textContent;
        window.parent.postMessage({
          call: 'setDocumentListParams',
          args: [{q: term, name: 'with the word ' +  term}]
        }, server);

        //calculate the new scaleFactor
        windowWidth = $window.width(); 
        windowCenter = [windowWidth/2, $window.height()/2];
        termRect     = $target.get(0).getBoundingClientRect();
        scaleFactor = Math.min(3, Math.max(1, (windowWidth/termRect.width * .5)));

        //position logic, adjusting for the change in scaleFactor
        scaleChange  = (scaleFactor/oldScaleFactor);
        marginTop    = windowCenter[1] - (termRect.top - oldMarginTop)*scaleChange - (termRect.height*scaleChange)/2;
        marginLeft   = windowCenter[0] - (termRect.left - oldMarginLeft)*scaleChange - (termRect.width*scaleChange)/2;

        //manage classes. can't use $target.addClass()
        //because .className works differently in SVG
        $container.find('.active').removeAttr('class')
        $target.attr('class', 'active');
        
        //start the animation
        $container
          .addClass('with-selection')
          .css({
            'transform': 'scale(' + scaleFactor + ')',
            'marginTop': marginTop + 'px',
            'marginLeft': marginLeft + 'px'
          });

        //update oldX variables for next time
        oldScaleFactor = scaleFactor;
        oldMarginTop = marginTop;
        oldMarginLeft = marginLeft;
      }
    }
  }());

  //hook things up
  var $window    = jQuery(window)
    , $container = jQuery('#cloud-container')
    , $editor    = jQuery('#cloud-editor')
    , $progress  = jQuery('progress')
    , $editBtn   = jQuery('#edit')
    , $applyBtn  = jQuery('#apply')
    , $fieldSets = $editor.find('fieldset')
    , included   = new ChipList($fieldSets.eq(0), 'included')
    , excluded   = new ChipList($fieldSets.eq(1), 'excluded');

  var cloud = new OverviewWordCloud(function() { 
    return oboe('/generate?' + paramString);
  });

  var render = function(words) {
    drawCloud(
      $container[0], 
      [parseInt($window.width(), 10), parseInt($window.height(), 10)],
      words,
      cloud.progress
    );
  }

  cloud.registerListener("progress", function(newProgress) {
    $progress.attr('value', newProgress);
    render(cloud.words);
  });

  cloud.registerListener("done", function() {
    $progress.remove();
    $editBtn.show();
    cloud.words.forEach(function(wordData) {
      included.prepend(wordData[0]);
    });
    render(cloud.words);
  });

  cloud.registerListener("inclusionchange", function(includedWords, excludedWords) {
    render(includedWords);

    included.deleteAll();
    excluded.deleteAll();

    includedWords.forEach(function(wordData) {
      included.prepend(wordData[0]);
    });

    excludedWords.forEach(function(wordData) {
      excluded.prepend(wordData[0]);
    });
  });

  included.registerListener("delete", function(word) {
    excluded.prepend(word);
  })

  excluded.registerListener("delete", function(word) {
    included.prepend(word);
  });

  var resizeTimer;
  $window.resize(function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 100);
  });

  jQuery('html').click(function(e) {
    var $target = $(e.target);
    //if we're clicking outside the editor...
    if($target.parents('#cloud-container').length > 0) {
      //hide editor if it's open. this preserves but doesn't apply changes.
      //should we discard changes? maybe have an explicit cancel option?
      $editor.slideUp();
    }

    //handle wordcloud clicks which, because of zooming, can be anywhere.
    handleClick.apply(this, [e, $container]);
  });

  $editBtn.click(function() {
    $editor.slideDown(500);
  });

  $applyBtn.click(function() {
    cloud.setExcludedWords(excluded.getAll());
    $editor.slideUp();
  });
};