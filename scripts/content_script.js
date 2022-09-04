// Event listener
document.addEventListener('RW759_connectExtension', function(e) {

  console.log('event listener', e.detail);
  chrome.runtime.sendMessage(e.detail, function(resp) {
    console.log('content-script resp', resp);
  });

});
