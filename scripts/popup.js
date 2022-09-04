
angular.module('ait.chromeGopher')
  .controller('PopupCtrl', function ($q, $scope, $window, $timeout) {

    var _this = this;

    _this.disabled = false;

    _this.vars = {
      checkingDeviceInfoAccess: true,
      cacheIsEmpty: null,
      clearingCache: false
    };

    _this.appConfigVariables = {
      'Check after': appConfig.checkRateInSeconds.basic,
      'Alarm delay': appConfig.checkRateInSeconds.alarmDelay,
      'License Expires After': appConfig.checkRateInSeconds.licenseRefresh
    };
    
    _this.promises = [];
    
    // Analytics.init();
    // Analytics.sendView('/popup');
    init();
  
    function appendArguments(url, argumentsObject) {
      // console.log('appending arguments to '+url);
      url += '?';
      var keys = Object.keys(argumentsObject);
      for (var i = 0; i < keys.length; i++) {
        url += keys[i] + '=' + argumentsObject[keys[i]];
      
        if (i < (keys.length - 1)) {
          url += '&';
        }
      }
      return url;
    }
    
    _this.clearCache = function() {
      _this.vars.clearingCache = true;
      chrome.runtime.sendMessage(null, { req: 'clearCache'}, null, function(resp) {
        _this.vars.clearingCache = false;
        _this.vars.cacheIsEmpty = resp;
        // Refresh is required as change is not picked up by Angular...
        _this.refresh();
    
      });
    };
  
    _this.openDeviceDetails = function () {
    
      try {
      
        var pr = [];
        
        // console.log('openDeviceDetails');
      
        var authPromise = $q.defer();
        pr.push(authPromise.promise);
        
        try {
          chrome.identity.getAuthToken({'interactive': true}, function(rtn) {
            authPromise.resolve(rtn);
            chrome.identity.removeCachedAuthToken({token: rtn});
            // return rtn;
          });
        } catch(e) {
          console.error(e);
          resolve({});
        }
      
        var profilePromise = $q.defer();
        pr.push(profilePromise.promise);
      
        chrome.identity.getProfileUserInfo(function(rtn) {
          profilePromise.resolve(rtn);
        });
      
        var deviceIdPromise = $q.defer();
        pr.push(deviceIdPromise.promise);
      
        try {

          chrome.enterprise.deviceAttributes.getDirectoryDeviceId(function(deviceId) {
            deviceIdPromise.resolve(deviceId);
          });
        
        } catch (e) {
          deviceIdPromise.reject(e.message); // TODO: **PRE_DEPLOY** Enable this line before deployment as per pre-deployment checklist CG-809
          // deviceIdPromise.resolve('01fc7a43-c5b0-4c12-a190-0b846abade56'); // TODO: **PRE_DEPLOY** Comment out or remove this line for deployment CG-809
        }
      
        $q.all(pr).then(function(resp) {
          // console.log('pr.all',resp);
        
          var tok = resp[0];
          var domain = resp[1].email.split('@')[1];
          var user = resp[1].id;
          var deviceId = resp[2];
        
          var baseUrl = appConfig.api.baseUrl + appConfig.api.deviceInfo;
        
          var requestArgs = {
            method: 'deviceInfo',
            apiToken: appConfig.api.token,
            c: deviceId,
            d: domain,
            u: user,
            i: chrome.runtime.id
          };
        
          var requestUrl = appendArguments(baseUrl, requestArgs);
          // console.log(requestUrl);
  
          chrome.runtime.sendMessage({add: true, tok: tok}, function (response) {
            // console.log(requestUrl);
            chrome.tabs.create({url: requestUrl}, function(tab) {});
          });
        
        }, function(rej) {
          console.error('something rejected', rej);
          _this.error = true;
        });
      
      
      } catch (e) {
        console.error(e);
        _this.error = e.message;
      }
    
    };
    
    
    // Retrieve stored version information
    function getVersion() {
      try {

        var items = _this.vars;
        var iconString = appConfig.images.default;

        if (!items.deviceVersion || !items.available || !items.lastChecked) {

          _this.vars.wait = true;

          var deferred = $q.defer();

          chrome.storage.local.get(appConfig.storageKeys, function(items) {

            _.merge(_this.vars, items);

            var domainSettings = items.domainSettings;

            if (!items.deviceVersion || !items.available || !items.lastChecked) {
              // console.log('Missing items');
              _this.vars.wait = true;

              if (items.disabled) {
                iconString = appConfig.images.disabled;
              }
            } else {

              _this.vars.wait = false;

              // If newer version available, show action item
              if (items.deviceVersion && items.available && items.deviceVersion < items.available) {
                var exMajorVersion = parseInt(items.deviceVersion, 10);
                var currMajorVersion = parseInt(items.available, 10);

                if (domainSettings && domainSettings.allowChromeOsUpdateReminders && exMajorVersion < currMajorVersion) {

                  _this.showHelp = help;
                  // Show warning icon
                  iconString = appConfig.images.warning;
                } else if (domainSettings && domainSettings.allowChromeOsUpdateReminders) {
                  _this.checkNow = checkNow;
                }
              } else if (domainSettings && domainSettings.allowChromeOsUpdateReminders) {

                _this.checkNow = checkNow;
                
              }

              if (!items.deviceVersion || !items.available) {
                _this.vars.wait = true;
              }

            }
            setIcon(iconString).then(function() {
              resolveWith(deferred, 'Storage keys retrieved');
            });
          });
        }

        return deferred.promise;

      } catch (e) {
        console.log(e);
        _this.error = true;
      }

    }

    function checkNow() {
      var alarmName = _this.vars.deviceId + '|versionCheck';
      chrome.alarms.create(alarmName, { delayInMinutes: 1});

      delete _this.checkNow;
      delete _this.vars.deviceVersion;

      chrome.storage.local.set({deviceVersion: null});

      _this.vars.wait = true;
      
      chrome.notifications.clear('versionNotice', function(wasCleared) {
        
        if (!wasCleared) {
          // TODO: Add analytics around errors clearing notifications
        }
  
        chrome.notifications.create('versionNotice', appConfig.notices.checkAgain, function() {

          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
          }
          $window.close();
        });
        
      });

    }
    
    function setIcon(iconPath) {
      var deferred = $q.defer();
      chrome.browserAction.setIcon({path: iconPath}, resolveWith(deferred, 'Icon set'));
      return deferred.promise;
    }

    function help() {
      // Spawn help and update pages

      chrome.runtime.sendMessage(null, { req: 'showHelp'}, null, function(resp) {

        console.log('resp', resp);

        // Restore icon to Gopher
        setIcon(appConfig.images.default);

        // Set trigger to refresh version information
        var alarmName = _this.vars.deviceId + '|versionCheck';
        chrome.alarms.create(alarmName, { delayInMinutes: (_this.appConfigVariables['Alarm delay'] / 60) });

        // Refresh is required as change is not picked up by Angular...
        _this.refresh();

      });
      
    }
    
    function checkButtonRender() {

      if (_this.vars.managedDevice === false) {
        _this.vars.checkingDeviceInfoAccess = false;
        return;
      }

      _this.vars.checkingDeviceInfoAccess = true;
      
      chrome.runtime.sendMessage(null, { req: 'checkButtonRender'}, null, function(resp) {

        _this.vars.checkingDeviceInfoAccess = false;

        if (resp.disabled) {
          _this.disabled = true;
        }

        _this.vars.showDeviceInfoButton = resp.acl || false;

        // Refresh is required as change is not picked up by Angular...
        _this.refresh();

      });
      
    }

    function init() {
      _this.promises.push(getVersion());
      checkButtonRender();
    }
    
    $q.all(_this.promises).then(function() {
      // console.log('All '+_this.promises.length + ' promises resolved');
    }).finally(function() {
      // console.log('$q.finally');
    });
    
    function resolveWith(promise, value) {
      $timeout(function() {
        promise.resolve(value);
      });
    }
    
    _this.refresh = function() {
      $scope.$apply();
    };
    
  });

