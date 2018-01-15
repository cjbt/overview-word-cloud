const jQuery = require('./vendor/jquery')
const escapeHtml = require('escape-html')

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

  handleInclusionChange(excludedArr) {
    const excludedListHtml = excludedArr
      .map(word => `<li>${escapeHtml(word)}</li>`)
      .join('')
    this.$hiddenWordsDiv[excludedArr.length ? "addClass" : "removeClass"]('hasHidden');
    this.$hiddenCounter.html(excludedArr.length);
    this.$hiddenWordsDiv.find('ul').html(excludedListHtml);
  }

  handleClick(e, origin, $container) {
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
      const text = e.target.textContent
      const $target = jQuery(e.target)

      $target
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
