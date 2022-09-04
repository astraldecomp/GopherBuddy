
var appConfig = {

  debugAnalytics: false,
  debugConsole: false,
  trackSessionEvents: false,
  trackAnalytics: false,

  checkRateInSeconds: {
    basic: (6 * 60 * 60), // 6 hours
    premium: (6 * 60 * 60), // 6 hours
    activity: (5 * 60), // Default window size for activity blocks
    alarmDelay: (11 * 60), // 10 minutes
    licenseRefresh: (24 * 60 * 60) // 24 hours
  },
  popupAfterSeconds: (24 * 60 * 60), // 24 hours
  sessionTimeoutInSeconds: (5 * 60),
  sessionTimeoutInSecondsFromOtherDevice: (60 * 60), // 1 hour before sessions from other devices are expired
  syncCachePersistSeconds: 30,
  
  analytics: {
    GAPropertyCode: 'UA-74242333-22',
    shortAppName: 'GB',
    appName: 'Gopher Buddy',
    version: '0.9.8.8',
    customDimensions: [
      {
        label: 'gitHash',
        dimension: 'cd7',
        addToDefault: true
      }
    ]
  },

  storageKeys: [
    'licenseTier',
    'domain',
    'customerId',
    'deviceOrgUnitPath',
    'userOrgUnitPath',
    'deviceId',
    'userId',
    'deviceVersion',
    'verboseDeviceVersion',
    'available',
    'lastChecked',
    'managedDevice',
    'developer',
    'licenseTimestamp',
    'dummyId',
    'domainSettings',
    'disabled',
    'pingInterval'
  ],
  api: {
    baseUrl: 'https://gopher-buddy-prod.appspot.com',
    version: '/v2',
    getCustomerTier: '/getCustomerTier',
    verifyAuth: '/verifyAuth',
    publicIp: '/publicIP',
    deviceInfoPermission: '/deviceInfoPermission',
    help: '/support',
    deviceInfo: '/support',
    hashKey: 'adasfklasd09odaadslk',
    deviceLookup: '/deviceLookup',
    token: 'dsalj009mnv-8sdjhsa8jhd'
  },
  
  pubsub: {
    topic: 'session-ingest',
    project: 'gopher-buddy-prod',
    key : 'AIzaSyCTgIFn8GImeF-fshihisrLuLqP7eyFtZ8',
    pingRateInSeconds: 240
  },
  
  docWindow: {
    top: 384,
    height: 500,
    focused: true,
    type: 'popup'
  },

  notices: {
    outOfDate: {
      type: 'basic',
      iconUrl: '../images/chrome_gopher_unhappy_128.png',
      title: 'Chrome is out of date',
      message: 'You need to update Chrome\nClick OK to open the update page,\nor LATER to get reminded later',
      buttons: [{
        title: 'OK',
        iconUrl: '../images/check.png'
      }, {
        title: 'LATER',
        iconUrl: '../images/clock.png'
      }],
      requireInteraction: true
    },
    checkAgain: {
      type: 'basic',
      iconUrl: '../images/gopher-buddy_128x128_color.png',
      title: 'Gopher Buddy will check again',
      message: 'Gopher Buddy will check your version again in the next few minutes, and let you know if you need to update',
      requireInteraction: false
    }
  },

  images: {
    default: '../images/gopher-buddy_32x32_color.png',
    warning: '../images/gopher-buddy_unhappy.png',
    disabled: '../images/gopher-buddy_disabled.png'
  },

  buildInfo: {
    gitHash: ''
  }

};
