(function initConstructionFrameAPI() {
  let now;
  const endObservers = [];
  const completeObservers = [];

  window.ElementObserver = class ElementObserver {
    static end(cb) {
      endObservers.push(cb);
    }

    static complete(cb) {
      completeObservers.push(cb);
    }

    static get now() {
      return now;
    }
  }

  class ConstructionFrame {

    #children = [];
    #parent;
    #state = "start";
    #elements = [];
    #name;

    //todo simplify now.. #state.. do not expose the ConstructionFrame anymore? Or just expose it as a method that you can use to read the state at any given point.

    //todo childchangedCallback and the rec object. we also need to add those that are not flatdom slotted, but only directly slotted.

    constructor(name) {
      this.#name = name;
      this.#parent = now;
      now = this;
      this.#parent?.#children.push(this);
    }

    * descendants() {                 //todo the cb should not have anything but the element.
      yield this;                    // then the frame is only a string
      for (let c of this.#children)  // the state of the frame, is that necessary? Or is it only necessary to know the now? yes, only now..
        yield* c.descendants();
    }

    toString() {
      const parent = this.#parent ? this.#parent.toString() + ', ' : '';
      return parent + this.#name + '#' + this.#state;
    }

    callEnd(element) {
      this.#state = 'end';
      this.#elements.push(element);
      for (let cb of endObservers)
        cb(element);
    }

    end() {
      now = this.#parent;
      if (this.#parent)
        return;
      for (let c of this.descendants()) {
        c.#state = 'complete';
        for (let el of c.#elements)
          for (let cb of completeObservers)
            cb(c, el);
      }
    }
  }

  function innerHTML_constructionFrame(og, val) {
    const frame = new ConstructionFrame("InnerHTML");
    og.call(this, val);
    for (let el of this.querySelectorAll('*'))
      frame.callEnd(el);
    frame.end();
  }

  MonkeyPatch.monkeyPatchSetter(Element.prototype, "innerHTML", innerHTML_constructionFrame);
  MonkeyPatch.monkeyPatchSetter(ShadowRoot.prototype, "innerHTML", innerHTML_constructionFrame);

  MonkeyPatch.monkeyPatch(Node.prototype, "cloneNode", function cloneNode_constructionFrame(og, deep, ...args) {
    const frame = new ConstructionFrame("CloneNode");
    const clone = og.call(this, deep, ...args);
    frame.callEnd(clone);
    if (deep)
      for (let el of clone.querySelectorAll('*'))
        frame.callEnd(el);
    frame.end();
    return clone;
  });

  MonkeyPatch.monkeyPatch(Document.prototype, "createElement", function createElement_constructionFrame(og, ...args) {
    const frame = new ConstructionFrame("DocumentCreateElement");
    const created = og.call(this, ...args);
    frame.callEnd(created)
    frame.end();
    return created;
  });

  MonkeyPatch.monkeyPatch(Element.prototype, "insertAdjacentHTML", function insertAdjacentHTML_constructHtmlElement(og, position, ...args) {
    const frame = new ConstructionFrame("InsertAdjacentHTML");
    const root = position === 'beforebegin' || position === 'afterend' ? this.parentNode : this;
    const before = root && [...root.querySelectorAll('*')];//checking for root in order to get good error messages for missing parent on beforebegin and afterend.
    og.call(this, position, ...args);
    for (let el of root.querySelectorAll('*'))   //todo run this in reverse
      if (!before || before.indexOf(el) === -1)
        frame.callEnd(el);
    frame.end();
  });

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
      now.callEnd(frameToEl.get(now)), now.end();
  });

  window.HTMLElement = class UpgradeConstructionFrameHTMLElement extends HTMLElement {
    constructor() {
      super();
      if (upgradeStart)
        upgradeStart = undefined, frameToEl.set(new ConstructionFrame("Upgrade"), this);
      else if (!upgradeStart && frameToEl.has(now))
        now.callEnd(frameToEl.get(now)), now.end(), frameToEl.set(new ConstructionFrame("Upgrade"), this);
    }//todo this is wrong i think, i think that if we do an innerHTML from a script, that triggers upgrade, then we will have a problem.
  }

  if (document.readyState !== 'loading')
    return;

  const frames = new WeakMap();

  function onParserBreak(e) {
    now = undefined;                      //when now is a predictive frame, then let it loose.
    for (let el of e.endedElements()) {   //it is a problem to run this in "first end tag read", because this is not simply a reverse call..
      now = frames.get(el) || new ConstructionFrame("Parser");
      now.callEnd(el);
      now.end();
    }
  }

  window.addEventListener('parser-break', onParserBreak, true);

  class PredictiveConstructionFrameHTMLElement extends HTMLElement {
    constructor() {
      super();
      !upgradeStart && !now && frames.set(this, new ConstructionFrame("Predictive"));
    }
  }

  MonkeyPatch.injectClassWhileLoading(HTMLElement, PredictiveConstructionFrameHTMLElement);
})();