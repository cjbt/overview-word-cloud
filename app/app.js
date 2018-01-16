import css from './show.css'

import $ from './vendor/jquery'
import oboe from './vendor/oboe-browser'
import Cloud from './OverviewWordCloud'
import CloudLayout from './CloudLayout'
import SearchMode from './SearchMode'
import EraserMode from './EraserMode'
import ModeSwitcher from './ModeSwitcher'
import Tooltip from './vendor/bootstrap.tooltip'

export default function(paramString, server, origin) {
  var $window    = $(window)
    , $html      = $('html')
    , $progress  = $('progress');

  const cloudContainer = document.querySelector('#cloud-container')

  //generate our objects and hook up various event listeners
  var cloud  = new Cloud()
    , layout = new CloudLayout()
    , modeSwitcher = new ModeSwitcher([{
          "mode": new SearchMode(cloud, $(cloudContainer)),
          "control": $('#search-btn'),
          "default": true
        }, {
          "mode": new EraserMode(cloud, $('#hidden-btn'), $('#hidden-list'), $('#hidden-count')),
          "control": $('#eraser-btn')
        }
      ]);

  cloud.observe("progress", function(newProgress) {
    $progress.attr('value', newProgress)
    render()
  })

  cloud.observe("done", function() {
    // hide words from before. do this on done because the system
    // will get confused if we try to hide a word before its loaded.
    oboe('/hidden-tokens' + paramString).done(it => {
      cloud.setExcludedWords(it["hidden-tokens"]);
    });
    $progress.remove()
    render()
  })

  cloud.observe("inclusionchange", function(excludedArr) {
    var eraserMode = modeSwitcher.modesMap["eraser-mode"].mode
    render()
    oboe({
      "url": "/hidden-tokens" + paramString, 
      "method": "PUT", 
      "body": {"hidden-tokens": excludedArr} 
    })
    eraserMode.handleInclusionChange(excludedArr);
  })

  $html.click((e) => { 
    modeSwitcher.currentMode.handleClick(e, origin);
  });

  //get things started
  $('[data-toggle="tooltip"]').tooltip();
  cloud.start(() => oboe('/generate' + paramString))

  //handle resizes
  let resizeTimer = null
  window.addEventListener('resize', () => {
    if (resizeTimer) return
    resizeTimer = setTimeout(() => {
      render()
      resizeTimer = null
    }, 100)
  })

  function render() {
    layout.render(
      cloudContainer,
      cloud.getTokens(), 
      cloud.progress
    );
  };
};
