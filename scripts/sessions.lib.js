/**
 * Created by James on 2017-05-05.
 */
var SessionApp = (function () {
  // TODO: Add analytics to sessions
  // Quotas: https://developer.chrome.com/extensions/storage

  // var activeSessions = {};
  // var closedSessions = [];

  // var TIMEOUT_IN_SECONDS = appConfig.sessionTimeoutInSeconds + 1;
  // var TIMEOUT_FROM_OTHER_DEVICE_IN_SECONDS = appConfig.sessionTimeoutInSecondsFromOtherDevice + 1;

  // TODO: Change default timeout if dev mode
  // TODO: Use two different sync storage buckets for open and closed sessions

  /**
   * Creates a new session object
   *
   * @param {Object} obj The session metadata to save.
   * @param {String} obj.deviceId The active device ID
   * @param {String} obj.privateIp The private IP address of the active device
   * @param {String} [obj.pulicIp] The (optional) public IP address of the active device
   * @returns {Session} Session The newly spawned session
   * @constructor
   */
  // var Session = function(obj) {
  //   this.deviceId = obj.deviceId;
  //   this.privateIp = obj.privateIp;
  //   this.publicIp = obj.publicIp;
  //   this.deviceVersion = obj.deviceVersion;
  //   return this;
  // };

  /**
   * @param {Object} params
   * @param {Number} params.timeStamp The timestamp from which to return the 'bookend'
   * @param {String} params.which whether the floor or ceiling of the time chunk is requested
   * @returns {Number} The epoch timeStamp of the time chunk bookend...
   */

  function getChunkedTimeStamp(params) {
    _.defaults(params, {
      which: "floor",
    });

    var windowSize = appConfig.checkRateInSeconds.activity * 1000;
    var date = params.timeStamp ? new Date(params.timeStamp) : new Date();

    var rounded;

    switch (params.which) {
      case "ceil":
        rounded = new Date(Math.ceil(date.getTime() / windowSize) * windowSize);
        break;

      case "floor":
      default:
        rounded = new Date(
          Math.floor(date.getTime() / windowSize) * windowSize
        );
        break;
    }

    if (appConfig.debugConsole) {
      // console.log(date.toLocaleTimeString("en-US"), params.which + ' timestamp is ' + rounded.toLocaleTimeString("en-US"));
    }

    return rounded.getTime();
  }

  /**
   * Sets the local Session active and closed session variables and returns the activeSessions
   *
   * @returns {Object} The current ActiveSessions from Chrome Sync Storage
   */

  function retrieveSessions() {
    var deferred = Q.defer();

    try {
      chrome.storage.local.get(["data", "closedSessions"], function (items) {
        activeSessions = items.data ? JSON.parse(items.data) : {};
        closedSessions = items.closedSessions
          ? JSON.parse(items.closedSessions)
          : [];
        deferred.resolve(activeSessions);
      });
    } catch (e) {
      deferred.reject(e.message);
    }

    return deferred.promise;
  }

  /*
    This function can be called on a web request listener, and will update session with lastActive timestamp.
   */

  /**
   * Updates the active session with a new lastActive timestamp, and saves to chrome.storage.sync
   *
   * @param {object} params
   * @param {String} params.deviceId The device ID of the active device
   * @param {String} params.userId
   * @param {String} params.privateIp The private IP address of the active device
   * @param {String} params.publicIp The (optional) public IP address of the active device
   * @param {String} params.deviceVersion The full device version string
   * @param {dateTime} scheduledTime
   * @returns {Object} session The session with updated last active
   */
  // async function pingSession(timestamp) {
  //   const res = await getFromStorage_(['data']);
  //   if (res && res.data) {
  //     let activeSession = JSON.parse(res.data);
  //     activeSession.timestamp =
  //     await new Promise((res, rej) => {chrome.storage.local.set({data: JSON.stringify(activeSession)}, res)});
  //     return true;
  //   }
  //   return false;
  // }

  // function inTimeoutWindow(timestamp, compareWith, currentDevice) {
  //
  //   if (currentDevice === undefined) {
  //     currentDevice = true;
  //   }
  //
  //   timestamp = Number(timestamp);
  //
  //   if (isNaN(timestamp)) {
  //     return false;
  //   }
  //
  //   var timeout = (currentDevice) ? TIMEOUT_IN_SECONDS : TIMEOUT_FROM_OTHER_DEVICE_IN_SECONDS;
  //
  //   return (compareWith -  timestamp < (timeout * 1000));
  //
  // }

  // function generateSessionKey(deviceId, userId) {
  //   return deviceId + '|' + userId + '|' + new Date().getTime();
  // }

  /**
   * Iterate through sessions close any open sessions with expired lastActive timestamps. Removes closed sessions from chrome.storage.sync
   *
   * @return {Array} closedSessions An array of sessions closed and ready to send to API.
   */

  // function rollUpSessions() {
  //
  //   var deferred = Q.defer();
  //
  //   // Save any remaining open sessions to sync storage
  //   chrome.storage.sync.set({activeSessions: activeSessions}, function() {
  //
  //     // Update the sessions global
  //     chrome.storage.sync.get('closedSessions', function(items) {
  //       closedSessions = items.closedSessions || [];
  //       deferred.resolve(closedSessions);
  //     });
  //
  //   });
  //
  //   return deferred.promise;
  // }

  // Public Methods
  return {
    getChunkedTimeStamp: getChunkedTimeStamp,

    /**
     * Creates or updates an active session for the current device ID, private IP, and (optional) public IP address.
     *
     * @param {Object} params Function parameters
     * @param {String} params.deviceId The active device ID
     * @param {String} params.userId The active user's ID
     * @param {String} params.privateIp The active device private IP
     * @param {String} params.publicIp The active device public IP
     * @returns {Object} Session the active session.
     */

    // logActivity: function() {
    //   return new Promise((resolve, reject) => {
    //     console.log('logActivity', appConfig.checkRateInSeconds.activity);
    //     chrome.idle.queryState(appConfig.checkRateInSeconds.activity, function(state) {
    //       console.log('state', state);
    //       if (state === 'active') {
    //         pingSession(timestamp).then((res) => {
    //           resolve(res);
    //         });
    //       }
    //     });
    //   });
    // },

    // retrieveActiveSession: async function(deviceId, userId) {
    //   return new Promise((resolve, reject) => {
    //
    //   });
    // },

    // retrieveClosedSessions: async function(deviceId, userId) {
    //   return new Promise((resolve, reject) => {
    //     chrome.storage.local.get(['closedSessions'], function (result) {
    //       console.log('retrieved sessions', result && result.closedSessions ? JSON.parse(result.closedSessions).length : 0);
    //       chrome.storage.local.remove('closedSessions');
    //       resolve(result && result.closedSessions ? JSON.parse(result.closedSessions) : []);
    //     });
    //   });
    // },

    // append endTime, duration, get closed sessions from local storage (check for exist) if exist, parse, append this session, stringify,
    // store else save as arr with 1 el of this session
    // for stale sessions ^ will overwrite
    // closeSession: async function(optSession) {
    //   let resp = await getFromStorage_(['data', 'closedSessions']);
    //   if (resp && !resp.data && !optSession) {
    //     console.log('no session available to close');
    //     return;
    //   }
    //   let session = optSession || JSON.parse(resp.data);
    //   let closedSessions = resp.closedSessions ? JSON.parse(resp.closedSessions) : [];
    //   let endTime = SessionApp.getChunkedTimeStamp({ which: 'ceil' });
    //   let duration = (endTime - session.startTime) / (60 * 1000);
    //   let closed = Object.assign(session, {
    //     endTime: endTime,
    //     duration: duration
    //   });
    //   closedSessions.push(closed);
    //   chrome.storage.local.set({ 'closedSessions': JSON.stringify(closedSessions) });
    //   chrome.storage.local.remove(['data']);
    //   console.log('closed', closed);
    //   // append endTime, duration, get closed sessions from local storage (check for exist) if exist, parse, append this session, stringify,
    //   // store else save as arr with 1 el of this session
    //   // for stale sessions ^ will overwrite
    // },

    // startSession: async function(userInfo, deviceId) {
    //
    //   let data = JSON.stringify({
    //     deviceId: deviceId || vars.deviceId,
    //     domain: vars.domain,
    //     publicIp: vars.publicIp,
    //     privateIp: vars.privateIp,
    //     userId: userInfo.id || vars.userId,
    //     startTime: SessionApp.getChunkedTimeStamp({ which: 'floor' }),
    //     crosVersion: vars.verboseDeviceVersion
    //   });
    //
    //   chrome.storage.local.set({ 'data': data });
    //   console.log('started', data);
    //   return data;
    // },

    /**
     * Checks a session to see if it has been active within the last activity window. If yes, returns true. If no, closes session and returns false;
     * @param session
     * @return {Promise<void>}
     */
    // evaluateUnterminatedSession: function(session) {
    //   const diff = getChunkedTimeStamp({which: 'ceil'}) - getChunkedTimeStamp({timeStamp: session.lastActive, which: 'ceil'});
    //   console.log('evaluateUnterminatedSession', diff);
    //   if (diff < appConfig.checkRateInSeconds.activity * 2) {
    //     console.log('still active');
    //     chrome.storage.local.set({data: JSON.stringify(session)});
    //     return true;
    //   } else {
    //     console.log('closing stale session');
    //     this.closeSession(session);
    //     return false;
    //   }
    // },

    /**
     * Prints the session information to the developer console
     */
    // printSessions: function() {
    //   retrieveSessions().then(function() {
    //
    //     console.log('activeSessions (' + _.keys(activeSessions).length + ')');
    //     if (_.keys(activeSessions).length) {
    //       console.table(activeSessions);
    //     }
    //
    //     console.log('closedSessions (' + closedSessions.length + ')');
    //     if (closedSessions.length) {
    //       console.table(closedSessions);
    //     }
    //
    //   });
    // },

    // clearClosedSessions: function(sessions) {
    //   // console.log('clearing closed sessions');
    //
    //   chrome.storage.sync.get('closedSessions', function(items) {
    //
    //     closedSessions = items.closedSessions || [];
    //
    //     _.each(sessions, function(session) {
    //
    //       var removed = _.remove(closedSessions, function(s) {
    //         return (s.deviceId === session.deviceId && s.startTime === session.startTime && s.lastActive === session.lastActive);
    //       });
    //
    //       if (appConfig.debugConsole) {
    //         // console.log(removed);
    //       }
    //
    //     });
    //
    //     chrome.storage.sync.set({closedSessions: closedSessions}, function() {
    //       delete vars.sentSessions;
    //     });
    //
    //   });
    //
    // },

    /**
     * Gets the private IP address, and passes it as an argument to the specified callback function
     */

    getPrivateIP: function () {
      // console.log('getPrivateIp');
      var deferred = Q.defer();

      var backStop = Q.promise(function (resolve, reject) {
        setTimeout(function () {
          return resolve("unknown");
        }, 15000);
      });

      Q.race([
        backStop,
        (function () {
          var ipPromise = Q.defer();

          var ips = [];

          var RTCPeerConnection =
            window.RTCPeerConnection ||
            window.webkitRTCPeerConnection ||
            window.mozRTCPeerConnection;

          var pc = new RTCPeerConnection({
            // Don't specify any stun/turn servers, otherwise you will
            // also find your public IP addresses.
            iceServers: [],
          });

          // Add a media line, this is needed to activate candidate gathering.
          pc.createDataChannel("");

          // onicecandidate is triggered whenever a candidate has been found.
          pc.onicecandidate = function (e) {
            if (!e.candidate) {
              // Candidate gathering completed.
              pc.close();
              if (!ips.length) return;
              if (appConfig.debugConsole) {
                // console.log('LOCAL IPs : ' + ips.join('|'));
              }
              vars.privateIp = ips.join("|");
              ipPromise.resolve(vars.privateIp);
              return;
            }

            var ip = /^candidate:.+ (\S+) \d+ typ/.exec(
              e.candidate.candidate
            )[1];

            if (ip.indexOf("100.115.92.") === -1 && ips.indexOf(ip) === -1) {
              // avoid duplicate entries (tcp/udp)
              ips.push(ip);
            }
          };

          pc.createOffer(
            function (sdp) {
              pc.setLocalDescription(sdp);
            },
            function onerror(e) {
              console.error(e);
              if (!vars.privateIp) {
                vars.privateIp = "unknown";
              }
              ipPromise.resolve(vars.privateIp);
            }
          );

          return ipPromise.promise;
        })(),
      ]).then(function (result) {
        deferred.resolve(result);
      });

      return deferred.promise;
    },

    /**
     * Gets the public IP address, and passes it as an argument to the specified callback function
     */

    getPublicIP: function () {
      // console.log('getPublicIp');
      var deferred = Q.defer();

      // We know with certainty that this is an offline session if the navigator is not online.
      if (!window.navigator.onLine) {
        deferred.resolve("offline");
      } else {
        var backStop = Q.promise(function (resolve, reject) {
          setTimeout(function () {
            return resolve("unknown"); // If not able to detect public IP within 15 seconds, report as unkown.
          }, 15000);
        });
        Q.race([
          backStop,
          (function () {
            var ipPromise = Q.defer();

            // Only gets public IP, not private
            var req = new XMLHttpRequest();

            var ipRequestUrl =
              appConfig.api.baseUrl +
              appConfig.api.version +
              appConfig.api.publicIp;

            var requestUrl =
              ipRequestUrl +
              "?apiToken=" +
              appConfig.api.token +
              "&d=" +
              vars.deviceId;

            req.open("GET", requestUrl, true);

            req.onerror = function (rtn) {
              console.warn("getPublicIp onerror", rtn);
              onRequestError(
                "getPublicIp",
                vars.domain +
                  " " +
                  JSON.stringify(rtn, ["message", "arguments", "type", "name"])
              );
              ipPromise.resolve("unknown");
            };

            req.onload = function () {
              // console.log(responseObject);
              var responseCode = this.status;
              if (responseCode === 200) {
                var responseObject = JSON.parse(this.response);
                setLocalVars({ publicIp: responseObject.ip });

                if (appConfig.debugConsole) {
                  // console.log('PUBLIC IP : ' + responseObject.ip);
                }
                ipPromise.resolve(responseObject.ip);
              } else {
                if (appConfig.debugAnalytics) {
                  Analytics.sendEvent({
                    category: "Request Error",
                    action: "Public IP Request API Error",
                    label: this.response,
                    value: responseCode,
                    domain: vars.domain,
                    licenseTier: vars.licenseTier,
                  });
                }

                ipPromise.resolve("unknown");
              }
            };

            try {
              req.send();
            } catch (e) {
              if (appConfig.debugAnalytics) {
                Analytics.sendEvent({
                  category: "Request Error",
                  action: "Public IP Request API Error",
                  label: JSON.stringify(e),
                  domain: vars.domain,
                  licenseTier: vars.licenseTier,
                });
              }
              ipPromise.resolve("unknown");
            }

            return ipPromise.promise;
          })(),
        ]).then(function (result) {
          // console.log('resolving public IP', result);
          deferred.resolve(result);
        });
      }

      return deferred.promise;
    },

    /**
     * Drop relevant sessions from storage
     *
     * @param {array} which activeSessions and/or closedSessions
     *
     * @returns {promise} -> boolean
     */

    // clearSessions: function(which) {
    //
    //   var deferred = Q.defer();
    //
    //   chrome.storage.sync.remove(which, function() {
    //
    //     if (chrome.runtime.lastError) {
    //       console.error(chrome.runtime.lastError.message);
    //       deferred.resolve(false);
    //     }
    //     deferred.resolve(true);
    //
    //   });
    //
    //   return deferred.promise;
    //
    // }
  };
})();
