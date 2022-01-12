(function initConstructionFrameAPI() {
  let now;

  class ConstructionFrame {

    #children = [];
    #parent;
    #state = "start";
    #elements;

    static #observers = {'start': [], 'end': [], 'complete': []};

    constructor() {
      this.#parent = now;
      now = this;
      this.#parent?.#children.push(this);
      // this.#callObservers('start');
    }

    #callObservers(state) {
      const observers = ConstructionFrame.#observers[this.#state = state];
      for (let cb of observers)
        // cb(this);
        for (let el of this.elements())
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
      return parent + this.constructor.name.slice(0, -17) + '#' + this.#state;
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

    end() {
      this.#elements = [...this.elementsImpl()];
      this.#callObservers('end');
      !this.#parent && this.#complete();
      now = this.#parent;
    }
  }

  window.ConstructionFrame = ConstructionFrame;

  // function* recursiveNodes(n) {
  //   yield n;
  //   if (n.childNodes)
  //     for (let c of n.childNodes)
  //       yield* recursiveNodes(c);
  // }
  //
  function* recursiveElements(n) {
    yield n;
    if (n.children)
      for (let c of n.children)
        yield* recursiveElements(c);
  }

  class DocumentCreateElementConstructionFrame extends ConstructionFrame {
    #el;

    end(created) {
      this.#el = created;
      super.end();
      return created;
    }

    // * nodes() {
    //   yield this.#el;
    // }
    //
    * elementsImpl() {
      yield this.#el;
    }
  }

  class CloneNodeConstructionFrame extends ConstructionFrame {
    #clone;

    end(clone) {
      this.#clone = clone;
      super.end();
      return clone;
    }

    // * nodes() {
    //   yield* recursiveNodes(this.#clone);
    // }
    //
    * elementsImpl() {
      yield* recursiveElements(this.#clone);
    }
  }

  class InnerHTMLConstructionFrame extends ConstructionFrame {
    #el;

    end(el) {
      this.#el = el;
      super.end();
    }

    // * nodes() {
    //   for (let n of this.#el.childNodes)
    //     yield* recursiveNodes(n);
    // }
    //
    * elementsImpl() {
      for (let n of this.#el.children)
        yield* recursiveElements(n);
    }
  }

  function innerHTML_constructionFrame(og, val) {
    const frame = new InnerHTMLConstructionFrame();
    og.call(this, val);
    frame.end(this);
  }

  MonkeyPatch.monkeyPatchSetter(Element.prototype, "innerHTML", innerHTML_constructionFrame);
  MonkeyPatch.monkeyPatchSetter(ShadowRoot.prototype, "innerHTML", innerHTML_constructionFrame);

  MonkeyPatch.monkeyPatch(Node.prototype, "cloneNode", function cloneNode_constructionFrame(og, ...args) {
    return new CloneNodeConstructionFrame().end(og.call(this, ...args));
  });

  MonkeyPatch.monkeyPatch(Document.prototype, "createElement", function createElement_constructionFrame(og, ...args) {
    return new DocumentCreateElementConstructionFrame().end(og.call(this, ...args));
  });

  class InsertAdjacentHTMLConstructionFrame extends ConstructionFrame {
    #d;

    end({position, element, previousSibling, lastChild, firstChild, nextSibling}) {
      this.#d = {position, element, previousSibling, lastChild, firstChild, nextSibling};
      super.end();
    }

    // * nodes() {
    //   if (this.#d.position === 'beforebegin') {
    //     for (let n = this.#d.previousSibling?.nextSibling || this.#d.element.parentNode?.firstChild; n && n !== this.#d.element; n = n.nextSibling)
    //       yield* recursiveNodes(n);
    //   } else if (this.#d.position === 'afterend') {
    //     for (let n = this.#d.element.nextSibling; n && n !== this.#d.nextSibling; n = n.nextSibling)
    //       yield* recursiveNodes(n);
    //   } else if (this.#d.position === 'afterbegin') {
    //     for (let n = this.#d.element.firstChild; n && n !== this.#d.firstChild; n = n.nextSibling)
    //       yield* recursiveNodes(n);
    //   } else if (this.#d.position === 'beforeend') {
    //     for (let n = this.#d.lastChild?.nextSibling || this.#d.element.firstChild; n; n = n.nextSibling)
    //       yield* recursiveNodes(n);
    //   }
    // }
    //
    * elementsImpl() {
      if (this.#d.position === 'beforebegin') {
        for (let n = this.#d.previousSibling?.nextSibling || this.#d.element.parentNode?.firstChild; n && n !== this.#d.element; n = n.nextSibling)
          if (n instanceof Element) yield* recursiveElements(n);
      } else if (this.#d.position === 'afterend') {
        for (let n = this.#d.element.nextSibling; n && n !== this.#d.nextSibling; n = n.nextSibling)
          if (n instanceof Element) yield* recursiveElements(n);
      } else if (this.#d.position === 'afterbegin') {
        for (let n = this.#d.element.firstChild; n && n !== this.#d.firstChild; n = n.nextSibling)
          if (n instanceof Element) yield* recursiveElements(n);
      } else if (this.#d.position === 'beforeend') {
        for (let n = this.#d.lastChild?.nextSibling || this.#d.element.firstChild; n; n = n.nextSibling)
          if (n instanceof Element) yield* recursiveElements(n);
      }
    }
  }

  MonkeyPatch.monkeyPatch(Element.prototype, "insertAdjacentHTML", function insertAdjacentHTML_constructHtmlElement(og, position, ...args) {
    const {previousSibling, lastChild, firstChild, nextSibling} = this;
    const frame = new InsertAdjacentHTMLConstructionFrame();
    og.call(this, position, ...args);
    frame.end({position, element: this, previousSibling, lastChild, firstChild, nextSibling});
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

    // * nodes() {
    //   if (this.#el) yield this.#el;
    // }
    //
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

  // function* recursiveNodesWithSkips(el, skips) {
  //   yield el;
  //   if (el.childNodes)
  //     for (let c of el.childNodes)
  //       if (skips.indexOf(c) < 0)
  //         yield* recursiveNodesWithSkips(c, skips);
  // }
  //
  function* recursiveElementsWithSkips(el, skips) {
    yield el;
    for (let c of el.children)
      if (skips.indexOf(c) < 0)
        yield* recursiveElementsWithSkips(c, skips);
  }

  class PredictiveConstructionFrame extends ConstructionFrame {

    #el;
    #skips;

    constructor(el) {
      super();
      this.#el = el;
    }

    end(skips) {
      if(!this.#el.isConnected) return;   //if the constructor fails, then the PredictiveConstructionFrame should also fail as such.
      this.#skips = skips;
      super.end();
    }

    get el() {
      return this.#el;
    }

    // * nodes() {
    //   for (let n of recursiveNodesWithSkips(this.#el, this.#skips))
    //     yield n;
    // }
    //
    * elementsImpl() {
      for (let n of recursiveElementsWithSkips(this.#el, this.#skips))
        yield n;
    }
  }

  class ParserConstructionFrame extends ConstructionFrame {
    #nodes;

    end(nodes) {
      this.#nodes = nodes;
      super.end();
    }

    // * nodes() {
    //   for (let n of this.#nodes)
    //     yield n;
    // }
    //
    * elementsImpl() {
      for (let n of this.#nodes)
        if (n instanceof Element)
          yield n;
    }
  }

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
    addedNodes.length && new ParserConstructionFrame().end(addedNodes);
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