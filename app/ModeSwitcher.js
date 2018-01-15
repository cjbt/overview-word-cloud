export default class ModeSwitcher {
  constructor(modesAndControls) {
    this.modesMap = {};
    this.currentMode = null;
    this.currentModeName = null;

    //populate this.modesMap and set up listeners
    modesAndControls.forEach((it) => {
      //use a let so these are still set properly in the event listeners.
      let modeName = it.mode.getName();
      let control = it.control;

      this.modesMap[modeName] = it;

      control.click(() => this.switchTo(modeName));
      /*control.hover(
        (e) => { this._activateControl(control) },
        (e) => {
          var currControl = this.modesMap[this.currentModeName].control;
          if(currControl.get(0) !== e.target && !currControl.find(e.target).length) {
            this._deActivateControl(control);
          }
        }
      );*/

      if(it["default"]) {
        it.control.click();
      }
    });
  }

  switchTo(newModeName) {
    if(newModeName == this.currentModeName) {
      return;
    }

    if(this.currentMode) { 
      this.currentMode.deactivate();
      this._deActivateControl(this.modesMap[this.currentModeName].control);
    }

    this.currentMode = this.modesMap[newModeName].mode;
    this.currentModeName = newModeName;

    this._activateControl(this.modesMap[this.currentModeName].control);
    this.currentMode.activate();
  }

  _activateControl($control) {
    if(!$control.hasClass('active')) {
      $control.addClass('active')
        //.animate({'width': ($control.find('span').width()+24) + 'px'});
    }
  }

  _deActivateControl($control) {
    if($control.hasClass('active')) {
      $control.removeClass('active')//.animate({"width": "14px"});
    }
  }
}