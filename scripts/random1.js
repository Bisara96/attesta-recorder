var vm = this;

var steps = [];
var step = {};

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
    console.log("Resuming record");
    chrome.storage.sync.get(["steps"], function(items) {
      loadSteps(items.steps);
    });
    record();
  }
});

window.addEventListener("message", function(event) {
  if (event.source != window) return;

  if (event.data.type && event.data.type == "startRecording") {
    record();
  } else if (event.data.type && event.data.type == "stopRecording") {
    stopRecord();
  }
});

function record() {
  steps = [];
  console.log("Starting record");
  bindEventsToRecord();
}

function stopRecord() {
  unbindEventsToRecord();
  console.log("Record Stopped");
  console.log("Steps : \n" + JSON.stringify(steps));
  steps = [];
  chrome.runtime.sendMessage({ method: "setStatus", status: "notrecording" });
  chrome.storage.sync.set({ steps: steps });
}

const isValidClick = el => {
  const tag = el.tagName.toLowerCase();
  const type = el.getAttribute("type");

  // if (["a", "button"].indexOf(tag) !== -1) return true;
  if (tag === "input" && ["button", "submit"].indexOf(type) === -1) return false;
  return true;
};

const isValidSelect = el => {
  const tag = el.tagName.toLowerCase();

  if (["option", "select"].indexOf(tag) !== -1) return true;
  return false;
};

const isValidType = el => {
  const tag = el.tagName.toLowerCase();
  const type = el.getAttribute("type");

  if (tag === "textarea") return true;
  if (tag === "input") return true;

  return false;
};

const onClick = e => {
  if (!isValidClick(e.target)) return;
  var targetElement = event.target || event.srcElement;
  step = {};
  console.log("click on " + getElementXPath(targetElement));
  step.type = "click";
  step.xpath = getElementXPath(targetElement);
  saveStep(step);
};

const onChange = e => {
  if (isValidSelect(e.target)) {

    step = {};
    var targetElement = event.target || event.srcElement;
    console.log(
      "select " + getDropdownSelectedOption() + " of " + getElementXPath(targetElement)
    );
    step.type = "select";
    step.displayText = getDropdownSelectedOption();
    step.xpath = getElementXPath(targetElement);
    saveStep(step);

  } else if (isValidType(e.target)) {

    const value = (e.target.value || "").replace(/\n/g, "\\n");

    step = {};
    var targetElement = event.target || event.srcElement;
    console.log("type " + value + " of " + getElementXPath(targetElement));
    step.type = "type";
    step.label = value;
    step.xpath = getElementXPath(targetElement);
    saveStep(step);
  }
};

const getCheckBoxSelectedState = e => {
  return e.target.checked;
};

const getDropdownSelectedOption = e => {
  const value = e.target.value;
  const $option = Array.from(e.target.children).find(
    $op => $op.value === value
  );
  return $option.text.trim();
};

const bindEventsToRecord = () => {
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
};

const unbindEventsToRecord = () => {
  document.removeEventListener("click", onClick, true);
  document.removeEventListener("change", onChange, true);
};

function saveStep(step) {
  steps.push(step);
  chrome.storage.sync.set({ steps: steps });
};

function loadSteps(rsteps) {
  steps = rsteps;
};

window.onbeforeunload = function(event) {
  // if (!finished)
  //   chrome.runtime.sendMessage({ method: "setStatus", status: "recording" });
};
