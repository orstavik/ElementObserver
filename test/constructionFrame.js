(function initConstructionFrameAPI() {
  let now;

  class ConstructionFrame {

    #children = [];
    #parent;
    #state = "start";
    #elements;
    #name;

    static #observers = {'end': [], 'complete': []};

    constructor(name) {
      this.#parent = now;
      this.#name = name || this.constructor.name.slice(0, -17);
      now = this;
      this.#parent?.#children.push(this);
    }

    #callObservers(state) {
      const observers = ConstructionFrame.#observers[this.#state = state];
      for (let el of this.elements())
        for (let cb of observers)
          cb(this, el);
    }

    #complete() {
      this.#callObservers('complete');
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

    end(elements = [...this.elementsImpl()]) {
      this.#elements = elements;
      this.#callObservers('end');
      !this.#parent && this.#complete();
      now = this.#parent;
    }
  }

  window.ConstructionFrame = ConstructionFrame;

  function* recursiveElements(n) {
    yield n;
    if (n.children)
      for (let c of n.children)
        yield* recursiveElements(c);
  }

  // class DocumentCreateElementConstructionFrame extends ConstructionFrame {
    // #el;
    //
    // end(created) {
    //   this.#el = created;
    //   super.end();
      // return created;
    // }
    //
    // * elementsImpl() {
    //   yield this.#el;
    // }
  // }

  // class CloneNodeConstructionFrame extends ConstructionFrame {
    // #clone;

    // end(clone) {
      // this.#clone = clone;
      // super.end([...recursiveElements(clone)]);
      // return clone;
    // }

    // * elementsImpl() {
    //   yield* recursiveElements(this.#clone);
    // }
  // }

  function* recursiveOfChildren(el) {
    for (let n of el.children)
      yield* recursiveElements(n);
  }

  // class InnerHTMLConstructionFrame extends ConstructionFrame {
    // #el;

    // end(el) {
      // this.#el = el;
      // super.end([...recursiveOfChildren(el)]);
    // }

    //
    // * elementsImpl(el) {
    //   for (let n of this.#el.children)
    //     yield* recursiveElements(n);
    // }
  // }

  function innerHTML_constructionFrame(og, val) {
    const frame = new ConstructionFrame("InnerHTML");
    og.call(this, val);
    frame.end([...recursiveOfChildren(this)]);
  }

  MonkeyPatch.monkeyPatchSetter(Element.prototype, "innerHTML", innerHTML_constructionFrame);
  MonkeyPatch.monkeyPatchSetter(ShadowRoot.prototype, "innerHTML", innerHTML_constructionFrame);

  MonkeyPatch.monkeyPatch(Node.prototype, "cloneNode", function cloneNode_constructionFrame(og, ...args) {
    const frame = new ConstructionFrame("CloneNode");
    const clone = og.call(this, ...args);
    frame.end([...recursiveElements(clone)]);
    return clone;
  });

  MonkeyPatch.monkeyPatch(Document.prototype, "createElement", function createElement_constructionFrame(og, ...args) {
    const frame = new ConstructionFrame("DocumentCreateElement");
    const created = og.call(this, ...args);
    frame.end([created]);
    return created;
  });

function * elementsImplx(d /*= this.#d*/) {
    if (d.position === 'beforebegin') {
      for (let n = d.previousSibling?.nextSibling || d.element.parentNode?.firstChild; n && n !== d.element; n = n.nextSibling)
        if (n instanceof Element) yield* recursiveElements(n);
    } else if (d.position === 'afterend') {
      for (let n = d.element.nextSibling; n && n !== d.nextSibling; n = n.nextSibling)
        if (n instanceof Element) yield* recursiveElements(n);
    } else if (d.position === 'afterbegin') {
      for (let n = d.element.firstChild; n && n !== d.firstChild; n = n.nextSibling)
        if (n instanceof Element) yield* recursiveElements(n);
    } else if (d.position === 'beforeend') {
      for (let n = d.lastChild?.nextSibling || d.element.firstChild; n; n = n.nextSibling)
        if (n instanceof Element) yield* recursiveElements(n);
    }
  }


  // class InsertAdjacentHTMLConstructionFrame extends ConstructionFrame {
    // #d;

    // end({position, element, previousSibling, lastChild, firstChild, nextSibling}) {
      // this.#d = ;
      // super.end([...elementsImplx({position, element, previousSibling, lastChild, firstChild, nextSibling})]);
    // }

    // * elementsImpl(d /*= this.#d*/) {
    //   if (d.position === 'beforebegin') {
    //     for (let n = d.previousSibling?.nextSibling || d.element.parentNode?.firstChild; n && n !== d.element; n = n.nextSibling)
    //       if (n instanceof Element) yield* recursiveElements(n);
    //   } else if (d.position === 'afterend') {
    //     for (let n = d.element.nextSibling; n && n !== d.nextSibling; n = n.nextSibling)
    //       if (n instanceof Element) yield* recursiveElements(n);
    //   } else if (d.position === 'afterbegin') {
    //     for (let n = d.element.firstChild; n && n !== d.firstChild; n = n.nextSibling)
    //       if (n instanceof Element) yield* recursiveElements(n);
    //   } else if (d.position === 'beforeend') {
    //     for (let n = d.lastChild?.nextSibling || d.element.firstChild; n; n = n.nextSibling)
    //       if (n instanceof Element) yield* recursiveElements(n);
    //   }
    // }
  // }

  MonkeyPatch.monkeyPatch(Element.prototype, "insertAdjacentHTML", function insertAdjacentHTML_constructHtmlElement(og, position, ...args) {
    const {previousSibling, lastChild, firstChild, nextSibling} = this;
    const frame = new ConstructionFrame("InsertAdjacentHTML");
    og.call(this, position, ...args);
    frame.end([...elementsImplx({position, element: this, previousSibling, lastChild, firstChild, nextSibling})]);
  });
})();
/*
 * UPGRADE, depends on ConstructionFrame
 */
(function () {
  class UpgradeConstructionFrame extends ConstructionFrame {
    #tagName;
    #el;

    constructor(tagName, el) {
      super();
      this.#el = el;
      this.#tagName = tagName;
    }

    chain(el) {
      if (!this.#el) return this.#el = el; //if this is the first upgraded element, then just update the element in the frame
      super.end();                                       //otherwise, end the previous element frame,
      new UpgradeConstructionFrame(this.#tagName, el);   //and start a new frame
    }

    * elementsImpl() {
      if (this.#el) yield this.#el;
    }
  }

  MonkeyPatch.monkeyPatch(CustomElementRegistry.prototype, "define", function createElement_constructionFrame(og, ...args) {
    new UpgradeConstructionFrame(args[0]);
    og.call(this, ...args);
    ConstructionFrame.now.end();
  });

  window.HTMLElement = class UpgradeConstructionFrameHTMLElement extends HTMLElement {
    constructor() {
      super();
      ConstructionFrame.now instanceof UpgradeConstructionFrame && ConstructionFrame.now.chain(this);
    }
  }
})();
/*
 * PREDICTIVE PARSER, depends on UPGRADE
 */
(function () {

  if (document.readyState !== 'loading')
    return;

  function* recursiveElementsWithSkips(el, skips) {
    yield el;
    for (let c of el.children)
      if (skips.indexOf(c) < 0)
        yield* recursiveElementsWithSkips(c, skips);
  }

  function * elementsImplY(el, skips) {
    for (let n of recursiveElementsWithSkips(/*this.#*/el, /*this.#*/skips))
      yield n;
  }

  class PredictiveConstructionFrame extends ConstructionFrame {

    #el;
    #skips;

    constructor(el) {
      super();
      this.#el = el;
    }

    end(skips) {
      if (!this.#el.isConnected) return;   //if the constructor fails, then the PredictiveConstructionFrame should also fail as such.
      this.#skips = skips;
      super.end([...elementsImplY(this.#el, skips)]);
    }

    get el() {
      return this.#el;
    }

  }
  function * elementsImplZ(nodes) {
    for (let n of /*this.#*/nodes)
      if (n instanceof Element)
        yield n;
  }

  // class ParserConstructionFrame extends ConstructionFrame {
    // #nodes;

    // end(nodes) {
      // this.#nodes = nodes;
      // super.end([...elementsImplZ(nodes)]);
    // }

  // }

  const roots = [];
  const frames = [];

  function endTagRead(el, lastParsed) {
    return el !== lastParsed && el.compareDocumentPosition(lastParsed) !== 20;
  }

  function onParserBreak(e) {
    while (frames[0] && endTagRead(frames[0].el, e.target)) {
      const frame = frames.shift();
      frame.end(roots);
    }
    ConstructionFrame.dropNow();
    //todo Now we calculate the full list of nodes for the new FarserFrame. We only need to calculate that it has one, and then calculate the rest when queried.
    //todo so this might be made slightly more efficient.
    const addedNodes = [...e.endedNodes()].filter(n => roots.findIndex(s => s === n || s.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_CONTAINED_BY) === -1);
    addedNodes.length && new ConstructionFrame("Parser").end([...elementsImplZ(addedNodes)]);
    // todo here we can remove the elements that has been ended from the roots list. Not sure if this would be faster though.
    // roots.splice(roots.indexOf(frame.el), 1); //todo this doesn't work. the roots are popping up later.
  }

  window.addEventListener('parser-break', onParserBreak, true);

  class PredictiveConstructionFrameHTMLElement extends HTMLElement {
    constructor() {
      super();
      if (!ConstructionFrame.now) {
        frames.unshift(new PredictiveConstructionFrame(this));
        //if we are working on individual elements, and don't really care about Predictive or not, can we then simply skip this?
        // No. We need the ConstructionFrame I think..
        roots.push(this);
      }
    }
  }

  MonkeyPatch.injectClassWhileLoading(HTMLElement, PredictiveConstructionFrameHTMLElement);
})();