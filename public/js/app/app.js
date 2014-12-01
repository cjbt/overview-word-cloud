import $ from 'lib/jquery'
import oboe from 'lib/oboe-browser'
import Modernizr from 'lib/modernizr.custom'
import Cloud from './OverviewWordCloud'
import CloudLayout from './CloudLayout'
import ChipList from './ChipList'

export default function(paramString, server) {
  var $window    = $(window)
    , $container = $('#cloud-container')
    , $editor    = $('#cloud-editor')
    , $progress  = $('progress')
    , $editBtn   = $('#edit')
    , $applyBtn  = $('#apply')
    , $fieldSets = $editor.find('fieldset')
    , included   = new ChipList($fieldSets.eq(0), 'included')
    , excluded   = new ChipList($fieldSets.eq(1), 'excluded'); 

  //generate our objects and hook up various event listeners
  var cloud  = new Cloud(() => oboe('/generate?' + paramString))
    , layout = new CloudLayout();

  var render = function() {
    layout.render(
      $container[0],
      [parseInt($window.width(), 10), parseInt($window.height(), 10)],
      cloud.words, 
      cloud.progress
    );
  };

  cloud.observe("progress", function(newProgress) {
    $progress.attr('value', newProgress);
    render();
  });

  cloud.observe("done", function() {
    $progress.remove();
    $editBtn.show();
    Object.keys(cloud.words).forEach(function(word) {
      included.prepend(word);
    });
    render();
  });

  cloud.observe("inclusionchange", function(includedWords, excludedWords) {
    render();

    included.deleteAll();
    excluded.deleteAll();

    Object.keys(includedWords).forEach(function(word) { 
      included.prepend(word); 
    });

    Object.keys(excludedWords).forEach(function(word) { 
      excluded.prepend(word); 
    });
  });

  included.observe("delete", function(word) { excluded.prepend(word); });
  excluded.observe("delete", function(word) { included.prepend(word); });

  $editBtn.click(function() { 
    $editor.slideDown(500); 
  });

  $applyBtn.click(function() {
    cloud.setExcludedWords(excluded.getAll()); 
    $editor.slideUp(); 
  });

  var resizeTimer;
  $window.resize(function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 100);
  });

  $('html').click(function(e) {
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

        //manage classes. can't use $target.addClass()
        //because .className works differently in SVG
        $container.find('.active').removeAttr('class')
        $target.attr('class', 'active');
        
        //start the animation
        $container
          .addClass('with-selection');
      }
    }
  }());
};