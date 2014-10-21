var App = function(oboe, jQuery, d3, d3Cloud, paramString) {

  var getWordCloudData = function() {
    return oboe('/generate?' + paramString);
  }

  //a function setting up d3 cloud to implement
  //my informal "renderer" interface.
  var cloudDrawer = function(container, size, topTokens) {
    //this is sorta arbitrary, but it works.
    var scaler = topTokens.reduce(function(old, curr) { 
        return old + curr[1]; 
      }, 0)/(size[0]*4);

    var fill = d3.scale.category20b();

    container.style.width = size[0] + 'px';
    container.style.height = size[1] + 'px';

    d3Cloud()
      .size(size)
      .words(topTokens.map(function(d) { 
        return {'text': d[0], 'size': d[1]/scaler}; 
      }))
      .padding(3)
      .timeInterval(10)
      .rotate(function() { return 0; })
      .font("'Palatino', 'Palatino Linotype', Trebuchet MS'")
      .fontSize(function(d) { return d.size; })
      .on("end", function(words) {
        d3.select(container).append('svg')
          .attr("width", size[0])
          .attr("height", size[1])
        .append("g")
          .attr("transform", "translate(" + [size[0] >> 1, size[1] >> 1] + ")")
        .selectAll("text")
          .data(words)
        .enter().append("text")
          .style("font-size", function(d) { return d.size + "px"; })
          .style("font-family", "'Palatino', 'Palatino Linotype', Trebuchet MS'")
          .style("fill", function(d, i) { return 'hsl('+ Math.floor(i % 360) + ', 80%, 35%)'; })
          .attr("text-anchor", "middle")
          .attr("transform", function(d) {
            return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
          })
          .text(function(d) { return d.text; });
      })
      .start();
  }

  //OverviewWordCloud "class"
  var OverviewWordCloud = function($window, $container, renderer, DataStreamer) {
    var self = this, i = 0;
    this.progress = 0;
    this.renderer = renderer;
    this.$window = $window;
    this.$container = $container;
    this.$progress = $container.find('progress').eq(0);

    DataStreamer()
      .node("![*]", function(data) {
        i++;
        self.updateProgress();
        if(i % 2 == 0) {
          self.render(data);
        }
      })
      .done(function(finalData) {
        var resizeTimer;
        
        function render() {
          self.render(finalData[finalData.length-1]);
        };
        
        $window.resize(function() {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(render, 80);
        });
        self.$progress.remove();
        render();
      })
  }

  OverviewWordCloud.prototype.updateProgress = function() {
    this.progress += .2;
    this.$progress.attr('value', this.progress);
  }

  OverviewWordCloud.prototype.render = function(topTokens) {
    this.$container.children().remove('svg,canvas');
    this.renderer(
      this.$container[0],
      [parseInt(this.$window.width(), 10), parseInt(this.$window.height(), 10)], 
      topTokens
    );
  };

  //init
  new OverviewWordCloud($(window), $('#cloud-container'), cloudDrawer, getWordCloudData);
};