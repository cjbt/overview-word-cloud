import css from './show.css'

import $ from 'jquery'
import oboe from 'oboe'
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
    $progress.remove()
    render()

    fetch('/hidden-tokens' + paramString)
      .then(response => response.json())
      .then(it => cloud.setExcludedWords(it['hidden-tokens'] || []))
      .catch(err => console.error(err))
  })

  cloud.observe("inclusionchange", function(excludedArr) {
    var eraserMode = modeSwitcher.modesMap["eraser-mode"].mode
    eraserMode.handleInclusionChange(excludedArr);

    render()

    fetch('/hidden-tokens' + paramString, {
      method: 'PUT',
      body: JSON.stringify({ 'hidden-tokens': excludedArr }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    })
      .catch(err => console.error(err))
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
