/* eslint-disable linebreak-style */
let status = false;
let id = -999;
currStepIndex = -1;
currStepTime = 0;
currStepSS = '';
pendingSS = false;

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Got message '+message);
  if (message.method == 'setStatus') {
    status = message.status;
    id = message.id;
  } else if (message.method == 'getStatus') {
    sendResponse({'status': status, 'id': id});
  } else if (message.method == 'takeScreenshot') {
    chrome.tabs.captureVisibleTab(
        null,
        {},
        function(dataUrl) {
          pendingSS = true;
          currStepSS = dataUrl;
          currStepTime = message.time;
          currStepIndex = message.index;
          sendResponse({imgSrc: dataUrl});
          console.log('response sent');
        }
    );
    return true;
  } else if (message.method == 'updated') {
    currStepSS = '';
    currStepTime = 0;
    currStepIndex = -1;
    pendingSS = false;
  } else if (message.method == 'pending') {
    console.log('inside penidng');
    if (pendingSS) {
      console.log('found penidng');
      // eslint-disable-next-line max-len
      chrome.tabs.captureVisibleTab(
          null,
          {},
          function(dataUrl) {
            // eslint-disable-next-line max-len
            console.log('sending response with new ss');
            sendResponse({pending: true, index: currStepIndex, time: currStepTime, ss: dataUrl});
          }
      );
      return true;
    } else {
      sendResponse({pending: false});
    }
  }
});

