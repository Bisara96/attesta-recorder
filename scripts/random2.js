var vm = this;

var steps = [];
var step = {};
var recording = false;
var finished = true;

console.log("HI im the content script");

function getElementXPath(element) {
  if (element && element.id) return '//*[@id="' + element.id + '"]';
  else return getElementTreeXPath(element);
}

function getElementTreeXPath(element) {
  var paths = [];

  // Use nodeName (instead of localName) so namespace prefix is included (if any).
  for (; element && element.nodeType == 1; element = element.parentNode) {
    var index = 0;
    for (
      var sibling = element.previousSibling;
      sibling;
      sibling = sibling.previousSibling
    ) {
      // Ignore document type declaration.
      if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE) continue;

      if (sibling.nodeName == element.nodeName) ++index;
    }

    var tagName = element.nodeName.toLowerCase();
    var pathIndex = index ? "[" + (index + 1) + "]" : "";
    paths.splice(0, 0, tagName + pathIndex);
  }

  return paths.length ? "/" + paths.join("/") : null;
}

chrome.runtime.sendMessage({ method: "getStatus" }, function(response) {
  if (response == "recording") {
    finished = false;
    vm.recording = true;
    console.log("resuming recording");
    chrome.storage.sync.get(["steps"], function(items) {
      loadSteps(items.steps);
    });
    record();
  }
});

window.addEventListener("message", function(event) {
  if (event.source != window) return;

  if (event.data.type && event.data.type == "startRecording") {
    finished = false;
    vm.recording = true;
    steps = [];
    console.log("Starting record");
    record();
  } else if (event.data.type && event.data.type == "stopRecording") {
    console.log("Record Stopped");
    console.log("Steps : \n" + JSON.stringify(steps));
    vm.recording = false;
    finished = true;
    steps = [];
    chrome.runtime.sendMessage({ method: "setStatus", status: "notrecording" });
    chrome.storage.sync.set({ steps: steps });
  }
});

function record() {
  $(document).on("click", function(event) {
    step = {};
    var targetElement = event.target || event.srcElement;
    console.log("click on " + getElementXPath(targetElement));
    step.type = "click";
    step.xpath = getElementXPath(targetElement);
    saveStep(step);
  });
  $(document).on("keyup", function(event) {
    step = {};
    var targetElement = event.target || event.srcElement;
    console.log(
      "type " + event.keyCode + " on " + getElementXPath(targetElement)
    );
    step.type = "type";
    step.keycode = event.keyCode;
    step.xpath = getElementXPath(targetElement);
    saveStep(step);
  });
}

function saveStep(step) {
  steps.push(step);
  chrome.storage.sync.set({ steps: steps });
}

function loadSteps(rsteps) {
  steps = rsteps;
}

window.onbeforeunload = function(event) {
  if (!finished)
    chrome.runtime.sendMessage({ method: "setStatus", status: "recording" });
};
