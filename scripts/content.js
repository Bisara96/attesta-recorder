var vm = this;

var step = {};


/* Generate XPath for UI Objects */
const getElementXPath = element => {
  if (element && element.id) return '//*[@id="' + element.id + '"]';
  else return getElementTreeXPath(element);
}

/* Generate XPath for UI Objects - Advanced */
const getElementTreeXPath = element => {
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

/* Send a message to background script to see if theres and ongoing record */
chrome.runtime.sendMessage({ method: "getStatus" }, isRecording => {
  if (isRecording == 'true') {
    continueRecord();
  }
});

/* Listen for messages from the DOM */
window.addEventListener("message", event => {
  if (event.source != window) return;

  if (event.data.type && event.data.type == "startRecording") {
    record();
  } else if (event.data.type && event.data.type == "stopRecording") {
    stopRecord();
  }
});

/* Start a new record */
const record = () => {
  setSteps([]);
  console.log("Starting record");
  bindEventsToRecord();
  chrome.runtime.sendMessage({ method: "setStatus", status: true });
};

/* Continue the ongoing record */
const continueRecord = () => {
  console.log("Continuing record");
  bindEventsToRecord();
};

/* Stop the ongoing record */
const stopRecord = () => {
  unbindEventsToRecord();
  console.log("Record Stopped");
  chrome.runtime.sendMessage({ method: "setStatus", status: false });
  printSteps();
};

/* Validated the click event UI Object */
const isValidClick = el => {
  const tag = el.tagName.toLowerCase();
  const type = el.getAttribute("type");

  if (["a", "button"].indexOf(tag) !== -1) return true;
  if (tag === "input" && ["button", "submit"].indexOf(type) === -1) return false;
  return true;
};

/* Validate the Select event UI Object */
const isValidSelect = el => {
  const tag = el.tagName.toLowerCase();

  if (["option", "select"].indexOf(tag) !== -1) return true;
  return false;
};

/* Validate the type event UI Object */
const isValidType = el => {
  const tag = el.tagName.toLowerCase();
  const type = el.getAttribute("type");

  if (tag === "textarea") return true;
  if (tag === "input") return true;

  return false;
};

const isValidKeyPress = e => {
  var keycode = e.keyCode;
  var el = e.target;
  if ((keycode >= 48 && keycode <=57) || (keycode >= 65 && keycode <= 90)) return false;
  if(keycode === 13 && el.tagName.toLowerCase() == "input") return false;
  return true;
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
    var targetElement = event.target || event.srcElement;
    console.log(
      "select " + getDropdownSelectedOption() + " of " + getElementXPath(targetElement)
    );
    step = {};
    step.type = "select";
    step.displayText = getDropdownSelectedOption();
    step.xpath = getElementXPath(targetElement);
    saveStep(step);

  } else if (isValidType(e.target)) {

    const value = (e.target.value || "").replace(/\n/g, "\\n");
    var targetElement = event.target || event.srcElement;
    console.log("type " + value + " on " + getElementXPath(targetElement));
    step = {};
    step.type = "type";
    step.value = value;
    step.xpath = getElementXPath(targetElement);
    saveStep(step);
  }
};

const onKeyPress = e => {
  if(!isValidKeyPress(e)) return;
  var targetElement = event.target || event.srcElement;
  console.log(
    "press " + e.keyCode + " on " + getElementXPath(targetElement)
  );
  step = {};
  step.type = "press";
  step.keycode = e.keyCode;
  step.xpath = getElementXPath(targetElement);
  saveStep(step);
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
  document.addEventListener("keyup", onKeyPress, true);
};

const unbindEventsToRecord = () => {
  document.removeEventListener("click", onClick, true);
  document.removeEventListener("change", onChange, true);
  document.removeEventListener("keyup", onKeyPress, true);
};

const saveStep = step => {
  console.log("Saving step "+JSON.stringify(step));
  chrome.storage.sync.get(["steps"], function(items) {
    var stepsList = items.steps;
    stepsList.push(step);
    chrome.storage.sync.set({ steps: stepsList });
    console.log("Saved step "+JSON.stringify(step));
  });
};

const setSteps = stepsList => {
  chrome.storage.sync.set({ steps: stepsList });
};

const printSteps = () => {
  chrome.storage.sync.get(["steps"], function(items) {
  console.log("Steps : \n" + JSON.stringify(items.steps));
  });
};

window.onbeforeunload = event => {
  if (!finished)
    chrome.runtime.sendMessage({ method: "setStatus", status: "recording" });
};