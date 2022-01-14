(function initConstructionFrameAPI() {
  let now;

  window.ConstructionFrame = class ConstructionFrame {

    #children = [];
    #parent;
    #state = "start";
    #elements = [];
    #name;

    static #observers = {'end': [], 'complete': []};

    constructor(name) {
      this.#parent = now;
      this.#name = name;
      now = this;
      this.#parent?.#children.push(this);
    }

    #callObservers(state, elements) {
      const observers = ConstructionFrame.#observers[this.#state = state];
      for (let el of elements)
        for (let cb of observers)
          cb(this, el);
    }

    #complete() {
      this.#callObservers('complete', this.elements());
      this.#children.forEach(frame => frame.#complete());
    }

    get parent() {
      return this.#parent;
    }

    elements() {
      return this.#elements;
    }

    get state() {
      return this.#state;
    }

    toString() {
      const parent = this.#parent ? this.#parent.toString() + ', ' : '';
      return parent + this.#name + '#' + this.#state;
    }

    static get now() {
      return now;
    }

    static dropNow() {
      now = undefined;
    }

    static observe(state, cb) {
      this.#observers[state].push(cb);
    }

    static disconnect(state, cb) {
      const pos = this.#observers[state].indexOf(cb);
      pos >= 0 && this.#observers[state].splice(pos, 1);
    }

    callEnd(element) {
      this.#state = 'end';
      this.#elements.push(element);
      for (let cb of ConstructionFrame.#observers['end'])
        cb(this, element);
    }

    end(elements) {
      for (let e of elements)
        this.callEnd(e);
      !this.#parent && this.#complete();
      now = this.#parent;
    }
  }

  function innerHTML_constructionFrame(og, val) {
    const frame = new ConstructionFrame("InnerHTML");
    og.call(this, val);
    frame.end(this.querySelectorAll('*'));
  }

  MonkeyPatch.monkeyPatchSetter(Element.prototype, "innerHTML", innerHTML_constructionFrame);
  MonkeyPatch.monkeyPatchSetter(ShadowRoot.prototype, "innerHTML", innerHTML_constructionFrame);

  MonkeyPatch.monkeyPatch(Node.prototype, "cloneNode", function cloneNode_constructionFrame(og, ...args) {
    const frame = new ConstructionFrame("CloneNode");
    const clone = og.call(this, ...args);
    frame.end([clone, ...clone.querySelectorAll('*')]);
    return clone;
  });

  MonkeyPatch.monkeyPatch(Document.prototype, "createElement", function createElement_constructionFrame(og, ...args) {
    const frame = new ConstructionFrame("DocumentCreateElement");
    const created = og.call(this, ...args);
    frame.end([created]);
    return created;
  });

  MonkeyPatch.monkeyPatch(Element.prototype, "insertAdjacentHTML", function insertAdjacentHTML_constructHtmlElement(og, position, ...args) {
    const frame = new ConstructionFrame("InsertAdjacentHTML");
    const root = position === 'beforebegin' || position === 'afterend' ? this.parentNode : this;
    const before = root && [...root.children];//checking for root in order to get good error messages for missing parent on beforebegin and afterend.
    og.call(this, position, ...args);
    frame.end([...root.children].filter(el => before.indexOf(el) === -1));
  });
})();
/*
 * UPGRADE, depends on ConstructionFrame
 */
(function () {

  const frameToEl = new WeakMap();
  let upgradeStart;
  MonkeyPatch.monkeyPatch(CustomElementRegistry.prototype, "define", function createElement_constructionFrame(og, ...args) {
    try {
      upgradeStart = true;
      og.call(this, ...args);
    } catch (err) {
      upgradeStart = undefined;
      throw err;
    }
    if (upgradeStart)                      //no upgrade
      upgradeStart = undefined;
    else                                   //end last upgrade
      ConstructionFrame.now.end([frameToEl.get(ConstructionFrame.now)]);
  });

  window.HTMLElement = class UpgradeConstructionFrameHTMLElement extends HTMLElement {
    constructor() {
      super();
      if (upgradeStart)
        frameToEl.set(new ConstructionFrame("Upgrade"), this), upgradeStart = undefined;
      else if (!upgradeStart && frameToEl.has(ConstructionFrame.now))
        ConstructionFrame.now.end([frameToEl.get(ConstructionFrame.now)]), frameToEl.set(new ConstructionFrame("Upgrade"), this);
    }
  }

  /*
   * PREDICTIVE PARSER, depends on UPGRADE
   */
  if (document.readyState !== 'loading')
    return;

  const frames = new WeakMap();

  function onParserBreak(e) {
    ConstructionFrame.dropNow(); //if there is a predictive frame, then let it loose.
    const parser = [];
    let endedNodes = [...e.endedNodes()];
    for (let ended of endedNodes) {
      if (ended instanceof Element) {
        const predictiveFrame = frames.get(ended);
        if (predictiveFrame)
          predictiveFrame.end([ended]);
        else
          parser.push(ended);
      }
    }
    parser.length && new ConstructionFrame("Parser").end(parser);
  }

  window.addEventListener('parser-break', onParserBreak, true);

  class PredictiveConstructionFrameHTMLElement extends HTMLElement {
    constructor() {
      super();
      !upgradeStart && !ConstructionFrame.now && frames.set(this, new ConstructionFrame("Predictive"));
    }
  }

  MonkeyPatch.injectClassWhileLoading(HTMLElement, PredictiveConstructionFrameHTMLElement);
})();