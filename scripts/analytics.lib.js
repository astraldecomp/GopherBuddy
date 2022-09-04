var Analytics = (function () {
  "use strict";

  var deviceIdKnown = false;

  var initialiseCommon = function () {
    analytics.applicationPrefix = appConfig.analytics.shortAppName;

    chrome.identity.getProfileUserInfo(function (userInfo) {
      var parts = userInfo.email.split("@");

      var domain = parts[1] || "Unknown domain";

      defaultEventObject.push(["cd1", domain]);
      defaultEventObject.push(["uid", userInfo.id]);

      // TODO: get license tier here and populate default event
      defaultEventObject.push(["cd2", "free"]);

      chrome.storage.local.set({ domain: domain });

      if (
        appConfig.analytics.customDimensions !== undefined &&
        appConfig.analytics.customDimensions.length
      ) {
        analytics.addCustomDimensions();
      }
    });

    // Try to get device ID from force-installed extension

    addDeviceId();
  };

  var addDeviceId = function () {
    getDeviceId(function (deviceId) {
      try {
        if (!deviceId) {
          throw new Error("Unknown device ID");
        } else {
          deviceIdKnown = true;
          defaultEventObject.push(["cd8", deviceId]);
        }
      } catch (e) {
        // console.log(e);
        // defaultEventObject.push(['cd8', 'Unknown device ID']);
      }
    });
  };

  var defaultEventObject = [
    ["v", 1],
    ["ul", "en-US"],
    ["tid", appConfig.analytics.GAPropertyCode],
    ["an", appConfig.analytics.appName],
    ["av", appConfig.analytics.version],
  ];

  var eventDimensions = {
    category: "ec",
    action: "ea",
    label: "el",
    message: "cd4",
    domain: "cd1",
    licenseTier: "cd2",
    duration: "cd3",
    previousVersion: "cd5",
    newVersion: "cd6",
    gitHash: "cd7",
    deviceId: "cd8",
    timeStamp: "cd10",
    exDescription: "exDescription",
    exFatal: "exFatal",
  };

  var analytics = {
    trackingActive: false,
    applicationPrefix: null,
    code: "UA-74242333-9", // Google Analytics Default Code just in case code not provided

    addCustomDimensions: function () {
      // Custom dimensions should be stored in an array in the analytics property of environmentService
      // E.g. "analytics": {
      //   "GAPropertyCode": "UA-74242333-9",
      //     "customDimensions": [
      //     {
      //       "label": "gitHash",
      //       "dimension": "cd7",
      //       "addToDefault": true
      //     }
      //   ]
      // },

      _.forOwn(appConfig.analytics.customDimensions, function (value) {
        eventDimensions[value.label] = value.dimension;

        // If the new custom dimension is set to addToDefault, then we will add it to the defaultEventObject and use the
        // setting from environmentService

        if (value.addToDefault) {
          defaultEventObject.push([value.dimension, buildInfo[value.label]]);
        }
      });
    },

    init: function () {
      analytics.trackingActive = true;
      initialiseCommon();
    },

    tracker: {
      prepOptions_: function (data) {
        var payload = data
          .map(function (el) {
            return el.join("=");
          })
          .join("&");

        return {
          method: "post",
          payload: payload,
        };
      },
    },

    sendEvent: function (event) {
      if (analytics.trackingActive) {
        if (!deviceIdKnown) {
          console.log("deviceId not known yet...");
          addDeviceId();
        }

        var data = _.clone(defaultEventObject);

        // Prepare the event dimensions for sending to GA
        _.forOwn(event, function (value, key) {
          data.push([eventDimensions[key], value]);
        });

        data.push(["t", "event"]);
        data.push(["z", Math.floor(Math.random() * 10e7)]);

        var options = analytics.tracker.prepOptions_(data);

        $.ajax({
          method: "POST",
          url: "https://ssl.google-analytics.com/collect",
          data: options.payload,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }).then(
          function (response) {
            // console.log(response);
          },
          function (error) {
            // console.log(error);
          }
        );
      }
    },

    sendView: function (path) {
      console.log(path, analytics);

      if (analytics.trackingActive) {
        var event = _.clone(defaultEventObject);

        event.push(["t", "appview"]);
        event.push(["z", Math.floor(Math.random() * 10e7)]);
        event.push(["cd", path]);

        var options = analytics.tracker.prepOptions_(event);

        $.ajax({
          method: "POST",
          url: "https://ssl.google-analytics.com/collect",
          data: options.payload,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }).then(
          function (response) {
            // console.log(response);
          },
          function (error) {
            // console.log(error);
          }
        );
      }
    },

    sendException: function (msg, fatal) {
      if (analytics.trackingActive) {
        var event = _.clone(defaultEventObject);

        fatal = fatal === undefined ? false : fatal;

        event.push(["t", "exception"]);
        event.push(["z", Math.floor(Math.random() * 10e7)]);
        event.push(["exDescription", msg]);
        event.push(["exFatal", fatal]);

        var options = analytics.tracker.prepOptions_(event);

        $.ajax({
          method: "POST",
          url: "https://ssl.google-analytics.com/collect",
          data: options.payload,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }).then(
          function (response) {
            // console.log(response);
          },
          function (error) {
            // console.log(error);
          }
        );
      }
    },
  };

  return analytics;
})();
