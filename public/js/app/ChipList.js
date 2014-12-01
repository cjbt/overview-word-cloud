import {Observable} from './utils';
import 'lib/selectonic'

//A flight style component; just bound to dom nodes and handling its own events
class ChipList {
  constructor($container, id) {
    this.id = id;
    this.listeners = {};
    this.$container = $('<ul id="chiplist-'+ id + '" class="chipList"></ul>');
    this.$container.appendTo($container);

    this.$container.selectonic({
      multi: true,
      keyboard: true,
      focusBlur: true,
      selectionBlur: true,
      select: function(e, ui) {
        //focusing the new selected elm to allow for consecutive deletes
        ui.items.eq(0).focus();
      }
    })

    this.$container.click((e) => {
      var $target = $(e.target), selected, prevLI;
      if($target.hasClass('delete')) {
        var selected  = this.$container.selectonic("getSelected")
           , prevLI   = selected.eq(0).prev('li')
           , toSelect;

        this.delete($target.parent('li').get(0));
        toSelect  = prevLI.length ? prevLI : this.$container.find('li').eq(0);
        this.$container.selectonic('select', toSelect);
      }
    });

    this.$container.keydown((e) => {
      switch(e.which) {
        case 8: //delete
          e.preventDefault();
          var selected = this.$container.selectonic("getSelected")
            , prevLI   = selected.eq(0).prev('li')
            , toSelect;

          selected.each(function() {
            this.delete(this);
          });

          toSelect = prevLI.length ? prevLI : this.$container.find('li').eq(0);
          this.$container.selectonic('select', toSelect);
          break;

        case 37: //left or right arrows
        case 39: //re throw it, but mapped to up/down
          e.preventDefault();
          e.which += 1;
          $(e.target).trigger(e);
      }
    });    
  }

  delete(item) {
    var $item = $(item)
      , value = $item.text();

    $item.remove();
    this._dispatch("delete", [value]);
    this.$container.selectonic("refresh");
  }

  prepend(value) {
    $('<li class="chip" tabindex="0">' +
        '<span class="word">' + value + '</span>' + 
        '<span class="delete"></span>' + 
      '</li>')
        .prependTo(this.$container);
  }

  //note: deleteAll doesn't dispatch delete events
  deleteAll() {
    this.$container.empty();
    this.$container.selectonic("refresh");
  }

  getAll() {
    return this.$container.find('li').map((i, it) => it.textContent).get();
  }
}

export default Observable(ChipList)