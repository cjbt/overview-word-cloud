import $ from 'lib/jquery'
import oboe from 'lib/oboe-browser'
import Modernizr from 'lib/modernizr.custom'
import Cloud from './OverviewWordCloud'
import CloudLayout from './CloudLayout'
import ChipList from './ChipList'

export default function(paramString, server) {
  var $window    = $(window)
    , $html      = $('html')
    , $container = $('#cloud-container')
    , $progress  = $('progress')
    , $hideBtn   = $('.delete')
    , $hiddenBtn = $('#hidden-btn')
    , $hiddenDiv = $('#hidden-list')
    , wordsSelector = 'text'; 

  //generate our objects and hook up various event listeners
  var cloud  = new Cloud(() => oboe('/generate?' + paramString))
    , layout = new CloudLayout()
    , $hoveredWord;

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
    render();
  });

  cloud.observe("inclusionchange", function(included, excluded) {
    render();

    for(var key in excluded) {
      $hiddenDiv.addClass('hasHidden');
      return;
    }

    //if we're here, we didn't have any excluded words.
    $hiddenDiv.removeClass('hasHidden');
  });

  $hiddenDiv.on("click", "li", function(e) {
    cloud.includeWord(e.target.textContent)
    $(e.target).remove();
  });

  var resizeTimer;
  $window.resize(function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 100);
  });

  $html.on("click", "#cloud-container, .close", (e) => { $hiddenDiv.hide(); });
  $html.click(function(e) { handleClick(e, $container); });

  $html.on("mouseenter mouseleave", wordsSelector, function(e) {
    var $target = $(e.target), offset;

    if(e.type != "mouseleave") {
      offset = $target.offset();
      $hoveredWord = $target;

      $hideBtn.css({
        'top': (offset.top) + 'px',
        'left': (offset.left + $target.width()) + 'px',
        'opacity': 1
      });
    }

    else {
      setTimeout(function() {
        $hideBtn.css('opacity', 0); 
        $hoveredWord = null;
      }, 1000);
    } 
  });

  $hideBtn.on("click", function(e) {
    var text = $hoveredWord.text();
    $hoveredWord.remove();
    $hiddenDiv.find('ul').prepend('<li>' + text + '</li>');
    cloud.excludeWord(text);
  });

  $hiddenBtn.click(function() {
    $hiddenDiv.show();
  });

  var handleClick = (function () {
    //state to track between clicks, stored in a closure.
    var oldMarginTop = 0, oldMarginLeft = 0, oldScaleFactor = 1;

    return function(e) {
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