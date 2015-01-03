export default class SearchMode {
  constructor(cloud) {
    this.cloud = cloud;
  }

  activate() {}
  deactivate() {}
  handleInclusionChange() {}

  handleClick(e, server, $container) {
    if(e.target.tagName.toLowerCase() !== 'text') {  
      window.parent.postMessage({
        call: 'setDocumentListParams',
        args: [{name: 'in document set'}]
      }, server);

      $container
        .removeClass('with-selection')
        .find('.active').attr('class', '');
    }

    else {
      //postMessage first, so overview can start searching.
      var term = e.target.textContent;
      window.parent.postMessage({
        call: 'setDocumentListParams',
        args: [{q: term, name: 'with the word ' +  term}]
      }, server);

      //manage classes. can't use $target.addClass()
      //because .className works differently in SVG
      $container.find('.active').removeAttr('class')
      $(e.target).attr('class', 'active');
      
      //start the animation
      $container.addClass('with-selection');
    }
  }

  getName() {
    return "search-mode"
  }
}