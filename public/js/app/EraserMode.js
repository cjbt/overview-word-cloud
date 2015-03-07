export default class EraserMode {
  constructor(cloud, $hiddenWordsButton, $hiddenWordsDiv, $hiddenCounter) {
    this.cloud = cloud;
    this.$hiddenWordsButton = $hiddenWordsButton;
    this.$hiddenWordsDiv = $hiddenWordsDiv;
    this.$hiddenCounter = $hiddenCounter;
  }

  activate() {
    this.$hiddenWordsButton.show();
    this.$hiddenCounter.show();
  }

  deactivate() {
    this.$hiddenWordsButton.hide();
    this.$hiddenCounter.hide();
  }

  handleInclusionChange(included, excluded, excludedArr) {
    var excludedListHTML = excludedArr.reduce(function(prev, word) {
      return '<li>' + word + '</li>' + prev;
    }, "");
    this.$hiddenWordsDiv[excludedArr.length ? "addClass" : "removeClass"]('hasHidden');
    this.$hiddenCounter.html(excludedArr.length);
    this.$hiddenWordsDiv.find('ul').html(excludedListHTML);
  }

  handleClick(e, server, $container) {
    if(e.target === this.$hiddenWordsButton.get(0)) {
      this.$hiddenWordsDiv.toggle();
    }

    else if(e.target.tagName.toLowerCase() == 'li' && this.$hiddenWordsDiv.find(e.target).length) {
      this.cloud.includeWord(e.target.textContent);
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

      this.cloud.excludeWord(text);
    }
  }

  getName() {
    return "eraser-mode"
  }
}