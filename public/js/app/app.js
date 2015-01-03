import $ from 'lib/jquery'
import oboe from 'lib/oboe-browser'
import Modernizr from 'lib/modernizr.custom'
import Cloud from './OverviewWordCloud'
import CloudLayout from './CloudLayout'
import SearchMode from './SearchMode'
import EraserMode from './EraserMode'

export default function(paramString, server) {
  var $window    = $(window)
    , $html      = $('html')
    , $container = $('#cloud-container')
    , $progress  = $('progress')
    , $searchModeCntrl = $('#search-mode')
    , $eraserModeCntrl = $('#eraser-mode');

  //generate our objects and hook up various event listeners
  var cloud  = new Cloud()
    , layout = new CloudLayout()
    , searchMode = new SearchMode(cloud, server)
    , eraserMode = new EraserMode(cloud, $('#hidden-btn'), $('#hidden-list'), $('#hidden-count'))
    , currMode;

  cloud.observe("progress", function(newProgress) {
    $progress.attr('value', newProgress);
    render();
  });

  cloud.observe("done", function() {
    $progress.remove();
    render();
  });

  cloud.observe("inclusionchange", function(included, excluded) {
    render();
    currMode.handleInclusionChange(included, excluded);
  });

  $searchModeCntrl.click(() => switchModes(searchMode));
  $eraserModeCntrl.click(() => switchModes(eraserMode));

  $html.click((e) => { 
    if($(e.target).not($searchModeCntrl).not($eraserModeCntrl).length) {
      currMode.handleClick(e, server, $container);  
    }
  });

  //get things started
  cloud.start(() => oboe('/generate?' + paramString))
  $searchModeCntrl.click();

  var resizeTimer;
  $window.resize(function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 100);
  });

  function switchModes(newMode) {
    if(currMode) { 
      currMode.deactivate();
      $html.removeClass(currMode.getName());
    }
    currMode = newMode;
    $html.addClass(currMode.getName());
    currMode.activate();
  }

  function render() {
    layout.render(
      $container[0],
      [parseInt($window.width(), 10), parseInt($window.height(), 10)],
      cloud.words, 
      cloud.progress
    );
  };
};