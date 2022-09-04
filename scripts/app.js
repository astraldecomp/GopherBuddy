(function () {
  "use strict";

  angular
    .module("ait.chromeGopher", ["ngMaterial", "ngMdIcons"])

    // The following compileProvider change is required to allow paths to images to be referenced with the 'chrome-extension:' prefix.

    .config([
      "$compileProvider",
      function ($compileProvider) {
        var currentImgSrcSanitizationWhitelist =
          $compileProvider.imgSrcSanitizationWhitelist();
        var newImgSrcSanitizationWhiteList =
          currentImgSrcSanitizationWhitelist.toString().slice(0, -1) +
          "|chrome-extension:" +
          currentImgSrcSanitizationWhitelist.toString().slice(-1);

        // console.log("Changing imgSrcSanitizationWhiteList from "+currentImgSrcSanitizationWhitelist+" to "+newImgSrcSanitizationWhiteList);
        $compileProvider.imgSrcSanitizationWhitelist(
          newImgSrcSanitizationWhiteList
        );
      },
    ])

    .run(function () {
      console.log("initialised AIT GOPHERBUDDY");
    });
})();
