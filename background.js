var localStorageKeys = appConfig.storageKeys;

var vars = {
  domainSettings: {
    allowChromeOsUpdateReminders: true,
    popupThreshold: 2,
    restrictChromeOsVersionUpdates: false
  }
};

var requestAuth = {};

// Add installation listener
chrome.runtime.onInstalled.addListener(function () {

  Analytics.sendEvent({ category: 'Extension', action: 'Installed', label: appConfig.analytics.version });

  onStartup();

});

// https://developer.chrome.com/extensions/runtime#event-onStartup
chrome.runtime.onStartup.addListener(function () {

  if (appConfig.trackAnalytics) {
    Analytics.sendEvent({ category: 'Extension', action: 'Startup', label: appConfig.analytics.version });
  }

  onStartup();

});

function onStartup() {
  console.log('onStartup');
  init(function() {
    getChromeOsVersion().then(versionCheck).catch(function(err) {
      console.warn('failed to get chrome OS version', err);
    });
  });
}

// Listen for alarm and handle version checking
chrome.alarms.onAlarm.addListener(function (alarm) {

  if (appConfig.debugAnalytics) {
    var now = new Date();
    var latencyInMs = now.getTime() - new Date(alarm.scheduledTime).getTime();
    Analytics.sendEvent({ category: 'DEBUG', action: 'Alarm Listener Called', label: alarm.name.split('|')[1] + ' ' + latencyInMs + ' ms', value: latencyInMs });
  }

  chrome.alarms.clear(alarm.name, function () {

    var name = alarm.name.split('|');
    var type = name[1];

    if (appConfig.debugConsole) {
      console.log('onAlarm', type, new Date().toLocaleTimeString('en-US'));
    }

    switch (type) {
      case 'versionCheck': {
        versionCheckOnAlarm(alarm);
        break;
      }

      case 'logActivity': {
        logActivityOnAlarm(alarm);
        break;
      }

      case 'checkForDisabled': {
        checkForDisabled();
        break;
      }
    }

  });

});


function versionCheck() {

  init(function () {

    getDeviceId(function (deviceId) {
      
      if (deviceId) {
  
        Analytics.init();

        setLocalVars({ deviceId: deviceId, managedDevice: true });
        
        if (window.navigator.onLine) {
        
          getUserProfile(deviceId, function (userInfo) {

          setLocalVars({ domain: parseDomainFromUserInfo(userInfo), userId: userInfo.id, userEmail: userInfo.email });

          if (!vars.licenseTier || !vars.licenseTimestamp || (new Date().getTime() - parseInt(vars.licenseTimestamp, 10) > appConfig.checkRateInSeconds.licenseRefresh * 1000)) {

            getLicenseTier({ userInfo: userInfo, deviceId: vars.deviceId }, function (resp) {
              
              switch (resp.tier) {

                case 'premium':
                  performPremiumTierFlow();
                  break;

                case 'basic':
                default:
                  performBasicTierFlow();
                  break;

              }

            }, function () {

              // console.log('Failure callback on getLicenseTier');
              killSwitchCallback();

            });

          } else {

            switch (vars.licenseTier) {

              case 'premium':
                PubSubApp.validateIntervalFunction(vars.pingInterval);
                performPremiumTierFlow();
                break;

              case 'basic':
              default:
                performBasicTierFlow();
                break;

            }

          }

        });
        }

      } else {

        console.log('Not a managed device. Ending...');
        triggerDisabledMode();

        if (appConfig.trackAnalytics) {

          Analytics.sendEvent({
            category: 'Extension',
            action: 'Unmanaged device detected',
            licenseTier: vars.licenseTier,
            previousVersion: vars.deviceVersion,
            newVersion: vars.available
          });

        }

      }

    });

  });
}

function performPremiumTierFlow() {
  
  var options = {
    requestArgs: {
      apiToken: appConfig.api.token,
      deviceId: vars.deviceId,
      userId: vars.userId,
      userDomain: vars.domain,
      extensionVersion: appConfig.analytics.version,
      license: vars.licenseTier
    }
  };

  getLatestVersion(options, compareVersion, killSwitchCallback);

  createAlarm(vars.deviceId, 'versionCheck');
  createAlarm(vars.deviceId, 'logActivity');
}

function performBasicTierFlow() {
  return killSwitchCallback();
}

function logActivityOnAlarm(alarm) {

  // Initialize local variables
  init(function () {

    // Check that alarm belongs to this device
    if (!isManaged()) {

      console.log('Not a managed device. Re-scheduling.');

      var alarmArray = alarm.name.split('|');
      createAlarm(alarmArray[0], alarmArray[1]);

    } else {

      var name = alarm.name.split('|');
      var id = name[0];

      if (id === vars.deviceId) {
        // console.log('Alarm for this device');
        if (vars.licenseTier === 'premium') {
          PubSubApp.validateIntervalFunction(vars.pingInterval);
          var delayInMinutes = appConfig.checkRateInSeconds.alarmDelay / 60;
          chrome.alarms.create(alarm.name, { delayInMinutes: delayInMinutes });
        }
      } else {

        // Alarm is related to a different device and so 'snooze' this alarm...
        var delayInMinutes = appConfig.checkRateInSeconds.activity / 60;
        chrome.alarms.create(alarm.name, { delayInMinutes: delayInMinutes });

      }

    }

  });

}

function versionCheckOnAlarm(alarm) {

  init(function () {
    if (!isManaged()) {
      console.log('Not a managed device. Re-scheduling.');
      var alarmArray = alarm.name.split('|');
      createAlarm(alarmArray[0], alarmArray[1]);
    } else {

      if (vars.dummyId) {
        // Spoofed device ID
        vars.deviceId = vars.dummyId;
      }

      if (!vars.licenseTier) {
        versionCheck();
      } else {

        var name = alarm.name.split('|');
        var id = name[0];
        var type = name[1];

        if (id === vars.deviceId) {

          if (type === 'versionCheck') {
            versionCheck();
          }

        } else {
          // console.log('Alarm for different device: id '+id);
          var delayInMinutes = appConfig.checkRateInSeconds[vars.licenseTier] / 60;
          chrome.alarms.create(alarm.name, { delayInMinutes: delayInMinutes });
        }

      }

    }
  });
}

function getDeviceId(callback) {

  return chrome.storage.local.get('deviceId', function (store) {

    if (store && store.deviceId && store.deviceId !== 'Unknown device ID') {
      // console.log(store.deviceId);
      if (callback) {
        callback(store.deviceId);
      }
    } else {

      if (chrome.enterprise) {

        chrome.enterprise.deviceAttributes.getDirectoryDeviceId(function (deviceId) {

          // DeviceId retrieved from chrome.enterprise.deviceAttributes
          setLocalVars({ deviceId: deviceId, managedDevice: true });

          if (callback) {
            callback(deviceId);
          }

        });

      } else if (vars.dummyId) {

        // Spoofed Device ID
        setLocalVars({ deviceId: vars.dummyId, managedDevice: true });
        if (callback) {
          callback(vars.dummyId);
        }

      } else {

        // No Device ID
        setLocalVars({ managedDevice: false });
        if (callback) {
          callback(false);
        } else {
          return false;
        }
      }

    }

  });

}

/**
 * Initializes the global vars from local storage
 *
 * @param {function} callback The callback function to execute
 */

function init(callback) {
  
  chrome.storage.local.get(localStorageKeys, async function (items) {
    setLocalVars(items);
    if (vars.licenseTier === 'premium' && vars.managedDevice) {
      PubSubApp.validateIntervalFunction(vars.pingInterval);
    }
    
    if (callback) {
      callback();
    }

  });

}

function createAlarm(deviceId, alarmType) {

  var when;

  if (!vars.licenseTier) {
    // delay = appConfig.checkRateInSeconds.basic * 1000;
    return versionCheck();
  } else if (alarmType && alarmType === 'logActivity') {
  
      var alarmName = vars.deviceId;
  
      if (alarmType) {
        alarmName += '|' + alarmType;
      } else {
        alarmName += '|versionCheck';
      }
  
      when = SessionApp.getChunkedTimeStamp({ which: 'ceil' });
  
      chrome.alarms.create(alarmName, {
        when: when
      });
      
  } else {

    // var delay = (appConfig.checkRateInSeconds[vars.licenseTier] * 1000); // TODO: DEV
    var delay = (appConfig.checkRateInSeconds[vars.licenseTier] * 1000) + (Math.round(Math.random() * 60, 0) * 1000); // TODO: PRODUCTION
    when = new Date().getTime() + delay;

    var alarmName = deviceId;

    if (alarmType) {
      alarmName += '|' + alarmType;
    } else {
      alarmName += '|versionCheck';
    }

    chrome.alarms.create(alarmName, {
      when: when
    });
  }

}

function isManaged() {
  if (vars.deviceId || chrome.enterprise || vars.dummyId) {
    setLocalVars({
      managedDevice: true
    });
    vars.managedDevice = true;
  } else {
    setLocalVars({
      managedDevice: false
    });
    vars.managedDevice = false;
  }
  return vars.managedDevice;
}

/**
 * Stores the variables in the global vars and updates chrome local storage
 *
 * @param {Object} variableObject The variables object to be set
 * @param {Function} callback Optional - the callback function to be executed. Useful for threading together function calls that may fail from latency issues.
 */
function  setLocalVars(variableObject, callback) {

  vars = Object.assign(vars, variableObject);

  if (callback) {
    chrome.storage.local.set(vars, function() {
      callback(variableObject);
    });
  } else {
    chrome.storage.local.set(vars);
  }

}

/**
 * After successfully determining that the device is a managed Chromebook, get user profile info for license tier request
 *
 * @param {String} deviceId The current device ID
 */

function getUserProfile(deviceId, callback) {
  // Get user identity and call getLicenseTier to determine authorization level
  if (callback) {
    chrome.identity.getProfileUserInfo(callback);
  } else {
    chrome.identity.getProfileUserInfo(function (userInfo) {
      getLicenseTier({ userInfo: userInfo, deviceId: deviceId }, getLatestVersion, killSwitchCallback);
    });
  }

}

/**
 * Request the license tier from the API
 *
 * @param {Object} argumentsObj The object that specifies the arguments to be sent to the API
 * @param {Function} successCallback The callback function to be invoked with the API response
 * @param {Function} failureCallback The callback function to be invoked with a failed response from the API
 */

function getLicenseTier(argumentsObj, successCallback, failureCallback) {

  var userInfo = argumentsObj.userInfo;
  var deviceId = argumentsObj.deviceId;
  var domain = parseDomainFromUserInfo(userInfo);

  let toStore = {
    domain: domain,
    userId: userInfo.id,
    userEmail: userInfo.email
  };
  
  if (deviceId) {
    toStore.deviceId = deviceId;
  }
  
  setLocalVars(toStore);

  var req = new XMLHttpRequest();

  var baseUrl = appConfig.api.baseUrl + appConfig.api.version + appConfig.api.getCustomerTier;

  var requestArgs = {
    apiToken: appConfig.api.token,
    deviceId: deviceId,
    userId: userInfo.id,
    userDomain: domain,
    extensionVersion: appConfig.analytics.version
  };

  var requestUrl = appendArguments(baseUrl, requestArgs);

  req.open('GET', requestUrl, true);

  req.onerror = function (err) {

    if (failureCallback) {
      return failureCallback();
    } else {
      return killSwitchCallback();
    }

  };

  req.onload = function () {
    try {
      
      var responseCode = this.status;

      if (responseCode == 501) {

        if (appConfig.debugAnalytics) {
          Analytics.sendEvent({ category: 'Gopher Buddy API', action: appConfig.api.getCustomerTier + ' onRequestError', label: '501 Bad Gateway', value: 501, domain: vars.domain, licenseTier: vars.licenseTier });
        }
        createAlarm(vars.deviceId, 'versionCheck');

      } else if (responseCode === 200 || responseCode === 304) {

        var responseObject = JSON.parse(this.response);
        
        setLocalVars({
          licenseTier: responseObject.tier,
          licenseTimestamp: new Date().getTime()
        });
        
        PubSubApp.checkForUpdatedParameters(responseObject);

        return successCallback({
          requestArgs: requestArgs,
          tier: responseObject.tier
        }, compareVersion, killSwitchCallback);

      } else if (responseCode === 410) {

        var responseObject = JSON.parse(this.response);

        // Domain is not authorized to call the service
        // console.log(this.responseText);

        if (appConfig.debugAnalytics) {
          Analytics.sendEvent({
            category: 'Gopher Buddy API',
            action: appConfig.api.getCustomerTier,
            value: 410,
            label: '410 ' + JSON.stringify(responseObject),
            domain: vars.domain,
            licenseTier: vars.licenseTier
          });
        }

        if (failureCallback) {
          return failureCallback();
        } else {
          return killSwitchCallback();
        }

      } else if (responseCode == 401) {

        var responseObject = JSON.parse(this.response);

        // Domain is not licensed
        // console.log('401: Unauthorized');
        if (appConfig.debugAnalytics) {
          Analytics.sendEvent({
            category: 'Gopher Buddy API',
            action: appConfig.api.getCustomerTier,
            value: 401,
            label: '401 ' + JSON.stringify(responseObject),
            domain: vars.domain,
            licenseTier: vars.licenseTier
          });
        }

        if (failureCallback) {
          return failureCallback();
        } else {
          return killSwitchCallback();
        }
      }

    } catch (e) {
      console.warn(e.message);
      createAlarm(vars.deviceId, 'versionCheck');
    }
  };

  try {
    req.send();
  } catch (e) {
    if (appConfig.debugConsole) {
      console.error(e);
    }
    if (failureCallback) {
      return failureCallback();
    } else {
      return killSwitchCallback();
    }

  }

}

/**
 * Returns the user's domain.
 *
 * @param {Object} userInfoObject The user info object, returned by chrome APIs
 * @returns {String} The user's domain
 */

function parseDomainFromUserInfo(userInfoObject) {
  return userInfoObject.email.split('@')[1];
}


/**
 * Appends arguments to a URL GET request
 *
 * @param {String} url The raw URL of the GET request
 * @param {Object} argumentsObject An argument of key-value pairs of arguments to be appended to the request URL
 * @returns {string} URL The URL of the GET request, with arguments appended
 */

function appendArguments(url, argumentsObject) {
  // console.log('appending arguments to '+url);
  url += '?';
  var keys = Object.keys(argumentsObject);
  var hashFields = !argumentsObject.plainText;
  var fieldsToHash = [
    'ipAddress',
    'userEmail',
    'privateIp',
    'publicIp'
  ];
  for (var i = 0; i < keys.length; i++) {
    if (hashFields && fieldsToHash.indexOf(keys[i]) > -1) {
      var hashedValue = hashArgument(argumentsObject[keys[i]]);
      url += keys[i] + '=' + hashedValue;
      // console.log(keys[i] +' : '+ hashedValue);
    } else {
      url += keys[i] + '=' + argumentsObject[keys[i]];
      // console.log(keys[i] + ' : ' + argumentsObject[keys[i]]);
    }
    if (i < (keys.length - 1)) {
      url += '&';
    }
  }
  // console.log('url is ' + url);
  return url;
}

/**
 * Hash API request arguments to obfuscate PII in public requests
 *
 * @param {String} str The argument value
 * @returns {string} The request argument, hashed
 */

function hashArgument(str) {
  return str; // TODO: Remove this function entirely
  if (str === undefined || str === null) {
    str = 'wnown';
  }

  var key = appConfig.api.hashKey;
  var s = [], j = 0, x, res = '';
  for (var i = 0; i < 256; i++) {
    s[i] = i;
  }
  for (i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    x = s[i];
    s[i] = s[j];
    s[j] = x;
  }
  i = 0;
  j = 0;
  for (var y = 0; y < str.length; y++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    x = s[i];
    s[i] = s[j];
    s[j] = x;
    res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
  }
  return res;
  // return encodeURIComponent(res);
}

function getDeviceInfoRenderPermission(params) {

  var deferred = Q.defer();

  chrome.storage.local.get(['acl'], function (result) {

    var acl = result.acl;

    if (acl && (new Date().getTime() - acl.timestamp) < (appConfig.syncCachePersistSeconds * 1000)) {
      return deferred.resolve({ acl: acl.access });
    }

    chrome.identity.getProfileUserInfo(function (userInfo) {

      var req = new XMLHttpRequest();

      var baseUrl = appConfig.api.baseUrl + appConfig.api.version + appConfig.api.deviceInfoPermission;

      var requestArgs = {
        apiToken: appConfig.api.token,
        userEmail: userInfo.email,
        domain: userInfo.email.split('@')[1],
        plainText: true
      };

      var requestUrl = appendArguments(baseUrl, requestArgs);

      req.open('GET', requestUrl, true);

      req.onerror = function (err) {
        console.error(err);
        deferred.resolve({ error: err });
      };

      req.onload = function () {

        var responseCode = this.status;

        switch (responseCode) {

          case 200:
          case 304:

            var result = (this.response === 'basic' || this.response === 'full');
            chrome.storage.local.set({ acl: { access: result, timestamp: new Date().getTime() } }, function (res) { });

            deferred.resolve({ acl: result });
            break;

          case 403:

            var json = JSON.parse(this.response);

            if (json.disabled) {
              deferred.resolve({ disabled: json.disabled, message: json.message });
            } else {
              deferred.resolve({ acl: false });
            }

            break;

          default:
            deferred.reject();
            break;
        }
      };

      req.send();

    });

  });

  return deferred.promise;

}

function hashSessionObject(sessionArray) {
  var sessionHashedFields = ['publicIp', 'privateIp'];
  _.forEach(sessionArray, function (session) {
    _.forEach(sessionHashedFields, function (field) {
      if (_.has(session, field)) {
        session[field] = hashArgument(session[field]);
      } else {
        session[field] = hashArgument('Unknown');
      }
    });
  });
  return sessionArray;
}

function onRequestError(requestType, label) {
  if (appConfig.debugAnalytics) {
    Analytics.sendEvent({ category: 'Error', action: requestType + ' onRequestError', label: label, domain: vars.domain, licenseTier: vars.licenseTier });
  }
  createAlarm(vars.deviceId, requestType);
}

/**
 * Requests the latest available version for the current device from the API
 *
 * @param {Object} params The parameters object, including a requestArguments property
 * @param {Function} successCallback The callback function to be invoked with a successful response from the API
 * @param {Function} failureCallback The callback function to be invoked with a failed response from the API
 */

function getLatestVersion(params, successCallback, failureCallback) {
  
  var req = new XMLHttpRequest();

  req.onerror = function (err) {
    console.log('onerror versionCheck', err);
    // onRequestError('versionCheck', JSON.stringify(err));
  };

  var baseUrl = appConfig.api.baseUrl + appConfig.api.version + appConfig.api.deviceLookup;

  var requestContent = extractPostBody(params.requestArgs);

  req.open('POST', baseUrl + requestContent.urlArguments, true);
  req.setRequestHeader('Content-Type', 'application/json');
  req.send(requestContent.payload);

  req.onload = function () {

    var responseCode = this.status;
    
    switch (responseCode) {

      case 200:
      case 304:

        var responseObject = JSON.parse(this.response);
        
        PubSubApp.checkForUpdatedParameters(responseObject);
        
        if (responseObject.settings) {
          setLocalVars({domainSettings: responseObject.settings});
        }

        if (params.requestType && params.requestType === 'POST') {

          if (appConfig.trackAnalytics) {
            Analytics.sendEvent({ category: 'Gopher Buddy API', action: appConfig.api.deviceLookup, value: responseCode, label: responseCode + ' ' + JSON.stringify(responseObject), domain: vars.domain, licenseTier: vars.licenseTier });
          }
        }

        if (responseObject.isCustomer && responseObject.domainIsAuthed) {
          setLocalVars({verboseAvailableVersion: responseObject.latestOsVersion});
          if (vars.availableVersionSpoof) {
            console.log('spoofed latest available version to ' + vars.fakeAvailableVersion);
            return successCallback({ latestOs: vars.fakeAvailableVersion});
          }
          return successCallback({ latestOs: responseObject.latestOsVersion });
        }

        break;

      case 410: // Domain is not authorized to call the service

        console.error('410: Resource Gone');

        if (appConfig.debugAnalytics) {
          Analytics.sendEvent({ category: 'Gopher Buddy API', action: appConfig.api.deviceLookup, value: 410, label: '410 ' + JSON.stringify(responseObject), domain: vars.domain, licenseTier: vars.licenseTier });
        }

        if (failureCallback) {
          return failureCallback();
        } else {
          return killSwitchCallback();
        }

        break;

      case 401: // Domain is not licensed

        console.error('401: Unauthorized');

        if (appConfig.debugAnalytics) {
          Analytics.sendEvent({ category: 'Gopher Buddy API', action: appConfig.api.deviceLookup, label: '401 ' + JSON.stringify(responseObject), domain: vars.domain, licenseTier: vars.licenseTier });
        }

        if (responseObject.domainIsAuthed) {
          console.warn('domainIsAuthed, but 401');
          return createAlarm(vars.deviceId, 'versionCheck');
        } else if (failureCallback) {
          return failureCallback();
        } else {
          return killSwitchCallback();
        }

        break;

      default:

        return createAlarm(vars.deviceId, 'versionCheck');
        break;

    }

  };

}

/**
 * Extracts the POST body and url parameters for API POST requests
 *
 * @param {object} requestArguments The object of request arguments to be packaged
 * @returns {{urlArguments: string, payload: FormData}}
 */

function extractPostBody(requestArguments) {

  var payload = {
    userEmail: hashArgument(vars.userEmail),
    apiToken: requestArguments.apiToken
  };

  if (requestArguments.sessions) {
    payload.sessions = hashSessionObject(requestArguments.sessions);
  }

  if (requestArguments.active) {
    payload.active = hashSessionObject(requestArguments.active);
  }

  var pickedProperties = _.pick(requestArguments, ['apiToken', 'userDomain', 'deviceId', 'userId']);
  var urlArguments = appendArguments('', pickedProperties);

  return {
    urlArguments: urlArguments,
    payload: JSON.stringify(payload)
  };
}

/**
 * Handle API responses with killswitch behaviour
 */

function killSwitchCallback() {

  chrome.alarms.getAll(function (alarms) {

    if (appConfig.debugAnalytics) {
      Analytics.sendEvent({ category: 'Extension', action: 'Killswitch', label: vars.deviceId + ' >> ' + alarms.length, domain: vars.domain, licenseTier: vars.licenseTier, deviceId: vars.deviceId });
    }

    for (i in alarms) {
      var name = alarms[i].name;
      var id = name.split('|')[0];
      if (id === vars.deviceId) {
        chrome.alarms.clear(name);
      }
    }
  });
  
  PubSubApp.clearIntervalFunction();
}

/**
 * Compares the version and modifies UI
 *
 * @param {Object} params A parameters object
 * @param {String} params.latestOs The string of the verbose version
 */

function compareVersion(params) {

  var now = new Date();
  var localVersionIsUpToDate = true;
  var latestAvailableVersion;
  var latestAvailableMinorVersion;

  if (vars.lastChecked) {
    if ((vars.lastChecked.epoch + (appConfig.checkRateInSeconds[vars.licenseTier] * 1000)) < now.getTime()) {
      localVersionIsUpToDate = false;
    }
  }

  var lastChecked = {
    date: now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    epoch: now.getTime()
  };
  
  if (params.latestOs !== 'Unknown') {
    // Parse out major version information and compare
    var osSplit = params.latestOs.toString().split('.');
    latestAvailableVersion = parseInt(osSplit[0], 10); // The latest available OS major version
    latestAvailableMinorVersion = parseInt(osSplit[1], 10); // The latest available OS minor version
    if (vars.domainSettings.restrictChromeOsVersionUpdates && _.has(vars.domainSettings, 'chromeOsVersionMax')) {
      // If configured to a max available version, set it here
      latestAvailableVersion = Math.min(latestAvailableVersion, vars.domainSettings.chromeOsVersionMax); // Domain has major version cap set. Use the min of the two
    }
    
    if (vars.domainSettings.restrictChromeOsMinorVersion && _.has(vars.domainSettings, 'chromeOsMinorVersionMax')) {
      latestAvailableMinorVersion = Math.min(latestAvailableMinorVersion, vars.domainSettings.chromeOsMinorVersionMax); // Domain has a minor version cap set. Use the min of the two.
    }
    
    // Store latest available version in local storage
    setLocalVars({
      available: latestAvailableVersion,
      lastChecked: lastChecked
    });
  } else {
    // Store latest available version in local storage
    setLocalVars({
      available: 'Unknown',
      lastChecked: lastChecked
    });
  }
  
  // Check if we need to evaluate version and nudge user
  if (vars.deviceVersion && localVersionIsUpToDate && vars.domainSettings.allowChromeOsUpdateReminders) {
    
    // Check major version for difference between what's on the device and what's the latest available version for the device
    // At this point, latest available will reflect the max between what OS has been published and if the domain is configured with a major version cap
    if ((latestAvailableVersion - vars.deviceVersion) > 0 && // The device version is behind the latest available version by some amount
        (vars.domainSettings.popupThreshold && // There is a requirement to notify on one or more major versions versions behind
        (latestAvailableVersion - vars.deviceVersion) >= vars.domainSettings.popupThreshold)) // The device version exceeds the notification threshold
    {
      console.log('major version is behind - checking cap');
        showOldVersionPopup();
    }
    // Check minor version
    else if ((vars.deviceVersion === latestAvailableVersion) && vars.domainSettings.minorVersionThreshold) {
      // Major version already matches the latest available, and there is a defined minor version threshold to check against
      
      // Determine device minor version
      var deviceMinorVersion = parseInt(vars.verboseDeviceVersion.split('.')[1], 10);
      
      // At this point, latest available minor version reflects the minimum of the available minor version and the capped minor version, if set.
      if (latestAvailableMinorVersion - deviceMinorVersion >= vars.domainSettings.minorVersionThreshold) {
        // Minor version exceeds threshold, show popup
          showOldVersionPopup();
        }
      }
    // Everything looks good, set to default UI
    else {
      // Restore icon to Gopher
      chrome.browserAction.setIcon({path: appConfig.images.default});
    }
  } else if (!vars.deviceVersion || !localVersionIsUpToDate) {
    // Try to refresh version information
    getChromeOsVersion();
  }

}

/**
 * Check lastUpdateNotification epoch time and if `appConfig.popupAfterSeconds` seconds have passed then show the update notification popup.
 */

function showOldVersionPopup() {

  try {

    // Check last notify time and ensure > 24 hrs before showing notification

    chrome.storage.local.get(['lastUpdateNotification'], function (data) {

      var now = new Date();
      var nowEpoch = now.getTime();

      if ((data.lastUpdateNotification + (appConfig.popupAfterSeconds * 1000)) > nowEpoch) {

        // We should not display the notification popup until `appConfig.popupAfterSeconds` seconds after last notification. So ignore this function call...

        return;
      }

      if (vars.domainSettings.allowChromeOsUpdateReminders) {

        chrome.browserAction.setIcon({ path: appConfig.images.warning });

        Analytics.sendEvent({ category: 'Notification', action: 'Show', previousVersion: vars.deviceVersion, newVersion: vars.available, domain: vars.domain, licenseTier: vars.licenseTier });

        // Notify user that an update is available, using the configured notice parameters
        chrome.notifications.clear('versionNotice', function (wasCleared) {

          if (!wasCleared) {
            // TODO: Add analytics around notifications that did not clear
          }

          chrome.notifications.create('versionNotice', appConfig.notices.outOfDate, function (notificationId) {

            chrome.storage.local.set({ lastUpdateNotification: now.getTime() }, function (res) { });
            // console.log('notification created: ' + notificationId);

          });

        });

        // Add button click listener to the notification
        chrome.notifications.onButtonClicked.addListener(buttonClick);

      } else {

        Analytics.sendEvent({ category: 'Notification', action: 'Prevented', label: 'Version pop-up notice blocked due to domain settings', previousVersion: vars.deviceVersion, newVersion: vars.available, domain: vars.domain, licenseTier: vars.licenseTier });

      }

    });

  } catch (e) {
    console.error(e);
  }
}

function changeIconForUpdate() {

  if (vars.domainSettings.allowChromeOsUpdateReminders) {
    chrome.browserAction.setIcon({ path: appConfig.images.warning });
  }
}

/**
 * Check version info contained in user agent string, and compare with latest version info available
 *
 * @param {object} info
 */

function getChromeOsVersion() {

  var deferred = Q.defer();
  
  const userAgent = navigator.userAgent;

  var verExp = new RegExp('Chrome\/([0-9.]+)');
  var version = verExp.exec(userAgent)[1];
  if (vars.deviceVersionSpoof) {
    console.log('spoofing device version');
    version = vars.fakeDeviceVersion;
  }
  console.log('version', version);
  
  var localMajorVersion = parseInt(version.split('.')[0], 10); // Existing major version ON THE DEVICE

  setLocalVars({ deviceVersion: localMajorVersion, verboseDeviceVersion: version }, function (rtn) {
    deferred.resolve(version);
  });

  return deferred.promise;
}

function updateLastActive() {

  setLocalVars({ lastActive: new Date().getTime() });

  createAlarm(vars.deviceId, 'logActivity');

}

/**
 * Opens chrome help page in new tab, and shows small pop-up window indicating how to check for new version.
 */
function showHelpPage() {

  chrome.browserAction.setIcon({ path: appConfig.images.default });

  chrome.storage.local.get(['domain','deviceId', 'deviceVersion'], function(data) {
    
    // Open relevant help page
    if (data.deviceVersion < 79) {
      // Use older chrome settings interface for pre-78 versions
      chrome.tabs.create({url: 'chrome://settings/help'});
    } else {
      // Redirect to new help tab - this CANNOT be tested on a non-Chrome-OS device
      chrome.windows.create({url: 'chrome://os-settings/help'}, function(tab) {
        chrome.windows.remove(tab.id); // Because help tab open in separate interface, need to remove newly created tab
      });
    }
    var windowWidth = 240;
    var windowHeight = 280;
    
    var helpWindow = {
      url: chrome.extension.getURL('templates/helpPopup.html'),
      type: 'popup',
      width: windowWidth,
      height: windowHeight,
      left: screen.availWidth - windowWidth,
      top: screen.availHeight - windowHeight
    };

    chrome.windows.create(helpWindow);

    delete vars.deviceVersion;
    chrome.storage.local.remove('deviceVersion');

  });

}

function showSyncPage() {

  Analytics.sendEvent({ category: 'Notification', action: 'Actioned', previousVersion: vars.deviceVersion, newVersion: vars.available, domain: vars.domain, licenseTier: vars.licenseTier });
  chrome.tabs.create({ url: 'chrome://policy' });

}

/**
 * Button click listener function. Checks for selected option and takes appropriate action
 *
 * @param {string} notificationId
 * @param {integer} buttonIndex
 */

function buttonClick(notificationId, buttonIndex) {

  // If clicked OK, show help and navigate to update page
  if (buttonIndex === 0) {
    Analytics.sendEvent({ category: 'Notification', action: 'Actioned', previousVersion: vars.deviceVersion, newVersion: vars.available, domain: vars.domain, licenseTier: vars.licenseTier });
    return showHelpPage();
  }
  // If clicked LATER, set alarm to notify again after delay set in appConfig
  else if (buttonIndex === 1) {

    Analytics.sendEvent({ category: 'Notification', action: 'Dismissed', previousVersion: vars.deviceVersion, newVersion: vars.available, domain: vars.domain, licenseTier: vars.licenseTier });

  }

  // Remove notification from the UI
  chrome.notifications.clear('versionNotice', function (wasCleared) {
    if (!wasCleared) {
      console.log('Failed to clear', chrome.runtime.lasterror);
    }
  });

}

function triggerDisabledMode() {

  // Stop all alarms
  chrome.alarms.clearAll();

  // Update UI
  chrome.browserAction.setIcon({ path: appConfig.images.disabled });

  chrome.alarms.create(vars.deviceId + '|checkForDisabled', { delayInMinutes: 60 * 12 });

  chrome.storage.local.set({ disabled: true });
  
  PubSubApp.clearIntervalFunction();

}

/**
 * Method called on alarm to determine whether Gopher Buddy is disabled.
 * - if disabled then alarm created for another check
 * - if not disabled then onStartup() is called to re-initialize the extension
 */

function checkForDisabled() {

  chrome.storage.local.get(['deviceId'], function (data) {

    if (!data.deviceId) {
      triggerDisabledMode();
      return false;
    }

    // Get user identity and call getLicenseTier to determine authorization level
    chrome.identity.getProfileUserInfo(function (userInfo) {

      return getLicenseTier({ userInfo: userInfo, deviceId: data.deviceId }, function (response) {

        if (response.disabled) {
          triggerDisabledMode();
        } else {
          onStartup();
        }

      }, function (err) {

        console.warn(err);
        triggerDisabledMode();

      });

    });

  });

}

chrome.runtime.onMessage.addListener(function (request, sender, respondWith) {

  if (sender.id !== chrome.runtime.id) {
    console.error('sender disallowed');
    return false;
  }

  if (request.req === 'checkButtonRender') {

    getDeviceInfoRenderPermission(request).then(function (resp) {
      
      // console.log('deviceRenderInfoPermission', resp);

      // Check for disabled

      if (resp.disabled) {
        // console.log('disabled');
        // Move to disabled mode
        triggerDisabledMode();

      }

      respondWith(resp);

    }, function (err) {

      console.error(err);

      respondWith(err);

    });

    // Required for async callbacks
    return true;

  } else if (request.req === 'sync') {

    showSyncPage();

  } else if (request.req === 'showHelp') {

    showHelpPage();

  } else if (request.req === 'showRemoteHelp') {

    chrome.storage.local.get(['domain', 'deviceId'], function (data) {

      var requestUrl = appConfig.api.baseUrl + appConfig.api.help;

      var remoteHelpTab = {
        url: appendArguments(requestUrl, {
          method: 'help',
          domain: data.domain,
          uuid: data.deviceId,
          source: 'popup'
        })
      };

      chrome.tabs.create(remoteHelpTab);

    });

  } else if (request.add) {

    addTokenHeaderListener(request);
    respondWith('OK');
    return false;

  } else if (request.remove) {

    removeTokenHeaderListener();
    return false;

  } else if (request.req === 'clearCache') {
    chrome.browsingData.removeCache({}, function() {
      setTimeout(function() {
        respondWith(true);
      }, 250);
    });
    return true;
  }

});

function addTokenHeaderListener(request) {
  requestAuth = request.tok;
  chrome.webRequest.onBeforeSendHeaders.addListener(appendToken, { urls: ['https://gopher-buddy-prod.appspot.com/*', 'https://gopher-buddy-dev.appspot.com/*'] }, ['requestHeaders', 'blocking']);
  chrome.webRequest.onBeforeSendHeaders.addListener(appendToken, { urls: ['https://gopher-buddy-prod.appspot.com/*', 'https://gopher-buddy-dev.appspot.com/*'] }, ['requestHeaders', 'blocking']);
}

function removeTokenHeaderListener() {
  chrome.webRequest.onBeforeSendHeaders.removeListener(appendToken);
  requestAuth = null;
}

chrome.webRequest.onSendHeaders.addListener(function (details) {
  removeTokenHeaderListener();
}, { urls: ['https://gopher-buddy-prod.appspot.com/*', 'https://gopher-buddy-dev.appspot.com/*'] }, ['requestHeaders']);

function appendToken(details) {
  try {
    var blockingResponse = {
      requestHeaders: details.requestHeaders
    };

    // Must match app id from extension that gets built with console. Log in with publishing and visit
    // https://console.developers.google.com/apis/credentials/oauthclient/389868568330-ldu4ni0g8635crtj7mk568iso80jc4mi.apps.googleusercontent.com?project=gopher-buddy-dev&organizationId=1077692058942

    blockingResponse.requestHeaders.push({ name: 'Authorization', value: 'Bearer: ' + requestAuth });
    return blockingResponse;

  } catch (e) {
    console.error(e);
  }
}
