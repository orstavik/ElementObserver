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
      return now.toString();
    }
  }

  class ConstructionFrame {

    #children = [];
    #elements = [];

    constructor(name) {
      this.name = name;
      this.parent = now;
      now = this;
      this.parent?.#children.push(this);
    }

    * descendants() {
      yield this;
      for (let c of this.#children)
        yield* c.descendants();
    }

    toString() {
      return (this.parent ? this.parent.toString() + ', ' : '') + this.name;
    }

    callEnd(el) {
      this.#elements.push(el);
      for (let cb of endObservers)
        cb(el);
    }

    end() {
      now = this.parent;
      if (!now)
        for (let c of this.descendants())
          for (let el of c.#elements)
            for (let cb of completeObservers)
              cb(el);
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
    const created = og.call(this, ...args);  //todo we need a try catch around the frame so that it ends. This applies to most of the functions?
    frame.callEnd(created)
    frame.end();
    return created;
  });

  MonkeyPatch.monkeyPatch(Element.prototype, "insertAdjacentHTML", function insertAdjacentHTML_constructHtmlElement(og, position, ...args) {
    const frame = new ConstructionFrame("InsertAdjacentHTML");
    const root = position === 'beforebegin' || position === 'afterend' ? this.parentNode : this;
    const before = root && [...root.querySelectorAll('*')];//if root is parent, and there is no parent, the og.call will throw an error
    og.call(this, position, ...args);
    for (let el of root.querySelectorAll('*'))
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
    now = undefined;            //when now is a predictive frame, then let it loose. When predictive frames fail, then it is simply lost. No problem.
    for (let el of e.endedElements()) {   //it is a problem to run this in "first end tag read", because this is not simply a reverse call..
      now = frames.get(el) || new ConstructionFrame("Parser");
      now.callEnd(el);
      now.end();
    }
  }

  window.addEventListener('parse', onParserBreak, true);

  class PredictiveConstructionFrameHTMLElement extends HTMLElement {
    constructor() {
      super();
      !upgradeStart && !now && frames.set(this, new ConstructionFrame("Predictive"));
    }
  }

  MonkeyPatch.injectClassWhileLoading(HTMLElement, PredictiveConstructionFrameHTMLElement);
})();