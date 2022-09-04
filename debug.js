// Developer mode functionality

function help() {

  var helpMessages = [
    'Welcome to the secret help menu',
    'Here are the commands available to you in this console window',
    'help()               : see this menu again',
    'debug.dev()                : enable dev mode',
    'debug.spoof()              : set a dummy device ID locally. You can pass an ID as a parameter, or leave empty for default dummy ID',
    'debug.devstop()            : disable dev mode',
    'debug.alarms()             : print all alarms',
    'vars                 : print all local variables',
    'debug.setLocalVars(object) : save any key-value pairs as local variables and in local storage',
    'debug.clearSync()          : clear the sync storage',
    'debug.printSessions()      : show session information',
    'debug.showNotification()   : show the old notification popup',
    '--------------------------------------------------------------',
    'With developer mode enabled, you will see more options in the popup',
    'You can manage local variables, or set alarms',
    'Have fun!'
  ];

  for (i in helpMessages) {
    console.log(helpMessages[i]);
  }

}

var debug = {
  spoof: function(dummyId) {

    if (!dummyId) {
      var dummyId = '7538e784-763d-4b7c-bb85-cbc2b890e533';
    }

    setLocalVars({
      dummyId: dummyId,
      deviceId: dummyId,
      managedDevice: true
    });
    
    onStartup();

  },
  
  setDeviceVersion: function(version) {
    setLocalVars({
      deviceVersionSpoof: true,
      fakeDeviceVersion: version || '84.0.132.2837'
    });
  
    onStartup();
  },
  
  setAvailableVersion: function(version) {
    setLocalVars({
      availableVersionSpoof: true,
      fakeAvailableVersion: version || '84.2.231.8956'
    });
    onStartup();
  },
  
  showVersions: function() {
    console.log(vars.deviceVersionSpoof ? 'device version spoofed ' + vars.fakeDeviceVersion : 'device version retrieved: ' + vars.verboseDeviceVersion);
    console.log(vars.availableVersionSpoof ? 'available version spoofed ' + vars.fakeAvailableVersion : 'available version not spoofed: ' + vars.verboseAvailableVersion);
  },
  
  endSpoof: function() {
    setLocalVars({
      dummyId: null,
      deviceId: null,
      managedDevice: null,
      deviceVersionSpoof: null,
      availableVersionSpoof: null,
      fakeAvailableVersion: null
    });
  },

  clearStorage: function() {
    chrome.storage.sync.clear();
    chrome.storage.local.clear();
  },

  reset: function() {
    debug.clearStorage();
    debug.killAlarms();
    onStartup();
  },
  
  goOnline: PubSubApp.goOnline,
  
  goOffline: PubSubApp.goOffline,

  dev: function() {

    vars.developer = true;

    Analytics.sendEvent({
      category: 'Developer',
      action: 'Enabled',
      domain: vars.domain,
      licenseTier: vars.licenseTier
    });

    setLocalVars(vars, init);

  },

  devstop: function() {
    delete vars.developer;
    delete vars.dummyId;
    chrome.storage.local.clear(function() {
      setLocalVars(vars);
    });
  },

  alarms: function() {
    chrome.alarms.getAll(function(alarms) {

      var now = new Date().getTime();

      for (var i in alarms) {
        var alarmDelay = ((alarms[i].scheduledTime - now) / 1000);
        var min = Math.floor(alarmDelay / 60);
        var sec = Math.floor(alarmDelay % 60);
        console.log(alarms[i].name.split('|')[1] + ' will fire in ' + min + ' minutes and ' + sec + ' seconds');
      }

    });
  },
  
  killAlarms: function() {
    chrome.alarms.clearAll();
  },

  showNotification: function() {
    showOldVersionPopup();
  }

};
