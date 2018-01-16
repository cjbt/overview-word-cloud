export default class SearchMode {
  constructor(cloud, $container) {
    this.cloud = cloud;
    this.$container = $container;
  }

  handleInclusionChange() {}
  activate() {}

  deactivate() {
    this.$container
        .removeClass('with-selection')
        .find('.active').attr('class', '');
  }

  handleClick(e, origin) {
    if (e.target.tagName.toLowerCase() !== 'text') {  
      window.parent.postMessage({
        call: 'setDocumentListParams',
        args: [{}]
      }, origin);

      this.$container
        .removeClass('with-selection')
        .find('.active').attr('class', '');
    } else {
      //postMessage first, so overview can start searching.
      var term = e.target.textContent;
      window.parent.postMessage({
        call: 'setDocumentListParams',
        args: [{q: term}]
      }, origin);

      //manage classes. can't use $target.addClass()
      //because .className works differently in SVG
      this.$container.find('.active').removeAttr('class')
      e.target.classList.add('active')

      //start the animation
      this.$container.addClass('with-selection');
    }
  }

  getName() {
    return "search-mode"
  }
}
