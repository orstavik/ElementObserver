# When does upgrade for template elements occur?

```html
<body>
<script>
  customElements.define("web-comp", class WebComp extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({mode: "open"});
      this.shadowRoot.innerHTML = "<slot></slot>";
      console.log("webcomp");
    }
  });
</script>

<template>
  <web-comp>
    <div>hello sunshine</div>
  </web-comp>
</template>
<script>
  const template = document.querySelector("template");
  //1. <template>.content.cloneNode(true) doesn't trigger the upgrade
  const bob = template.content.cloneNode(true);
  console.log(1);
  document.body.append(bob);
  //2. <template>.content.cloneNode(true) elements are upgraded when they are added to the DOM. 
  console.log(2)
  document.body.append(template.content.children[0]);
  //3. cloneNode(true) of elements already added to the DOM are upgraded when calling cloneNode.
  console.log(3);
  const alice = document.body.children[3].cloneNode(true);
  console.log(4);
  document.body.append(alice);
  console.log(5);
</script>
</body>
```

## Findings from the test

1. Elements stashed/parsed into the `<template>.content` are *not* upgraded *until* they are added to the DOM for the first time.
2. `<template>.content` elements that are not upgraded yet, do not trigger the upgrade when cloned. This means that you can have elements with the "template status" that are both directly under the `<template>.content` and loose as JS objects.
3. Already upgraded elements are upgraded are also upgraded when they are cloned, even though those clones are not yet added to the DOM.