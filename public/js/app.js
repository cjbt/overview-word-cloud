var App = function(oboe, jQuery, d3, d3Cloud, paramString, server, fontsDonePromise) {

  var $window = jQuery(window);

  var getWordCloudData = function() {
    return oboe('/generate?' + paramString);
  }

  //a function setting up d3 cloud to implement
  //my informal "renderer" interface.
  var drawCloud = function(container, size, topTokens, percentComplete) {
    //don't do any rendering until the fonts are ready.
    fontsDonePromise.then(function() {
      //this scaler is sorta arbitrary, but it works.
      //It grows linearly w/ docCount, which we expect the tfs to do as well.
      var scaler = topTokens.reduce(function(prev, v) { return prev + v[1]; }, 0)/(size[0]*4)
        , fontStack = '"Open Sans", Helvetica, Arial, sans-serif';

      container.style.width = size[0] + 'px';
      container.style.height = size[1] + 'px';

      d3Cloud()
        .size(size)
        .words(topTokens.map(function(d) { 
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

  //OverviewWordCloud "class"
  var OverviewWordCloud = function($window, $container, renderer, clickListener, DataStreamer) {
    var self = this, i = 0;
    this.progress = 0;
    this.renderer = renderer;
    this.$window = $window;
    this.$container = $container;
    this.$progress = $container.find('progress').eq(0);
    this.latestData = {}

    DataStreamer()
      .node("![*]", function(data) {
        i++;
        self.latestData = data.tokens;
        self.updateProgress(data.progress);
        self.render();
        return oboe.drop;
      })
      .done(function() {
        var resizeTimer, render = self.render.bind(self);

        $window.resize(function() {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(render, 100);
        });

        render();
        self.$progress.remove();
      })

    jQuery('html').click(function(e) {
      clickListener.apply(this, [e, self.$container]);
    });
  }

  OverviewWordCloud.prototype.updateProgress = function(newProgress) {
    if(newProgress > this.progress) {
      this.progress = newProgress;
      this.$progress.attr('value', this.progress);
    }
  }

  OverviewWordCloud.prototype.render = function() {
    this.renderer(
      this.$container[0],
      [parseInt(this.$window.width(), 10), parseInt(this.$window.height(), 10)], 
      this.latestData,
      this.progress
    );
  };

  //init
  new OverviewWordCloud($window, jQuery('#cloud-container'), drawCloud, handleClick, getWordCloudData);
};