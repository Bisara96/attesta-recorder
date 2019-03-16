function getPathTo(element) {
  if (element.id !== "") return '[@id="' + element.id + '"]';
  if (element === document.body) return element.tagName;

  var ix = 0;
  var siblings = element.parentNode.childNodes;
  for (var i = 0; i < siblings.length; i++) {
    var sibling = siblings[i];
    if (sibling === element)
      return (
        getPathTo(element.parentNode) +
        "/" +
        element.tagName +
        "[" +
        (ix + 1) +
        "]"
      );
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
  }
}

console.log("loaded and running");

$(document).on("click", function(event) {
  step = {};
  var targetElement = event.target || event.srcElement;
  alert("hi");
  console.log("click on " + getPathTo(targetElement));
});
$(document).on("keyup", function(event) {
  step = {};
  var targetElement = event.target || event.srcElement;
  console.log(
    "type " + event.keyCode + " on " + getPathTo(targetElement)
  );
});

// window.addEventListener("load", function() {
//   console.log("hi");
//   window.addEventListener("click", function(event) {
//     var targetElement = event.target || event.srcElement;
//     console.log("click on " + getPathTo(targetElement));
//   });
// });
