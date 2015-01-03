export default class EraserMode {
  constructor(cloud, $hiddenWordsButton, $hiddenWordsDiv, $hiddenCounter) {
    this.cloud = cloud;
    this.$hiddenWordsButton = $hiddenWordsButton;
    this.$hiddenWordsDiv = $hiddenWordsDiv;
    this.$hiddenCounter = $hiddenCounter;
    this.hasBeenActivated = false;
  }

  activate() {
    this.$hiddenWordsButton.show();
    this.$hiddenCounter.show();
    
    //show a brief explainer the first time around
    if(this.hasBeenActivated) {

    }

    this.hasBeenActivated = true;
  }

  deactivate() {
    this.$hiddenWordsButton.hide();
    this.$hiddenCounter.hide();
  }

  handleInclusionChange(included, excluded) {
    for(var key in excluded) {
      this.$hiddenWordsDiv.addClass('hasHidden');
      return;
    }

    //if we're here, we didn't have any excluded words.
    this.$hiddenWordsDiv.removeClass('hasHidden');
  }

  handleClick(e, server, $container) {
    if(e.target === this.$hiddenWordsButton.get(0)) {
      this.$hiddenWordsDiv.toggle();
    }

    else if(e.target.tagName.toLowerCase() == 'li' && this.$hiddenWordsDiv.find(e.target).length) {
      this.cloud.includeWord(e.target.textContent);
      $(e.target).remove();
      this.$hiddenCounter.html(parseInt(this.$hiddenCounter.html(), 10) - 1);
    }

    else if(e.target.tagName.toLowerCase() !== 'text') {
      this.$hiddenWordsDiv.hide();
    }

    else {
      var text = e.target.textContent
        , $target = $(e.target)
        , offset = $target.offset();

      $(e.target)
        .animate({
          'font-size': '0px',
          'height': '0px',
          'width': '0px'
        }, 500);

      this.$hiddenWordsDiv.find('ul').prepend('<li>' + text + '</li>');
      this.$hiddenCounter.html(parseInt(this.$hiddenCounter.html(), 10) + 1);
      this.cloud.excludeWord(text);
    }
  }

  getName() {
    return "eraser-mode"
  }
}