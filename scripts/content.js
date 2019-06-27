/* eslint-disable max-len */
let step = {};
let recording = false;
let unsavedSteps = [];
let id = -999;
let pendingSave = false;
let testMsg = '';
let server = '';

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
  if (element.getAttribute('name')) keywordsStr += ','+element.getAttribute('name');
  if (['a', 'button', 'ul'].indexOf(tagName) !== -1) keywordsStr += ','+element.innerText;
  if (tagName == 'input' && element.getAttribute('placeholder')) keywordsStr += ','+element.getAttribute('placeholder');
  if (tagName == 'input') {
    const labelTxt = getLabelTextOfEl(element);
    keywordsStr += labelTxt ? ','+labelTxt : '';
  }
  return keywordsStr;
};

const getLabelTextOfEl = (element) => {
  const id = element.getAttribute('id');
  const name = element.getAttribute('name');
  const elArray = element.form.getElementsByTagName('label');
  for (const el of elArray) {
    if ([id, name].indexOf(el.htmlFor) !== -1) {
      console.log('FOUND LABEL FOR '+id+' '+el.innerText);
      return el.innerText;
    }
  }
  return '';
};

window.addEventListener('load', (event) => {
  /* Send a message to background script to see if theres and ongoing record */
  chrome.runtime.sendMessage({method: 'getStatus'}, (isRecording) => {
    if (isRecording.status === true) {
      id = isRecording.id;
      server = localStorage.getItem('server');
      continueRecord();
    }
  });
});

/* Listen for messages from the DOM */
window.addEventListener('message', (event) => {
  if (event.source != window) return;

  if (event.data.type && event.data.type == 'startRecording') {
    record(event.data.id);
    server = event.data.server;
    localStorage.setItem('server', server);
  } else if (event.data.type && event.data.type == 'stopRecording') {
    stopRecord();
  } else if (event.data.type && event.data.type == 'takeScreenshot') {
    chrome.runtime.sendMessage({method: 'takeScreenshot'}, (screenshotURL) => {
      return screenshotURL;
    });
  }
});

/* Start a new record */
const record = (storyID) => {
  id = storyID;
  console.log('Recieved message record story '+id);
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
  unsavedSteps = JSON.parse(localStorage.getItem('steps'));
  recording = true;
  console.log('Continuing record : STEPS : '+JSON.stringify(unsavedSteps));
  bindEventsToRecord();
  // addStopButton();
  chrome.runtime.sendMessage({method: 'pending'}, (response) => {
    addStopButton();
    console.log('CHECKING FOR PENDING SS');
    if (response.pending) {
      console.log('FOUND PENDING SS', JSON.stringify(response));
      if (unsavedSteps[response.index].time == response.time) {
        unsavedSteps[response.index].screenshot = response.ss;
        localStorage.setItem('steps', JSON.stringify(unsavedSteps));
        console.log('ready');
      }
      chrome.runtime.sendMessage({method: 'updated'});
    }
  });
  // setTimeout(() => {
  //   chrome.runtime.sendMessage({method: 'pending'}, (response) => {
  //     addStopButton();
  //     console.log('CHECKING FOR PENDING SS');
  //     if (response.pending) {
  //       console.log('FOUND PENDING SS', JSON.stringify(response));
  //       if (unsavedSteps[response.index].time == response.time) {
  //         unsavedSteps[response.index].screenshot = response.ss;
  //         localStorage.setItem('steps', JSON.stringify(unsavedSteps));
  //         console.log('ready');
  //       }
  //       chrome.runtime.sendMessage({method: 'updated'});
  //     }
  //   });
  // }, 2000);
  // chrome.storage.sync.get(['steps'], (items) => {
  //   recording = true;
  //   unsavedSteps = items.steps;
  //   console.log('Continuing record : STEPS : '+JSON.stringify(unsavedSteps));
  //   bindEventsToRecord();
  //   addStopButton();
  // });
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

const notEnterClick = (el, time) => {
  if (unsavedSteps.length > 0) {
    const preStep = unsavedSteps[unsavedSteps.length-1];
    if (preStep.type == 'type' ) {
      if (preStep.keycode == 13 && preStep.xpath == getElementXPath(el)) {
        if (time - preStep.time < 10) {
          return false;
        }
      }
    }
    return true;
  }
};

/* Validated the click event UI Object */
const isValidClick = (el) => {
  const tag = el.tagName.toLowerCase();
  const type = el.getAttribute('type');

  if (['a', 'button'].indexOf(tag) !== -1) return true;
  else if (tag === 'input' && ['button', 'submit'].indexOf(type) !== -1) return true;
  if (el.parentElement && isValidClickParent(el.parentElement)) return true;
  return false;
};

const isValidClickParent = (el) => {
  const tag = el.tagName.toLowerCase();
  const type = el.getAttribute('type');

  if (['a', 'button'].indexOf(tag) !== -1) return true;
  else if (tag === 'input' && ['button', 'submit'].indexOf(type) !== -1) return true;
  return false;
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
  // const keycode = e.keyCode;
  // const el = e.target;
  // if ((keycode >= 48 && keycode <=57) || (keycode >= 65 && keycode <= 90)) return false;
  // if ([32, 9, 20, 16, 8, 46].indexOf(keycode) !== -1 && ['input', 'textarea'].indexOf(el.tagName.toLowerCase()) !== -1) return false;
  // return true;
  return false;
};

const onClick = (e) => {
  console.log('click '+Date.now());
  if (e.target.id == 'fyp-record-stop-btn') {
    stopRecord();
    return;
  } else if (!notEnterClick(e.target, Date.now())) {
    return;
  }
  if (!isValidClick(e.target)) return;
  const targetElement = e.target || e.srcElement;
  step = {};
  console.log('click on ' + getElementXPath(targetElement));
  step.type = 'click';
  step.x = e.clientX;
  step.y = e.clientY;
  step.UIObject = getUIObject(e.target || e.srcElement);
  // step.xpath = getElementXPath(targetElement);
  // step.keywords = generateElementKeywords(targetElement);
  step.time = Date.now();
  saveStep(step);
};

const onChange = (e) => {
  if (isValidSelect(e.target)) {
    const targetElement = e.target || e.srcElement;
    const selectedOption = getDropdownSelectedOption(e.target);
    console.log(
        'select ' + selectedOption + ' of ' + getElementXPath(targetElement)
    );
    step = {};
    step.type = 'select';
    step.selectedOption = selectedOption;
    step.UIObject = getUIObject(e.target || e.srcElement);
    // step.xpath = getElementXPath(targetElement);
    // step.keywords = generateElementKeywords(targetElement);
    step.time = Date.now();
    saveStep(step);
  } else if (isValidType(e.target)) {
    const value = (e.target.value || '').replace(/\n/g, '\\n');
    const targetElement = e.target || e.srcElement;
    console.log('type ' + value + ' on ' + getElementXPath(targetElement));
    step = {};
    step.type = 'type';
    step.value = value;
    step.UIObject = getUIObject(e.target || e.srcElement);
    // step.xpath = getElementXPath(targetElement);
    // step.keywords = generateElementKeywords(targetElement);
    step.time = Date.now();
    saveStep(step);
  }
};

const onKeyPress = (e) => {
  console.log('key press '+e.keyCode+' '+Date.now());
  if (!isValidKeyPress(e)) return;
  const targetElement = e.target || e.srcElement;
  console.log(
      'press ' + e.keyCode + ' on ' + getElementXPath(targetElement)
  );
  step = {};
  step.type = 'press';
  step.keyCode = e.keyCode;
  step.UIObject = getUIObject(e.target || e.srcElement);
  // step.xpath = getElementXPath(targetElement);
  // step.keywords = generateElementKeywords(targetElement);
  step.time = Date.now();
  saveStep(step);
};

const getUIObject = (e) => {
  const xpath = getElementXPath(e);
  const tagName = e.nodeName.toLowerCase();
  const elementID = e.getAttribute('id') ? e.getAttribute('id') : '';
  const name = e.getAttribute('name') ? e.getAttribute('name') : '';
  const placeholder = e.getAttribute('placeholder') ? e.getAttribute('placeholder') : '';
  const innerText = e.innerText ? e.innerText : '';
  const label = getLabelTextOfEl(e);
  return {
    tagName: tagName,
    elementID: elementID,
    name: name,
    xpath: xpath,
    label: label,
    innerText: innerText,
    placeholder: placeholder,
  };
};

// const getCheckBoxSelectedState = (e) => {
//   return e.target.checked;
// };

const getDropdownSelectedOption = (el) => {
  const value = el.value;
  const $option = Array.from(el.children).find(
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
  this.pendingSave = true;
  this.testMsg = 'PENDING SAVE '+step.type+' '+JSON.stringify(step.UIObject);
  console.log('saving step '+JSON.stringify(step));
  unsavedSteps.push(step);
  localStorage.setItem('steps', JSON.stringify(unsavedSteps));
  index = unsavedSteps.length-1;
  removeStopButton();
  chrome.runtime.sendMessage({method: 'takeScreenshot', index: index, time: step.time}, (response) => {
    addStopButton();
    unsavedSteps[unsavedSteps.length-1].screenshot = response.imgSrc;
    localStorage.setItem('steps', JSON.stringify(unsavedSteps));
    console.log('saved step '+JSON.stringify(step));
    this.pendingSave = false;
    this.testMsg = 'SAVED '+step.type+' '+JSON.stringify(step.UIObject);
    chrome.runtime.sendMessage({method: 'updated'});
  });
};

const setSteps = (stepsList) => {
  localStorage.setItem('steps', JSON.stringify(stepsList));
};

const sendToAgent = () => {
  console.log('Steps : \n' + JSON.stringify(unsavedSteps));
  const xhr = new XMLHttpRequest();
  xhr.open('POST', server+'/record/stop', true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify({id: id, steps: unsavedSteps}));
  console.log(JSON.stringify({id: id, steps: unsavedSteps}));
};

const addStopButton = () => {
  const div = document.createElement('DIV');
  div.id = 'fyp-record-stop-btn-div';
  const btn = document.createElement('BUTTON');
  btn.id = 'fyp-record-stop-btn';
  btn.classList.add('fyp-record-stop-btn');
  const btnText = document.createTextNode('Stop Recording');
  btn.appendChild(btnText);
  div.appendChild(btn);
  document.body.appendChild(div);
};

const removeStopButton = () => {
  document.body.removeChild(document.getElementById('fyp-record-stop-btn-div'));
};

window.onbeforeunload = (event) => {
  console.log('STATUS : '+this.testMsg);
  // while (this.pendingSave) {
  //   console.log('waiting for steps to save');
  //   console.log(this.testMsg);
  // }
  // if (recording) {
  //   localStorage.setItem('steps', JSON.stringify(unsavedSteps));
  // }
};
