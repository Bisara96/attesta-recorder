var status = false;
chrome.runtime.onMessage.addListener(function(message,sender,sendResponse){
  if(message.method == 'setStatus')
    status = message.status;
  else if(message.method == 'getStatus')
    sendResponse(status);
});