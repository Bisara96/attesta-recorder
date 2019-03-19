/* eslint-disable max-len */
let step = {};
let recording = false;
let unsavedSteps = [];
let id = -999;

/* Generate XPath for UI Objects */
const getElementXPath = (element) => {
  if (element && element.id) return '//*[@id="' + element.id + '"]';
  else return getElementTreeXPath(element);
};

/* Generate XPath for UI Objects - Advanced */
const getElementTreeXPath = (element) => {
  const paths = [];

  // Use nodeName (instead of localName) so namespace prefix is included (if any).
  for (; element && element.nodeType == 1; element = element.parentNode) {
    let index = 0;
    for (
      let sibling = element.previousSibling;
      sibling;
      sibling = sibling.previousSibling
    ) {
      // Ignore document type declaration.
      if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE) continue;

      if (sibling.nodeName == element.nodeName) ++index;
    }

    const tagName = element.nodeName.toLowerCase();
    const pathIndex = index ? '[' + (index + 1) + ']' : '';
    paths.splice(0, 0, tagName + pathIndex);
  }

  return paths.length ? '/' + paths.join('/') : null;
};

const generateElementKeywords = (element) => {
  let keywordsStr = '';
  const tagName = element.nodeName.toLowerCase();
  keywordsStr += tagName;
  if (element.getAttribute('name')) keywordsStr += ' '+element.getAttribute('name');
  if (tagName == 'button' ) keywordsStr += ' '+element.innerText;
  if (tagName == 'input' && element.getAttribute('placeholder')) keywordsStr += ' '+element.getAttribute('placeholder');
  if (tagName == 'input') {
    const labelTxt = getLabelTextOfEl(element);
    keywordsStr += labelTxt ? ' '+labelTxt : '';
  }
  return keywordsStr;
};

const getLabelTextOfEl = (element) => {
  const id = element.getAttribute('id');
  const elArray = element.form.getElementsByTagName('label');
  for (const el of elArray) {
    if (el.htmlFor == id) {
      console.log('FOUND LABEL FOR '+id+' '+el.innerText);
      return el.innerText;
    }
  }
  return false;
};

/* Send a message to background script to see if theres and ongoing record */
chrome.runtime.sendMessage({method: 'getStatus'}, (isRecording) => {
  if (isRecording.status === true) {
    id = isRecording.id;
    continueRecord();
  }
});

/* Listen for messages from the DOM */
window.addEventListener('message', (event) => {
  if (event.source != window) return;

  if (event.data.type && event.data.type == 'startRecording') {
    record(event.data.id);
  } else if (event.data.type && event.data.type == 'stopRecording') {
    stopRecord();
  }
});

/* Start a new record */
const record = (id) => {
  id = id;
  recording = true;
  unsavedSteps = [];
  setSteps([]);
  console.log('Starting record');
  bindEventsToRecord();
  addStopButton();
  chrome.runtime.sendMessage({method: 'setStatus', status: true, id: id});
};

/* Continue the ongoing record */
const continueRecord = () => {
  chrome.storage.sync.get(['steps'], (items) => {
    recording = true;
    unsavedSteps = items.steps;
    console.log('Continuing record : STEPS : '+JSON.stringify(unsavedSteps));
    bindEventsToRecord();
    addStopButton();
  });
};

/* Stop the ongoing record */
const stopRecord = () => {
  recording = false;
  unbindEventsToRecord();
  removeStopButton();
  console.log('Record Stopped');
  chrome.runtime.sendMessage({method: 'setStatus', status: false, id: -999});
  sendToAgent();
};

/* Validated the click event UI Object */
const isValidClick = (el) => {
  const tag = el.tagName.toLowerCase();
  const type = el.getAttribute('type');

  if (['a', 'button'].indexOf(tag) !== -1) return true;
  if (tag === 'input' && ['button', 'submit'].indexOf(type) === -1) return false;
  return true;
};

/* Validate the Select event UI Object */
const isValidSelect = (el) => {
  const tag = el.tagName.toLowerCase();

  if (['option', 'select'].indexOf(tag) !== -1) return true;
  return false;
};

/* Validate the type event UI Object */
const isValidType = (el) => {
  const tag = el.tagName.toLowerCase();
  // const type = el.getAttribute('type');

  if (tag === 'textarea') return true;
  if (tag === 'input') return true;

  return false;
};

const isValidKeyPress = (e) => {
  const keycode = e.keyCode;
  const el = e.target;
  if ((keycode >= 48 && keycode <=57) || (keycode >= 65 && keycode <= 90)) return false;
  if ([32].indexOf(keycode) !== -1 && el.tagName.toLowerCase() == 'input') return false;
  return true;
};

const onClick = (e) => {
  if (e.target.id == 'fyp-record-stop-btn') {
    stopRecord();
    return;
  }
  if (!isValidClick(e.target)) return;
  const targetElement = event.target || event.srcElement;
  step = {};
  console.log('click on ' + getElementXPath(targetElement));
  step.type = 'click';
  step.xpath = getElementXPath(targetElement);
  step.keywords = generateElementKeywords(targetElement);
  saveStep(step);
};

const onChange = (e) => {
  if (isValidSelect(e.target)) {
    const targetElement = event.target || event.srcElement;
    console.log(
        'select ' + getDropdownSelectedOption() + ' of ' + getElementXPath(targetElement)
    );
    step = {};
    step.type = 'select';
    step.displayText = getDropdownSelectedOption();
    step.xpath = getElementXPath(targetElement);
    step.keywords = generateElementKeywords(targetElement);
    saveStep(step);
  } else if (isValidType(e.target)) {
    const value = (e.target.value || '').replace(/\n/g, '\\n');
    const targetElement = event.target || event.srcElement;
    console.log('type ' + value + ' on ' + getElementXPath(targetElement));
    step = {};
    step.type = 'type';
    step.value = value;
    step.xpath = getElementXPath(targetElement);
    step.keywords = generateElementKeywords(targetElement);
    saveStep(step);
  }
};

const onKeyPress = (e) => {
  if (!isValidKeyPress(e)) return;
  const targetElement = event.target || event.srcElement;
  console.log(
      'press ' + e.keyCode + ' on ' + getElementXPath(targetElement)
  );
  step = {};
  step.type = 'press';
  step.keycode = e.keyCode;
  step.xpath = getElementXPath(targetElement);
  step.keywords = generateElementKeywords(targetElement);
  saveStep(step);
};

// const getCheckBoxSelectedState = (e) => {
//   return e.target.checked;
// };

const getDropdownSelectedOption = (e) => {
  const value = e.target.value;
  const $option = Array.from(e.target.children).find(
      ($op) => $op.value === value
  );
  return $option.text.trim();
};

const bindEventsToRecord = () => {
  document.addEventListener('click', onClick, true);
  document.addEventListener('change', onChange, true);
  document.addEventListener('keyup', onKeyPress, true);
};

const unbindEventsToRecord = () => {
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('change', onChange, true);
  document.removeEventListener('keyup', onKeyPress, true);
};

const saveStep = (step) => {
  unsavedSteps.push(step);
};

const setSteps = (stepsList) => {
  chrome.storage.sync.set({steps: stepsList});
};

const sendToAgent = () => {
  console.log('Steps : \n' + JSON.stringify(unsavedSteps));
  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'http://localhost:8080/record/stop', true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify({id: id, steps: unsavedSteps}));
  console.log(JSON.stringify({id: id, steps: unsavedSteps}));
};

const addStopButton = () => {
  const div = document.createElement('DIV');
  div.id = 'fyp-record-stop-btn-div';
  const btn = document.createElement('BUTTON');
  btn.id = 'fyp-record-stop-btn';
  const btnText = document.createTextNode('STOP');
  btn.appendChild(btnText);
  div.appendChild(btn);
  document.body.appendChild(div);
};

const removeStopButton = () => {
  document.body.removeChild(document.getElementById('fyp-record-stop-btn-div'));
};

window.onbeforeunload = (event) => {
  if (recording) {
    chrome.storage.sync.set({steps: unsavedSteps}, () => {
      console.log('Uploaded : STEPS : '+JSON.stringify(unsavedSteps));
    });
  }
};
