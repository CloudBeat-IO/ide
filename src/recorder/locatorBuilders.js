/*
 * Copyright 2005 Shinya Kasatani
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

function LocatorBuilders(window) {
  this.window = window;
}

LocatorBuilders.prototype.detach = function() {
  if (this.window._locator_pageBot) {
    console.log(this.window);
    this.window._locator_pageBot = undefined;
    // Firefox 3 (beta 5) throws "Security Manager vetoed action" when we use delete operator like this:
    // delete this.window._locator_pageBot;
  }
};

LocatorBuilders.prototype.pageBot = function() {
  var pageBot = this.window._locator_pageBot;
  if (pageBot == null) {
    pageBot = new MozillaBrowserBot(this.window);
    var self = this;
    pageBot.getCurrentWindow = function() {
      return self.window;
    };
    this.window._locator_pageBot = pageBot;
  }
  return pageBot;
};

LocatorBuilders.prototype.buildWith = function(name, e, opt_contextNode) {
  return LocatorBuilders.builderMap[name].call(this, e, opt_contextNode);
};

LocatorBuilders.prototype.elementEquals = function(name, e, locator) {
  var fe = this.findElement(locator);
  //TODO: add match function to the ui locator builder, note the inverted parameters
  return (e == fe) || (LocatorBuilders.builderMap[name] && LocatorBuilders.builderMap[name].match && LocatorBuilders.builderMap[name].match(e, fe));
};

LocatorBuilders.prototype.build = function(e) {
  var locators = this.buildAll(e);
  if (locators.length > 0) {
    return locators[0][0];
  } else {
    return "LOCATOR_DETECTION_FAILED";
  }
};

LocatorBuilders.prototype.buildAll = function(el) {
  var xpathLevel = 0;
  var maxLevel = 10;
  var locator;
  var locators = [];

  var coreLocatorStrategies = this.pageBot().locationStrategies;
  for (var i = 0; i < LocatorBuilders.order.length; i++) {
    var finderName = LocatorBuilders.order[i];
   // console.log("trying " + finderName);
    try {
      locator = this.buildWith(finderName, el);
      if (locator) {
        locator = String(locator);
        //TODO: the builderName should NOT be used as a strategy name, create a feature to allow locatorBuilders to specify this kind of behaviour
        //TODO: Useful if a builder wants to capture a different element like a parent. Use the this.elementEquals
        var fe = this.findElement(locator);
        if ((el == fe) || (coreLocatorStrategies[finderName] && coreLocatorStrategies[finderName].is_fuzzy_match && coreLocatorStrategies[finderName].is_fuzzy_match(fe, el))) {
          locators.push([ locator, finderName ]);
        }
      }
    } catch (e) {
      // TODO ignore the buggy locator builder for now
      console.log("locator exception: " + e.message);
    }
  }
  return locators;
};

LocatorBuilders.prototype.findElement = function (locator) {
    //console.log("finding element. locator: " + locator);
  try {
    return this.pageBot().findElement(locator);
  } catch (error) {
    //console.log("findElement failed: " + error + ", locator=" + locator);
    return null;
  }
};

LocatorBuilders.order = [];
LocatorBuilders.builderMap = {};
LocatorBuilders._preferredOrder = [];
classObservable(LocatorBuilders);

LocatorBuilders.add = function(name, finder) {
  this.order.push(name);
  this.builderMap[name] = finder;
  this._orderChanged();
};

/**
 * Call when the order or preferred order changes
 */
LocatorBuilders._orderChanged = function () {
  var changed = this._ensureAllPresent(this.order, this._preferredOrder);
  this._sortByRefOrder(this.order, this._preferredOrder);
  if (changed) {
    this.notify('preferredOrderChanged', this._preferredOrder);
  }
};

/**
 * Set the preferred order of the locator builders
 *
 * @param preferredOrder can be an array or a comma separated string of names
 */
LocatorBuilders.setPreferredOrder = function(preferredOrder) {
  if (typeof preferredOrder === 'string') {
    this._preferredOrder = preferredOrder.split(',');
  } else {
    this._preferredOrder = preferredOrder;
  }
  this._orderChanged();
};

/**
 * Returns the locator builders preferred order as an array
 */
LocatorBuilders.getPreferredOrder = function() {
  return this._preferredOrder;
};

/**
 * Sorts arrayToSort in the order of elements in sortOrderReference
 * @param arrayToSort
 * @param sortOrderReference
 */
LocatorBuilders._sortByRefOrder = function(arrayToSort, sortOrderReference) {
  var raLen = sortOrderReference.length;
  arrayToSort.sort(function(a, b) {
    var ai = sortOrderReference.indexOf(a);
    var bi = sortOrderReference.indexOf(b);
    return (ai > -1 ? ai : raLen) - (bi > -1 ? bi : raLen);
  });
};

/**
 * Function to add to the bottom of destArray elements from source array that do not exist in destArray
 * @param sourceArray
 * @param destArray
 */
LocatorBuilders._ensureAllPresent = function(sourceArray, destArray) {
  var changed = false;
  sourceArray.forEach(function(e) {
    if (destArray.indexOf(e) == -1) {
      destArray.push(e);
      changed = true;
    }
  });
  return changed;
};

/*
 * Utility function: Encode XPath attribute value.
 */
LocatorBuilders.prototype.attributeValue = function(value) {
  if (value.indexOf("'") < 0) {
    return "'" + value + "'";
  } else if (value.indexOf('"') < 0) {
    return '"' + value + '"';
  } else {
    var result = 'concat(';
    var part = "";
    while (true) {
      var apos = value.indexOf("'");
      var quot = value.indexOf('"');
      if (apos < 0) {
        result += "'" + value + "'";
        break;
      } else if (quot < 0) {
        result += '"' + value + '"';
        break;
      } else if (quot < apos) {
        part = value.substring(0, apos);
        result += "'" + part + "'";
        value = value.substring(part.length);
      } else {
        part = value.substring(0, quot);
        result += '"' + part + '"';
        value = value.substring(part.length);
      }
      result += ',';
    }
    result += ')';
    return result;
  }
};

LocatorBuilders.prototype.xpathHtmlElement = function(name) {
  if (this.window.document.contentType == 'application/xhtml+xml') {
    // "x:" prefix is required when testing XHTML pages
    return "x:" + name;
  } else {
    return name;
  }
};

LocatorBuilders.prototype.relativeXPathFromParent = function(current) {
  var index = this.getNodeNbr(current);
  var currentPath = '/' + this.xpathHtmlElement(current.nodeName.toLowerCase());
  if (index > 0) {
    currentPath += '[' + (index + 1) + ']';
  }
  return currentPath;
};

LocatorBuilders.prototype.getNodeNbr = function(current) {
  var childNodes = current.parentNode.childNodes;
  var total = 0;
  var index = -1;
  for (var i = 0; i < childNodes.length; i++) {
    var child = childNodes[i];
    if (child.nodeName == current.nodeName) {
      if (child == current) {
        index = total;
      }
      total++;
    }
  }
  return index;
};

LocatorBuilders.prototype.getCSSSubPath = function(e) {
  var css_attributes = ['id', 'name', 'class', 'type', 'alt', 'title', 'value'];
  for (var i = 0; i < css_attributes.length; i++) {
    var attr = css_attributes[i];
    var value = e.getAttribute(attr);
    if (value) {
      if (attr == 'id')
        return '#' + value;
      if (attr == 'class')
        return e.nodeName.toLowerCase() + '.' + value.replace(" ", ".").replace("..", ".");
      return e.nodeName.toLowerCase() + '[' + attr + '="' + value + '"]';
    }
  }
  if (this.getNodeNbr(e))
    return e.nodeName.toLowerCase() + ':nth-of-type(' + this.getNodeNbr(e) + ')';
  else
    return e.nodeName.toLowerCase();
};

LocatorBuilders.prototype.preciseXPath = function(xpath, e){
  //only create more precise xpath if needed
  if (this.findElement(xpath) != e) {
    var result = e.ownerDocument.evaluate(xpath, e.ownerDocument, null, 7, null);
    //skip first element (result:0 xpath index:1)
    for (var i=0, len=result.snapshotLength; i < len; i++) {
      var newPath = 'xpath=(' +  xpath + ')[' + (i +1 )+']';
      if ( this.findElement(newPath) == e ) {
          return newPath ;
      }
    }
  }
  return xpath;
}

/* ===== builders ===== */

LocatorBuilders.add('id', function(e) {
  if (e.id) {
    return 'id=' + e.id;
  }
  return null;
});

LocatorBuilders.add('link', function(e) {
  if (e.nodeName == 'A') {
    var text = e.textContent;
    if (!text.match(/^\s*$/)) {
      return "link=" + text.replace(/\xA0/g, " ").replace(/^\s*(.*?)\s*$/, "$1");
    }
  }
  return null;
});

LocatorBuilders.add('name', function(e) {
  if (e.name) {
    return 'name=' + e.name;
  }
  return null;
});

LocatorBuilders.add('css', function(e) {
  var current = e;
  var sub_path = this.getCSSSubPath(e);
  while (this.findElement("css=" + sub_path) != e && current.nodeName.toLowerCase() != 'html') {
    sub_path = this.getCSSSubPath(current.parentNode) + ' > ' + sub_path;
    current = current.parentNode;
  }
  return "css=" + sub_path;
});

/*
 * This function is called from DOM locatorBuilders
 */
LocatorBuilders.prototype.findDomFormLocator = function(form) {
  if (form.getAttribute('name') != null) {
    var name = form.getAttribute('name');
    var locator = "document." + name;
    if (this.findElement(locator) == form) {
      return locator;
    }
    locator = "document.forms['" + name + "']";
    if (this.findElement(locator) == form) {
      return locator;
    }
  }
  var forms = this.window.document.forms;
  for (var i = 0; i < forms.length; i++) {
    if (form == forms[i]) {
      return "document.forms[" + i + "]";
    }
  }
  return null;
};

LocatorBuilders.add('dom:name', function(e) {
  if (e.form && e.name) {
    var formLocator = this.findDomFormLocator(e.form);
    if (formLocator) {
      var candidates = [formLocator + "." + e.name,
        formLocator + ".elements['" + e.name + "']"];
      for (var c = 0; c < candidates.length; c++) {
        var locator = candidates[c];
        var found = this.findElement(locator);
        if (found) {
          if (found == e) {
            return locator;
          } else if (found instanceof NodeList) {
            // multiple elements with same name
            for (var i = 0; i < found.length; i++) {
              if (found[i] == e) {
                return locator + "[" + i + "]";
              }
            }
          }
        }
      }
    }
  }
  return null;
});

LocatorBuilders.add('xpath:link', function(e) {
  if (e.nodeName == 'A') {
    var text = e.textContent;
    if (!text.match(/^\s*$/)) {
      return this.preciseXPath("//" + this.xpathHtmlElement("a") + "[contains(text(),'" + text.replace(/^\s+/, '').replace(/\s+$/, '') + "')]", e);
    }
  }
  return null;
});

LocatorBuilders.add('xpath:img', function(e) {
  if (e.nodeName == 'IMG') {
    if (e.alt != '') {
      return this.preciseXPath("//" + this.xpathHtmlElement("img") + "[@alt=" + this.attributeValue(e.alt) + "]", e);
    } else if (e.title != '') {
      return this.preciseXPath("//" + this.xpathHtmlElement("img") + "[@title=" + this.attributeValue(e.title) + "]", e);
    } else if (e.src != '') {
      return this.preciseXPath("//" + this.xpathHtmlElement("img") + "[contains(@src," + this.attributeValue(e.src) + ")]", e);
    }
  }
  return null;
});

LocatorBuilders.add('xpath:attributes', function(e) {
  var PREFERRED_ATTRIBUTES = ['id', 'name', 'value', 'type', 'action', 'onclick'];
  var i = 0;

  function attributesXPath(name, attNames, attributes) {
    var locator = "//" + this.xpathHtmlElement(name) + "[";
    for (i = 0; i < attNames.length; i++) {
      if (i > 0) {
        locator += " and ";
      }
      var attName = attNames[i];
      locator += '@' + attName + "=" + this.attributeValue(attributes[attName]);
    }
    locator += "]";
    return this.preciseXPath(locator, e);
  }

  if (e.attributes) {
    var atts = e.attributes;
    var attsMap = {};
    for (i = 0; i < atts.length; i++) {
      var att = atts[i];
      attsMap[att.name] = att.value;
    }
    var names = [];
    // try preferred attributes
    for (i = 0; i < PREFERRED_ATTRIBUTES.length; i++) {
      var name = PREFERRED_ATTRIBUTES[i];
      if (attsMap[name] != null) {
        names.push(name);
        var locator = attributesXPath.call(this, e.nodeName.toLowerCase(), names, attsMap);
        if (e == this.findElement(locator)) {
          return locator;
        }
      }
    }
  }
  return null;
});

LocatorBuilders.add('xpath:idRelative', function(e) {
  var path = '';
  var current = e;
  while (current != null) {
    if (current.parentNode != null) {
      path = this.relativeXPathFromParent(current) + path;
      if (1 == current.parentNode.nodeType && // ELEMENT_NODE
          current.parentNode.getAttribute("id")) {
        return this.preciseXPath("//" + this.xpathHtmlElement(current.parentNode.nodeName.toLowerCase()) +
            "[@id=" + this.attributeValue(current.parentNode.getAttribute('id')) + "]" +
            path, e);
      }
    } else {
      return null;
    }
    current = current.parentNode;
  }
  return null;
});

LocatorBuilders.add('xpath:href', function(e) {
  if (e.attributes && e.getAttribute("href") != null) {
    href = e.getAttribute("href");
    if (href.search(/^http?:\/\//) >= 0) {
      return this.preciseXPath("//" + this.xpathHtmlElement("a") + "[@href=" + this.attributeValue(href) + "]", e);
    } else {
      // use contains(), because in IE getAttribute("href") will return absolute path
      return this.preciseXPath("//" + this.xpathHtmlElement("a") + "[contains(@href, " + this.attributeValue(href) + ")]",e);
    }
  }
  return null;
});

LocatorBuilders.add('dom:index', function(e) {
  if (e.form) {
    var formLocator = this.findDomFormLocator(e.form);
    if (formLocator) {
      var elements = e.form.elements;
      for (var i = 0; i < elements.length; i++) {
        if (elements[i] == e) {
          return formLocator + ".elements[" + i + "]";
        }
      }
    }
  }
  return null;
});

LocatorBuilders.add('xpath:position', function(e, opt_contextNode) {
 // console.log("positionXPath: e=" + e);
  var path = '';
  var current = e;
  while (current != null && current != opt_contextNode) {
    var currentPath;
    if (current.parentNode != null) {
      currentPath = this.relativeXPathFromParent(current);
    } else {
      currentPath = '/' + this.xpathHtmlElement(current.nodeName.toLowerCase());
    }
    path = currentPath + path;
    var locator = '/' + path;
    if (e == this.findElement(locator)) {
      return locator;
    }
    current = current.parentNode;
    console.log("positionXPath: current=" + current);
  }
  return null;
});