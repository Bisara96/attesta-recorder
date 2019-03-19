let status = false;
let id = -999;

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {

  if (message.method == 'setStatus') {
    status = message.status;
    id = message.id;
  } else if (message.method == 'getStatus') {
    sendResponse({'status': status, 'id': id});
  }
});