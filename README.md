> Note! While the main document is loading, this plugin needs to alter the `window.HTMLElement` value so that for example `nativeEl instanceof HTMLElement` returns `false`. This is needed to get the correct callbacks when custom elements are declared and upgraded while the main document is loading (which is beneficial to avoid flash of unstyled content). This needs further investigations. Can it be avoided? Is there a workaround?

> Note2! There is a racecondition that arise if we call a requestAnimationFrame() and then change the innerText of an element in there. This bug is not hunted down yet. We need to find out how this works.

# ElementObserver

An Observer for the different stages of DOM `Element` construction.

 1. `ElementObserver.end(cb)`: The `cb` function will be triggered as soon as the construction of an element is completed. When multiple elements are constructed simultaneously, then the `cb` will be called after all the `constructor()`, `connectedCallback()` and `attributeChangedCallback()` has been undertaken.
 2. `ElementObserver.complete(cb)`: The `cb` function is triggered as soon as an uppermost constructionFrame ends, and then light-dom-to-shadow-dom, top-down for each element constructed. This callback basically signals when the slotteed nodes of an element will be ready.

Dependencies:
 1. `parse` event.
 2. NoNewConstructorHTMLElement. The NoNewContructorHTMLElement essentially ensures that no 'new HTMLElement()' constructor is called directly. This is a restriction that applies to native elements, and this restriction is extended to custom elements. The ConstructionFrame API will produce wrong events if used with 'new HTMLElement.constructor()'. To check for and produce this error is a little costly, and it is therefore not included in the `ElementObserver` API by default to make it faster in production.

## WhatIs: a construction frame?

> todo documentation for old version below

Whenever a custom element is defined and referenced in an HTMLElement construction method or template, then the browser will call all the callbacks *sync* for those elements as part of the construction process. This means that the construction HTMLElements nests and branch out as a tree when for example as a custom element creates a shadowDom with one or more other custom elements. We call the nodes in this graph for constructionFrames.

## Example:

```html
<script>
  class CompA extends HTMLElement{
    constructor(){
      super();
      this.attachShadow();
      this.shadowRoot.innerHTML = '<comp-b></comp-b>';
    }
  }
  class CompB extends HTMLElement{
    constructor(){
      super();
      this.attachShadow();
      const c = document.createElement('comp-c');
      this.shadowRoot.appendChild(c);
    }
  }
  class CompC extends HTMLElement{
    constructor(){
      super();
      this.attachShadow();
      this.shadowRoot.innerHTML = 'hello sunshine';
    }
  }
  customElements.define('comp-c', CompC);
  customElements.define('comp-b', CompB);
  customElements.define('comp-a', CompA);
</script>.
<comp-a></comp-a>
```
 In this example, the constructionFrame will nest like this: `{ predictive:comp-a { innerHTML:comp-b { createElement:comp-c } } }`

### Problem 1: main document nests lightDom branches while loading

While loading, the browser can create custom elements directly. And while loading, the browser's parser may be delayed for a long time while waiting for sync <scripts>. And with custom web components that direct layout, you need to load custom elements synchronously and block rendering to avoid FOUC. This creates a situation where you wish to mark the *end* of a construction frame as early as possible, ie. on a per element level. When we mark a construction frame for an individual element, the frame begins just before the start tag is read and ends when the end tag is read. As there is no possible means to know when the end tag is, the document frame would end as soon as possible after the end tag is read.

The per element construction frames that are created when the predictive parser calls the custom element constructor directly is called a "predictive construction frame".

We make "predictive construction frames" with a somewhat complex mechanism:
1. every time an HTMLElement.constructor() is called directly by the predictive parser, we start a new predictive constructionFrame and issue a construction-start event. all predictive constructionFrames will have an empty parent construction frame (ie. be a root construction frame).
2. then, every time the predictive parser breaks to either a) run a script or b) run another custom element constructor, ie. at ParserBreakEvent time during loading, then the mechanism will check if the endTag of the custom element whose constructor triggered the predictive construction frame has been read.
3. If the endTag of the custom element that triggered the predictive frame has been read, the construction-end event is dispatched for that predictive construction frame.
4. This means that predictive construction frames for parent nodes will remain open (but no longer be accessible from elementConstructionFrame) while the predictive construction frames of the light dom child nodes are also active.
5. For nested construction frame contexts, construction contexts start and end recursively. A predictive construction frame associated with a descendant element will always end before a predictive construction frame associated with an ancestor element.

The ConstructionFrame API is a low level API. It is not intended to be used directly, but intended for use by other API such as attributeReadyCallback() and childReadyCallback() APIs. These APIs need mainly to listen for construction-end events so that they can trigger attributeReadyCallback() and childReadyCallback() at the correct time.

## HowTo: run the test

Clone the git repo, and then run the following terminal command in the root folder:
`npx http-server . -p 3333 --cors`

and open `http://localhost:3333/test/`.