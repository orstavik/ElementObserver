(function () {
  window.OG = {};

  class MonkeyPatch {

    static monkeyPatch(proto, prop, fun) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
      const og = OG[proto.constructor.name + '.' + prop] = descriptor.value;
      descriptor.value = function monkeypatch(...args) {
        return fun.call(this, og, ...args);
      };
      Object.defineProperty(proto, prop, descriptor);
      return og;
    }

    static monkeyPatchSetter(proto, prop, fun) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
      const og = OG[proto.constructor.name + '.' + prop] = descriptor.set;
      descriptor.set = function monkeypatch(...args) {
        return fun.call(this, og, ...args);
      };
      Object.defineProperty(proto, prop, descriptor);
      return og;
    }

    //todo replace the monkeyPatchSetter with the monkeyPatchGetSet
    static monkeyPatchGetSet(proto, prop, set, get) {
      console.info("todo this is an untested method.");
      const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
      const og = OG[proto.constructor.name + '.' + prop] = descriptor.get;
      descriptor.get = function monkeypatch() {
        return get.call(this, og);
      };
      descriptor.set = function monkeypatch() {
        return set.call(this, og);
      };
      Object.defineProperty(proto, prop, descriptor);
      return og;
    }

    static dropClass(cnstr) {
      Object.setPrototypeOf(cnstr, Object.getPrototypeOf(Object.getPrototypeOf(cnstr)));
      Object.setPrototypeOf(cnstr.prototype, Object.getPrototypeOf(Object.getPrototypeOf(cnstr.prototype)));
    }

    static injectClass(cnstr, superCnstr) {
      Object.setPrototypeOf(superCnstr, Object.getPrototypeOf(cnstr));
      Object.setPrototypeOf(superCnstr.prototype, Object.getPrototypeOf(cnstr.prototype));
      Object.setPrototypeOf(cnstr, superCnstr);
      Object.setPrototypeOf(cnstr.prototype, superCnstr.prototype);
    }

    static injectClassWhileLoading(OG, superCnstr) {
      if (document.readyState !== 'loading')
        return;
      MonkeyPatch.injectClass(OG, superCnstr);
      window.addEventListener('readystatechange', () => MonkeyPatch.dropClass(OG), {once: true, capture: true});
    }

    static deprecate(proto, prop, msg) {
      const name = proto.constructor.name + "." + prop;
      function deprecate() {
        throw new SyntaxError(`"${name}" is deprecated. ${msg ?? ''}`);
      }
      const isGetSet = !Object.getOwnPropertyDescriptor(proto, prop).value;
      isGetSet ? MonkeyPatch.monkeyPatchGetSet(proto, prop, deprecate, deprecate) :
        MonkeyPatch.monkeyPatch(proto, prop, deprecate);
    }

    static lockOG(name) {
      const og = OG[name];
      delete OG[name];
      return og;
    }
  }

  window.MonkeyPatch = MonkeyPatch;
})();