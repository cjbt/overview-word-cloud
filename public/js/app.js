var App = function(oboe, jQuery, d3, d3Cloud, paramString, server) {

  var $window = jQuery(window);

  var getWordCloudData = function() {
    return oboe('/generate?' + paramString);
  }

  //a function setting up d3 cloud to implement
  //my informal "renderer" interface.
  var drawCloud = function(container, size, topTokens, percentComplete) {
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
              return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
            })
            .text(function(d) { return d.text; });

        oldClouds.remove();

      })
      .start();
  }

  function handleClick(e, $container) {
    var $target = $(e.target), center, offset, term;

    if(e.target.tagName.toLowerCase() !== 'text') {
      window.parent.postMessage({
        call: 'setDocumentListParams',
        args: [{name: 'in document set'}]
      }, server);

      $container.animate({'margin-top': 0, 'margin-left': 0, 'transform': 'scale(1)'}, 400)
    }
    else {
      center = [$window.width()/2, $window.height()/2];
      offset = $target.offset();
      term = e.target.textContent;

      $container.animate({
        'marginTop': '+=' + (center[1] - offset['top'] - $target.height()/2),
        'marginLeft': '+=' + (center[0] - offset['left'] - $target.width()/2),
        'transform': 'scale(1.6)'
      }, 500);

      window.parent.postMessage({
        call: 'setDocumentListParams',
        args: [{q: term, name: 'with the word ' +  term}]
      }, server);
    }
  }

  //OverviewWordCloud "class"
  var OverviewWordCloud = function($window, $container, renderer, clickListener, DataStreamer) {
    var self = this, i = 0;
    this.progress = 0;
    this.shownProgress = 0;
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

      //Usually, set shownProgress to the real progress squared, as that
      //makes shownProgress grow faster as the real progress approaches 1.
      //This makes the wait feel faster by under-promising and over-delivering.
      //(See: http://www.nngroup.com/articles/progress-indicators/ for more.)
      this.shownProgress = Math.max(this.progress*this.progress, this.shownProgress);
    }

    //But, if a request to update the progress comes in and the newProgress is
    //bigger than what we're showing before but smaller than the real progress,
    //it's better to update the shownProgress to something closer to newProgress
    //than to not update the bar at all (even though it messes with our 
    //squared strategy). And because of this update, we use Math.max above to 
    //make sure progress never goes backwards.
    else if(newProgress > this.shownProgress) {
      this.shownProgress = (newProgress*.25 + .75*this.shownProgress);
    }

    this.$progress.attr('value', this.shownProgress);
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