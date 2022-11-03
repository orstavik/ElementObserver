(function (dispatchEventOG, addEventListenerOG, removeEventListenerOG) {

  function doDispatch(addedNodes) {
    addedNodes.length && dispatchEventOG.call(document, new CustomEvent("element-created", {detail: addedNodes}));
  }

  doDispatch([...document.querySelectorAll("*")]);

  //see upgrade_from_template.md
  const contentOG = Object.getOwnPropertyDescriptor(HTMLTemplateElement.prototype, "content").get;
  Object.defineProperty(HTMLTemplateElement.prototype, "content", {
    get: function () {
      return contentOG.call(this).cloneNode(true);
    }
  });

  if (document.readyState === 'loading') {

    function mrsToEls(mrs) {
      const res = [];
      for (let {addedNodes} of mrs)
        for (let n of addedNodes)
          if (n instanceof Element)
            res.push(n);
      return res;
    }


    function makeOnMoObserver() {
      const c = new Comment();                                                               //MO-readystatechange race #1
      const touchDom = _ => document.body.append(c);                                         //MO-readystatechange race #1
      addEventListenerOG.call(document, 'readystatechange', touchDom, {capture: true, once: true});  //MO-readystatechange race #1

      return function onMO(mrs) {
        //1. skip DOM mutation inside <script>
        if (document.currentScript)
          return;
        //2. The end parser-break
        if (document.readyState !== 'loading') {
          this.disconnect();
          (mrs[mrs.length - 1].addedNodes[0] === c) && (c.remove(), mrs.pop());               //MO-readystatechange race #2
          removeEventListenerOG.call(document, 'readystatechange', touchDom, {capture: true});//MO-readystatechange race #2
          return doDispatch(mrsToEls(mrs));
        }
        //3. A parser-break
        doDispatch(mrsToEls(mrs));
      }
    }

    const mo = new MutationObserver(makeOnMoObserver());
    mo.observe(document.documentElement, {childList: true, subtree: true});
  }

  function monkeyPatch(proto, prop, valueOrSet, hoFun, desc = Object.getOwnPropertyDescriptor(proto, prop)) {
    desc[valueOrSet] = hoFun(desc[valueOrSet]);
    Object.defineProperty(proto, prop, desc);
  }

  function innerHTML_ho(og) {
    return function innerHTML_patch(val) {
      og.call(this, val);
      doDispatch([...this.querySelectorAll('*')]);
    }
  }

  monkeyPatch(Element.prototype, "innerHTML", "set", innerHTML_ho);
  monkeyPatch(ShadowRoot.prototype, "innerHTML", "set", innerHTML_ho);

  monkeyPatch(Node.prototype, "cloneNode", "value", function (og) {
    return function cloneNode_patch(deep, ...args) {
      const clone = og.call(this, deep, ...args);
      clone instanceof Element && doDispatch([clone]); //avoid text, shadowRoot, comment nodes
      if (deep)
        doDispatch([...clone.querySelectorAll("*")]);
      return clone;
    }
  });

  monkeyPatch(Document.prototype, "createElement", "value", function (og) {
    return function createElement_patch(...args) {
      const created = og.call(this, ...args);
      doDispatch([created]);
      return created;
    }
  });

  monkeyPatch(Element.prototype, "insertAdjacentHTML", "value", function (og) {
    return function insertAdjacentHTML_patch(position, ...args) {
      const root = position === 'beforebegin' || position === 'afterend' ? this.parentNode : this;
      const before = root && [...root.querySelectorAll('*')];//if root is parent, and there is no parent, the og.call will throw an error
      og.call(this, position, ...args);
      let nodes = [...root.querySelectorAll("*")];
      if (before)
        nodes = nodes.filter(el => before.indexOf(el) === -1);
      doDispatch(nodes);
    }
  });
})(dispatchEvent, addEventListener, removeEventListener, HTMLElement);