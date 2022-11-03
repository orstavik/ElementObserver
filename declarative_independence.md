# Rule of declarative independence between custom elements and custom attributes.

## When will custom element lifecycle methods run before custom attribute lifecycle methods?

1. When custom attributes are added to a custom element *before* they have been defined, then the custom elements lifecycle methods can see the custom attribute before the custom attribute's lifecycle methods have been called.

2. While loading, the predictive parser will trigger:
   1. the `constructor()` *before* attributes in the template is added, and
   2. both the `.connectedCallback()` and the `.attributeChangedCallback(...)` before the MO for additions to the DOM has run.

Yes, the `.connectedCallback()` can be highjacked by monkeypatching the `HTMLElement.prototype` But, it is not possible to highjack `.attributeChangedCallback()` methods this way, because the `static get observedAttributes()` require us to know all the attribute names in advance. Therefore, there will *always* be `.attributeChangedCallback()`s that will run without customAttributes being checked.

Conclusion: There are at least two common use cases where custom element lifecycle methods are run *before* custom attribute lifecycle methods.

## When will custom attribute lifecycle methods run before custom element lifecycle methods?

1. When custom elements are added to the DOM with custom attributes and a) the custom element has not yet been defined and b) the custom attribute has been defined, then c) the custom attribute lifecycle method will most often run before the custom element lifecycle methods.

## Rule: declarative independence

Custom elements cannot depend on the state the lifecycle methods of custom attributes has run before the custom element lifecycle methods run, and vice versa. Custom elements and custom attributes are declaratively independent of each other.