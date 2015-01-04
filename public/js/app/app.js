import $ from 'lib/jquery'
import oboe from 'lib/oboe-browser'
import Modernizr from 'lib/modernizr.custom'
import Cloud from './OverviewWordCloud'
import CloudLayout from './CloudLayout'
import SearchMode from './SearchMode'
import EraserMode from './EraserMode'
import ModeSwitcher from './ModeSwitcher'
import Tooltip from 'lib/bootstrap.tooltip'

export default function(paramString, server) {
  var $window    = $(window)
    , $html      = $('html')
    , $container = $('#cloud-container')
    , $progress  = $('progress');

  //generate our objects and hook up various event listeners
  var cloud  = new Cloud()
    , layout = new CloudLayout()
    , modeSwitcher = new ModeSwitcher([{
          "mode": new SearchMode(cloud, $container),
          "control": $('#search-btn'),
          "default": true
        }, {
          "mode": new EraserMode(cloud, $('#hidden-btn'), $('#hidden-list'), $('#hidden-count')),
          "control": $('#eraser-btn')
        }
      ]);

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
    modeSwitcher.currentMode.handleInclusionChange(included, excluded);
  });

  $html.click((e) => { 
    modeSwitcher.currentMode.handleClick(e, server);
  });

  //get things started
  $('[data-toggle="tooltip"]').tooltip();
  cloud.start(() => oboe('/generate?' + paramString))

  var resizeTimer;
  $window.resize(function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 100);
  });

  function render() {
    layout.render(
      $container[0],
      [parseInt($window.width(), 10), parseInt($window.height(), 10)],
      cloud.words, 
      cloud.progress
    );
  };
};