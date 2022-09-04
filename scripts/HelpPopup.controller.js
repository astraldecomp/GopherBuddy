angular.module('ait.chromeGopher')
  .controller('HelpPopupCtrl', function () {

  var _this = this;

  // Spawn remote help page and close this the mini help popup
  _this.showRemoteHelp = function() {

    chrome.runtime.sendMessage(null, { req: 'showRemoteHelp'}, null, function() {

      chrome.windows.getCurrent(function(window) {
        chrome.windows.remove(window.id);
      });

    });

  };

});
