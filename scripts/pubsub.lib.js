var PubSubApp = (function() {
  
  let activityIntervalId;
  this.intervalInSeconds = appConfig.pubsub.pingRateInSeconds;
  
  /**
   * Refreshes the user ID and domain variables.
   * @return {Promise<void>}
   */
  const refreshUserInfo = async () => {
    const info = new Promise((resolve, reject) => {
      try {
        chrome.identity.getProfileUserInfo(function (userInfo) {
          resolve({domain: parseDomainFromUserInfo(userInfo), userId: userInfo.id})
        });
      } catch(e) {
        console.error(e);
        reject(e);
      }
    });
    const backStop = new Promise((resolve, reject) => {
      setTimeout(function() {
        return reject('timeout');
      }, 15000);
    });
    return Promise.race([info, backStop]);
  };
  
  /**
   * Generates a message payload to send to pubsub
   * @return {{crosVersion: *, domain: *, privateIp: *, customerId: *, publicIp: *, deviceId: *, userId: *, deviceOrgUnitPath: *, userOrgUnitPath: *, timestamp: *}}
   */
  const getMessagePayload = async () => {
    
    const timestamp = new Date().toISOString();
    
    let promises = [];
    
    if (!vars.publicIp || vars.publicIp.toLowerCase() === 'unknown') {
      // console.warn('attempted to publish without public IP');
      promises.push(SessionApp.getPublicIP().then((publicIp) => {
        vars.publicIp = publicIp;
        return publicIp;
      }).catch((e) => {
        if (appConfig.debugConsole) {
          console.error(e);
        }
        vars.publicIp = 'unknown';
        return 'unknown';
      }));
    }
    
    if (!vars.privateIp || vars.privateIp.toLowerCase() === 'unknown') {
      // console.warn('attempted to publish without private IP');
      promises.push(SessionApp.getPrivateIP().then((privateIp) => {
        vars.privateIp = privateIp;
        return privateIp;
      }).catch((e) => {
        vars.privateIp = 'unknown';
        return 'unknown';
      }));
    }
    
    if (!vars.deviceId) {
      promises.push(new Promise((resolve, reject) => {
        getDeviceId((deviceId) => {
          vars.deviceId = deviceId;
          setLocalVars({deviceId});
          return vars.deviceId;
        });
      }).catch((err) => 'unknown'));
    }
    
    if (!vars.customerId || !vars.deviceOrgUnitPath || !vars.userOrgUnitPath) {
      // console.warn('attempted to publish without customer ID');
      promises.push(new Promise((resolve, reject) => {
        chrome.identity.getProfileUserInfo(function (userInfo) {
          getLicenseTier({ userInfo: userInfo, deviceId: vars.deviceId }, resolve, reject);
        });
      }).catch((err) => {
        if (appConfig.debugConsole) {
          console.error(err);
        }
        return 'unknown';
      }));
    } else if (!vars.domain || !vars.userId) {
      // console.warn('attempted to publish without domain or user ID');
      promises.push(refreshUserInfo().then(({domain, userId}) => {
        Object.assign(vars, {domain, userId});
        setLocalVars({domain, userId});
        return {domain, userId};
      }).catch(e => {
        return e;
      }));
    }
    
    // Once all these promises have completed, vars object will contain valid values.
    if (promises.length) {
      await Promise.all(promises).catch(console.error);
    }
    
    return {
      deviceId: vars.deviceId,
      userId: vars.userId,
      customerId: vars.customerId,
      domain: vars.domain,
      deviceOrgUnitPath: vars.deviceOrgUnitPath,
      userOrgUnitPath: vars.userOrgUnitPath,
      publicIp: vars.publicIp,
      privateIp: vars.privateIp,
      crosVersion: vars.verboseDeviceVersion,
      extensionVersion: appConfig.analytics.version,
      timestamp
    };
  };
  
  /**
   * Compresses standard message payloads into a minified version for storage in chrome storage
   * @param {Array} sessionsArray An array of message payloads to cache
   * @return {Object} minifiedSessions A minified session object that stores metadata and an array of timestamps
   * minifiedSessions.p {Object} The session payload metadata
   * minifiedSessions.ts {Array} An array of timestamps
   * @private
   */
  const minifySessions_ = (sessionsArray) => {
    return sessionsArray.reduce((acc, session) => {
      if (acc.ts.indexOf(session.timestamp) < 0){
        acc.ts.push(session.timestamp);
      }
      if (!acc.p) {
        acc.p = session;
      }
      return acc;
    }, {ts: []});
  };
  
  /**
   * Decompresses cached message payloads into their full version for publishing to pubsub topic.
   * @param minifiedSessionsObject
   * @return {(any | (number & {timestamp: *}) | (string & {timestamp: *}) | (string & {timestamp: *}))[]}
   * @private
   */
  const explodeSessions_ = (minifiedSessionsObject) => {
    return minifiedSessionsObject.ts.map(t => {
      if (!minifiedSessionsObject.p.customerId || !minifiedSessionsObject.p.deviceOrgUnitPath || !minifiedSessionsObject.p.userOrgUnitPath) {
        // console.warn('exploding payload without customerId');
        minifiedSessionsObject.p.customerId = vars.customerId;
      }
      if (!minifiedSessionsObject.p.userId) {
        // console.warn('exploding payload without userId');
        minifiedSessionsObject.p.userId = vars.userId;
      }
      if (!minifiedSessionsObject.p.privateIp) {
        // console.warn('exploding payload without privateIp');
        minifiedSessionsObject.p.privateIp = 'unknown';
      }
      if (!minifiedSessionsObject.p.publicIp) {
        // console.warn('exploding payload without publicIp');
        minifiedSessionsObject.p.publicIp = 'unknown';
      }
      if (!minifiedSessionsObject.p.deviceOrgUnitPath) {
        // console.warn('exploding payload without publicIp');
        minifiedSessionsObject.p.deviceOrgUnitPath = vars.deviceOrgUnitPath;
      }
      if (!minifiedSessionsObject.p.userOrgUnitPath) {
        // console.warn('exploding payload without publicIp');
        minifiedSessionsObject.p.userOrgUnitPath = vars.userOrgUnitPath;
      }
      return Object.assign(minifiedSessionsObject.p, {timestamp: t});
    });
  };
  
  /**
   * Event handler to reset public and private IP when device goes offline.
   * @param {Object} e The event object
   * @return {Promise<void>}
   */
  const goOffline = async (e) => {
    // console.log('goOffline');
    setLocalVars({privateIp: 'unknown', publicIp: 'unknown'});
  };
  
  /**
   * Event handler to ensure that when network connection is established, check for stored messages and report
   * @param {Object} e The event object
   * @return {Promise<void>}
   */
  const goOnline = async (e) => {
    // console.log('goOnline');
  
    if (!vars.domain || !vars.userId) {
      // console.warn('attempted to publish without domain or user ID');
      let {domain, userId} = await refreshUserInfo().then(({domain, userId}) => {
        Object.assign(vars, {domain, userId});
        setLocalVars({domain, userId});
        return {domain, userId};
      }).catch(e => {
        return e;
      });
      vars.domain = domain;
      vars.userId = userId;
    }
    
    if (!vars.customerId) {
      let customerId = await new Promise((resolve, reject) => {
        try {
          getUserProfile(vars.deviceId, (userInfo) => {
            // console.log('getUserProfile userInfo', userInfo);
            getLicenseTier({domain: vars.domain, userInfo}, (result) => {
              // console.log('getLicenseTier result', result);
              resolve(vars.customerId);
            }, (err) => {
              console.error(err);
              reject(err);
            });
          });
        } catch(err) {
          reject(err);
        }
      }).catch((err) => {
        if (appConfig.debugConsole) {
          console.error(err);
        }
        return 'unknown';
      });
      // console.log('got customer id', customerId);
      vars.customerId = customerId;
      setLocalVars({customerId});
    }
    
    let privateIp = await SessionApp.getPrivateIP().then((ip) => {
      vars.privateIp = ip;
      return ip;
    }).catch((err) => {
      if (appConfig.debugConsole) {
        console.error(err);
      }
      vars.privateIp = 'unknown';
      return 'unknown';
    });
    
    let publicIp = await SessionApp.getPublicIP().then((ip) => {
      vars.publicIp = ip;
      return ip;
    }).catch((err) => {
      if (appConfig.debugConsole) {
        console.error(err);
      }
      vars.publicIp = 'unknown';
      return 'unknown';
    });
    
    setLocalVars({privateIp, publicIp});
    let resp = await retrieveCachedMessages();
    if (resp.msgs.length) {
      console.log('sending cachedMessages', resp.msgs.length);
      const success = await publishTopic(resp.msgs);
      if (success) {
        console.log('cached msgs sent');
        await new Promise((res, rej) => chrome.storage.sync.remove(resp.keys, res));
        console.log('removed cached msgs from sync storage');
      }
    }
  };
  
  /**
   * Adds or refreshes listeners for online and offline events, in order to set/unset IP address values
   * @return {Promise<void>}
   */
  const addConnectivityListeners = async () => {
    window.removeEventListener('online', goOnline);
    window.removeEventListener('offline', goOffline);
    window.addEventListener('online', goOnline, false);
    window.addEventListener('offline', goOffline, false);
    if (window.navigator.onLine) {
      return goOnline(null);
    } else {
      return goOffline(null);
    }
  };
  
  const clearIntervalFunction = () => {
    if (activityIntervalId) {
      clearInterval(activityIntervalId);
      // console.log('cleared ping interval');
      activityIntervalId = null;
    }
  };
  
  const validateIntervalFunction = (checkRateInSeconds) => {
    
    if (!vars.managedDevice) {
      console.log('not a managed device.');
      return clearIntervalFunction();
    }
    
    const rate = checkRateInSeconds || this.intervalInSeconds || appConfig.pubsub.pingRateInSeconds;
    
    if (rate && rate === this.intervalInSeconds && activityIntervalId) {
      // console.log('interval already exists');
      return activityIntervalId;
    }
    if (activityIntervalId) {
      // console.log(`updating interval ${this.intervalInSeconds} -> ${rate}`);
      clearInterval(activityIntervalId);
    }
    this.intervalInSeconds = rate;
    activityIntervalId = setInterval(detectChromebookActivity, this.intervalInSeconds * 1000);
    addConnectivityListeners().then(detectChromebookActivity).catch((err) => {
      console.error('addConnectivityListeners error', err);
    });
    // console.log('set interval: ', this.intervalInSeconds);
    return activityIntervalId;
  };
  
  const sendPing = async() => {
    if (vars.managedDevice === false) {
      return clearIntervalFunction();
    }
    let payload = await getMessagePayload();
    // console.log('sendPing', payload);
    // return publishTopic([payload]);
    // return cacheMessages([payload]);
    return window.navigator.onLine ? publishTopic([payload]) : cacheMessages([payload]);
  };
  
  const retrieveCachedMessages = async () => {
    let syncStorage = await new Promise((res, rej) => chrome.storage.sync.get(null, res));
    let pingExp = new RegExp('ping|');
    const keys = Object.keys(syncStorage);
    return keys.reduce((acc, k) => {
      if (pingExp.test(k)) {
        try {
          // console.log('found sessions to send', k);
          acc.msgs = acc.msgs.concat(explodeSessions_(JSON.parse(syncStorage[k])));
          acc.keys.push(k);
        } catch(e) {
          console.error(e);
        }
      }
      return acc;
    }, {msgs: [], keys: []})
  };
  
  const cacheMessages = async (payloads) => {
    if (!vars.deviceId) {
      throw new Error('Cannot cache message - missing device ID');
    }
    const key = `ping|${vars.deviceId}`;
    let cacheValues = await new Promise((res, rej) => chrome.storage.sync.get([key], res));
    let msgs = (cacheValues[key] ? explodeSessions_(JSON.parse(cacheValues[key])) : []).concat(payloads);
    let toStore = {};
    toStore[key] = JSON.stringify(minifySessions_(msgs));
    await new Promise((res, rej) => chrome.storage.sync.set(toStore, res));
    console.log('payload has been cached');
  };
  
  /**
   * Constructs an array of messages formatted for sending to pubsub REST API
   * @param {Object[]} payloads An array of payload objects to transform into messages
   * @return {Object[]} An array of pubsub messages
   * @private
   */
  const generateMessages_ = (payloads) => {
    return payloads.map(pl => ({
      data: btoa(JSON.stringify(pl)),
      attributes: {
        userId: pl.userId,
        deviceId: pl.deviceId,
        timestamp: pl.timestamp
      }
    }));
  };
  
  const publishTopic = async (payloads) => {
    const key = appConfig.pubsub.key;
    const url = `https://pubsub.googleapis.com/v1/projects/${appConfig.pubsub.project}/topics/${appConfig.pubsub.topic}:publish?key=${key}`;
    return fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        messages: generateMessages_(payloads)
      })
    }).then(async (response) => {
      const res = await response.json();
      if (res.error) {
        await cacheMessages(payloads);
        console.warn(res.error);
        return false;
      }
      res.messageIds.forEach(mId => console.log(`Message with ID ${mId} has been published.`));
      return true;
    }).catch(async (e) => {
      console.warn(e);
      await cacheMessages(payloads);
      return false;
    });
  };
  
  const detectChromebookActivity = () => {
    let detectionIntervalInSeconds = Number(this.intervalInSeconds || appConfig.pubsub.pingRateInSeconds);
    // console.log('detectionIntervalInSeconds', detectionIntervalInSeconds);
    return new Promise((res, rej) => chrome.idle.queryState(detectionIntervalInSeconds, (state) => {
      if (state === 'active') {
        sendPing().then(r => res(r)).catch(e => rej(e));
      }
    }));
  };
  
  const checkForUpdatedParameters = async (apiResponse) => {
    let pingRequired = false;
    let toStore = {};
    
    if ('customerId' in apiResponse && vars.customerId !== apiResponse.customerId) {
      pingRequired = true;
      toStore.customerId = apiResponse.customerId;
    }
    
    if ('deviceOrgUnitPath' in apiResponse && vars.deviceOrgUnitPath !== apiResponse.deviceOrgUnitPath) {
      pingRequired = true;
      toStore.deviceOrgUnitPath = apiResponse.deviceOrgUnitPath;
    }
    
    if ('userOrgUnitPath' in apiResponse && vars.userOrgUnitPath !== apiResponse.userOrgUnitPath) {
      pingRequired = true;
      toStore.userOrgUnitPath = apiResponse.userOrgUnitPath;
    }
    
    if ('interval' in apiResponse && vars.pingInterval !== apiResponse.interval) {
      pingRequired = true;
      toStore.pingInterval = apiResponse.interval;
      validateIntervalFunction(apiResponse.interval);
    }
    
    if (pingRequired) {
      // console.log('storing updated values', toStore);
      setLocalVars(toStore, () => {
        sendPing();
      });
    }
    
  };
  
  return {
    validateIntervalFunction,
    clearIntervalFunction,
    checkForUpdatedParameters,
    goOnline,
    goOffline
  }
})();
