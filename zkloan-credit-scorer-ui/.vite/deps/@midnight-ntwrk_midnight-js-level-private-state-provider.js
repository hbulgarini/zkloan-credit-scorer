import {
  require_buffer
} from "./chunk-NTLGP5MK.js";
import {
  require_lodash
} from "./chunk-KBALS3ZT.js";
import {
  __commonJS,
  __toESM
} from "./chunk-V4OQ3NZ2.js";

// ../node_modules/level-supports/index.js
var require_level_supports = __commonJS({
  "../node_modules/level-supports/index.js"(exports) {
    "use strict";
    exports.supports = function supports(...manifests) {
      const manifest = manifests.reduce((acc, m) => Object.assign(acc, m), {});
      const implicitSnapshots = manifest.implicitSnapshots || manifest.snapshots || false;
      const explicitSnapshots = manifest.explicitSnapshots || false;
      return Object.assign(manifest, {
        implicitSnapshots,
        explicitSnapshots,
        snapshots: implicitSnapshots,
        has: manifest.has || false,
        permanence: manifest.permanence || false,
        seek: manifest.seek || false,
        createIfMissing: manifest.createIfMissing || false,
        errorIfExists: manifest.errorIfExists || false,
        deferredOpen: manifest.deferredOpen || false,
        streams: manifest.streams || false,
        encodings: Object.assign({}, manifest.encodings),
        events: Object.assign({}, manifest.events),
        additionalMethods: Object.assign({}, manifest.additionalMethods),
        signals: Object.assign({}, manifest.signals)
      });
    };
  }
});

// ../node_modules/module-error/index.js
var require_module_error = __commonJS({
  "../node_modules/module-error/index.js"(exports, module) {
    "use strict";
    module.exports = class ModuleError extends Error {
      /**
       * @param {string} message Error message
       * @param {{ code?: string, cause?: Error, expected?: boolean, transient?: boolean }} [options]
       */
      constructor(message, options) {
        super(message || "");
        if (typeof options === "object" && options !== null) {
          if (options.code) this.code = String(options.code);
          if (options.expected) this.expected = true;
          if (options.transient) this.transient = true;
          if (options.cause) this.cause = options.cause;
        }
        if (Error.captureStackTrace) {
          Error.captureStackTrace(this, this.constructor);
        }
      }
    };
  }
});

// ../node_modules/level-transcoder/lib/text-endec.js
var require_text_endec = __commonJS({
  "../node_modules/level-transcoder/lib/text-endec.js"(exports, module) {
    "use strict";
    var lazy = null;
    module.exports = function() {
      if (lazy === null) {
        lazy = {
          textEncoder: new TextEncoder(),
          textDecoder: new TextDecoder()
        };
      }
      return lazy;
    };
  }
});

// ../node_modules/level-transcoder/lib/encoding.js
var require_encoding = __commonJS({
  "../node_modules/level-transcoder/lib/encoding.js"(exports) {
    "use strict";
    var ModuleError = require_module_error();
    var formats = /* @__PURE__ */ new Set(["buffer", "view", "utf8"]);
    var Encoding = class {
      /**
       * @param {IEncoding<TIn,TFormat,TOut>} options
       */
      constructor(options) {
        this.encode = options.encode || this.encode;
        this.decode = options.decode || this.decode;
        this.name = options.name || this.name;
        this.format = options.format || this.format;
        if (typeof this.encode !== "function") {
          throw new TypeError("The 'encode' property must be a function");
        }
        if (typeof this.decode !== "function") {
          throw new TypeError("The 'decode' property must be a function");
        }
        this.encode = this.encode.bind(this);
        this.decode = this.decode.bind(this);
        if (typeof this.name !== "string" || this.name === "") {
          throw new TypeError("The 'name' property must be a string");
        }
        if (typeof this.format !== "string" || !formats.has(this.format)) {
          throw new TypeError("The 'format' property must be one of 'buffer', 'view', 'utf8'");
        }
        if (options.createViewTranscoder) {
          this.createViewTranscoder = options.createViewTranscoder;
        }
        if (options.createBufferTranscoder) {
          this.createBufferTranscoder = options.createBufferTranscoder;
        }
        if (options.createUTF8Transcoder) {
          this.createUTF8Transcoder = options.createUTF8Transcoder;
        }
      }
      get commonName() {
        return (
          /** @type {string} */
          this.name.split("+")[0]
        );
      }
      /** @return {BufferFormat<TIn,TOut>} */
      createBufferTranscoder() {
        throw new ModuleError(`Encoding '${this.name}' cannot be transcoded to 'buffer'`, {
          code: "LEVEL_ENCODING_NOT_SUPPORTED"
        });
      }
      /** @return {ViewFormat<TIn,TOut>} */
      createViewTranscoder() {
        throw new ModuleError(`Encoding '${this.name}' cannot be transcoded to 'view'`, {
          code: "LEVEL_ENCODING_NOT_SUPPORTED"
        });
      }
      /** @return {UTF8Format<TIn,TOut>} */
      createUTF8Transcoder() {
        throw new ModuleError(`Encoding '${this.name}' cannot be transcoded to 'utf8'`, {
          code: "LEVEL_ENCODING_NOT_SUPPORTED"
        });
      }
    };
    exports.Encoding = Encoding;
  }
});

// ../node_modules/level-transcoder/lib/formats.js
var require_formats = __commonJS({
  "../node_modules/level-transcoder/lib/formats.js"(exports) {
    "use strict";
    var { Buffer: Buffer2 } = require_buffer() || {};
    var { Encoding } = require_encoding();
    var textEndec = require_text_endec();
    var BufferFormat = class extends Encoding {
      /**
       * @param {Omit<IEncoding<TIn, Buffer, TOut>, 'format'>} options
       */
      constructor(options) {
        super({ ...options, format: "buffer" });
      }
      /** @override */
      createViewTranscoder() {
        return new ViewFormat({
          encode: this.encode,
          // Buffer is a view (UInt8Array)
          decode: (data) => this.decode(
            Buffer2.from(data.buffer, data.byteOffset, data.byteLength)
          ),
          name: `${this.name}+view`
        });
      }
      /** @override */
      createBufferTranscoder() {
        return this;
      }
    };
    var ViewFormat = class extends Encoding {
      /**
       * @param {Omit<IEncoding<TIn, Uint8Array, TOut>, 'format'>} options
       */
      constructor(options) {
        super({ ...options, format: "view" });
      }
      /** @override */
      createBufferTranscoder() {
        return new BufferFormat({
          encode: (data) => {
            const view = this.encode(data);
            return Buffer2.from(view.buffer, view.byteOffset, view.byteLength);
          },
          decode: this.decode,
          // Buffer is a view (UInt8Array)
          name: `${this.name}+buffer`
        });
      }
      /** @override */
      createViewTranscoder() {
        return this;
      }
    };
    var UTF8Format = class extends Encoding {
      /**
       * @param {Omit<IEncoding<TIn, string, TOut>, 'format'>} options
       */
      constructor(options) {
        super({ ...options, format: "utf8" });
      }
      /** @override */
      createBufferTranscoder() {
        return new BufferFormat({
          encode: (data) => Buffer2.from(this.encode(data), "utf8"),
          decode: (data) => this.decode(data.toString("utf8")),
          name: `${this.name}+buffer`
        });
      }
      /** @override */
      createViewTranscoder() {
        const { textEncoder, textDecoder } = textEndec();
        return new ViewFormat({
          encode: (data) => textEncoder.encode(this.encode(data)),
          decode: (data) => this.decode(textDecoder.decode(data)),
          name: `${this.name}+view`
        });
      }
      /** @override */
      createUTF8Transcoder() {
        return this;
      }
    };
    exports.BufferFormat = BufferFormat;
    exports.ViewFormat = ViewFormat;
    exports.UTF8Format = UTF8Format;
  }
});

// ../node_modules/level-transcoder/lib/encodings.js
var require_encodings = __commonJS({
  "../node_modules/level-transcoder/lib/encodings.js"(exports) {
    "use strict";
    var { Buffer: Buffer2 } = require_buffer() || { Buffer: { isBuffer: () => false } };
    var { textEncoder, textDecoder } = require_text_endec()();
    var { BufferFormat, ViewFormat, UTF8Format } = require_formats();
    var identity = (v) => v;
    exports.utf8 = new UTF8Format({
      encode: function(data) {
        return Buffer2.isBuffer(data) ? data.toString("utf8") : ArrayBuffer.isView(data) ? textDecoder.decode(data) : String(data);
      },
      decode: identity,
      name: "utf8",
      createViewTranscoder() {
        return new ViewFormat({
          encode: function(data) {
            return ArrayBuffer.isView(data) ? data : textEncoder.encode(data);
          },
          decode: function(data) {
            return textDecoder.decode(data);
          },
          name: `${this.name}+view`
        });
      },
      createBufferTranscoder() {
        return new BufferFormat({
          encode: function(data) {
            return Buffer2.isBuffer(data) ? data : ArrayBuffer.isView(data) ? Buffer2.from(data.buffer, data.byteOffset, data.byteLength) : Buffer2.from(String(data), "utf8");
          },
          decode: function(data) {
            return data.toString("utf8");
          },
          name: `${this.name}+buffer`
        });
      }
    });
    exports.json = new UTF8Format({
      encode: JSON.stringify,
      decode: JSON.parse,
      name: "json"
    });
    exports.buffer = new BufferFormat({
      encode: function(data) {
        return Buffer2.isBuffer(data) ? data : ArrayBuffer.isView(data) ? Buffer2.from(data.buffer, data.byteOffset, data.byteLength) : Buffer2.from(String(data), "utf8");
      },
      decode: identity,
      name: "buffer",
      createViewTranscoder() {
        return new ViewFormat({
          encode: function(data) {
            return ArrayBuffer.isView(data) ? data : Buffer2.from(String(data), "utf8");
          },
          decode: function(data) {
            return Buffer2.from(data.buffer, data.byteOffset, data.byteLength);
          },
          name: `${this.name}+view`
        });
      }
    });
    exports.view = new ViewFormat({
      encode: function(data) {
        return ArrayBuffer.isView(data) ? data : textEncoder.encode(data);
      },
      decode: identity,
      name: "view",
      createBufferTranscoder() {
        return new BufferFormat({
          encode: function(data) {
            return Buffer2.isBuffer(data) ? data : ArrayBuffer.isView(data) ? Buffer2.from(data.buffer, data.byteOffset, data.byteLength) : Buffer2.from(String(data), "utf8");
          },
          decode: identity,
          name: `${this.name}+buffer`
        });
      }
    });
    exports.hex = new BufferFormat({
      encode: function(data) {
        return Buffer2.isBuffer(data) ? data : Buffer2.from(String(data), "hex");
      },
      decode: function(buffer) {
        return buffer.toString("hex");
      },
      name: "hex"
    });
    exports.base64 = new BufferFormat({
      encode: function(data) {
        return Buffer2.isBuffer(data) ? data : Buffer2.from(String(data), "base64");
      },
      decode: function(buffer) {
        return buffer.toString("base64");
      },
      name: "base64"
    });
  }
});

// ../node_modules/level-transcoder/index.js
var require_level_transcoder = __commonJS({
  "../node_modules/level-transcoder/index.js"(exports) {
    "use strict";
    var ModuleError = require_module_error();
    var encodings = require_encodings();
    var { Encoding } = require_encoding();
    var { BufferFormat, ViewFormat, UTF8Format } = require_formats();
    var kFormats = Symbol("formats");
    var kEncodings = Symbol("encodings");
    var validFormats = /* @__PURE__ */ new Set(["buffer", "view", "utf8"]);
    var Transcoder = class {
      /**
       * @param {Array<'buffer'|'view'|'utf8'>} formats
       */
      constructor(formats) {
        if (!Array.isArray(formats)) {
          throw new TypeError("The first argument 'formats' must be an array");
        } else if (!formats.every((f) => validFormats.has(f))) {
          throw new TypeError("Format must be one of 'buffer', 'view', 'utf8'");
        }
        this[kEncodings] = /* @__PURE__ */ new Map();
        this[kFormats] = new Set(formats);
        for (const k in encodings) {
          try {
            this.encoding(k);
          } catch (err) {
            if (err.code !== "LEVEL_ENCODING_NOT_SUPPORTED") throw err;
          }
        }
      }
      /**
       * @returns {Array<Encoding<any,T,any>>}
       */
      encodings() {
        return Array.from(new Set(this[kEncodings].values()));
      }
      /**
       * @param {string|MixedEncoding<any, any, any>} encoding
       * @returns {Encoding<any, T, any>}
       */
      encoding(encoding) {
        let resolved = this[kEncodings].get(encoding);
        if (resolved === void 0) {
          if (typeof encoding === "string" && encoding !== "") {
            resolved = lookup[encoding];
            if (!resolved) {
              throw new ModuleError(`Encoding '${encoding}' is not found`, {
                code: "LEVEL_ENCODING_NOT_FOUND"
              });
            }
          } else if (typeof encoding !== "object" || encoding === null) {
            throw new TypeError("First argument 'encoding' must be a string or object");
          } else {
            resolved = from(encoding);
          }
          const { name, format } = resolved;
          if (!this[kFormats].has(format)) {
            if (this[kFormats].has("view")) {
              resolved = resolved.createViewTranscoder();
            } else if (this[kFormats].has("buffer")) {
              resolved = resolved.createBufferTranscoder();
            } else if (this[kFormats].has("utf8")) {
              resolved = resolved.createUTF8Transcoder();
            } else {
              throw new ModuleError(`Encoding '${name}' cannot be transcoded`, {
                code: "LEVEL_ENCODING_NOT_SUPPORTED"
              });
            }
          }
          for (const k of [encoding, name, resolved.name, resolved.commonName]) {
            this[kEncodings].set(k, resolved);
          }
        }
        return resolved;
      }
    };
    exports.Transcoder = Transcoder;
    function from(options) {
      if (options instanceof Encoding) {
        return options;
      }
      const maybeType = "type" in options && typeof options.type === "string" ? options.type : void 0;
      const name = options.name || maybeType || `anonymous-${anonymousCount++}`;
      switch (detectFormat(options)) {
        case "view":
          return new ViewFormat({ ...options, name });
        case "utf8":
          return new UTF8Format({ ...options, name });
        case "buffer":
          return new BufferFormat({ ...options, name });
        default: {
          throw new TypeError("Format must be one of 'buffer', 'view', 'utf8'");
        }
      }
    }
    function detectFormat(options) {
      if ("format" in options && options.format !== void 0) {
        return options.format;
      } else if ("buffer" in options && typeof options.buffer === "boolean") {
        return options.buffer ? "buffer" : "utf8";
      } else if ("code" in options && Number.isInteger(options.code)) {
        return "view";
      } else {
        return "buffer";
      }
    }
    var aliases = {
      binary: encodings.buffer,
      "utf-8": encodings.utf8
    };
    var lookup = {
      ...encodings,
      ...aliases
    };
    var anonymousCount = 0;
  }
});

// ../node_modules/events/events.js
var require_events = __commonJS({
  "../node_modules/events/events.js"(exports, module) {
    "use strict";
    var R = typeof Reflect === "object" ? Reflect : null;
    var ReflectApply = R && typeof R.apply === "function" ? R.apply : function ReflectApply2(target, receiver, args) {
      return Function.prototype.apply.call(target, receiver, args);
    };
    var ReflectOwnKeys;
    if (R && typeof R.ownKeys === "function") {
      ReflectOwnKeys = R.ownKeys;
    } else if (Object.getOwnPropertySymbols) {
      ReflectOwnKeys = function ReflectOwnKeys2(target) {
        return Object.getOwnPropertyNames(target).concat(Object.getOwnPropertySymbols(target));
      };
    } else {
      ReflectOwnKeys = function ReflectOwnKeys2(target) {
        return Object.getOwnPropertyNames(target);
      };
    }
    function ProcessEmitWarning(warning) {
      if (console && console.warn) console.warn(warning);
    }
    var NumberIsNaN = Number.isNaN || function NumberIsNaN2(value) {
      return value !== value;
    };
    function EventEmitter() {
      EventEmitter.init.call(this);
    }
    module.exports = EventEmitter;
    module.exports.once = once;
    EventEmitter.EventEmitter = EventEmitter;
    EventEmitter.prototype._events = void 0;
    EventEmitter.prototype._eventsCount = 0;
    EventEmitter.prototype._maxListeners = void 0;
    var defaultMaxListeners = 10;
    function checkListener(listener) {
      if (typeof listener !== "function") {
        throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
      }
    }
    Object.defineProperty(EventEmitter, "defaultMaxListeners", {
      enumerable: true,
      get: function() {
        return defaultMaxListeners;
      },
      set: function(arg) {
        if (typeof arg !== "number" || arg < 0 || NumberIsNaN(arg)) {
          throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + ".");
        }
        defaultMaxListeners = arg;
      }
    });
    EventEmitter.init = function() {
      if (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) {
        this._events = /* @__PURE__ */ Object.create(null);
        this._eventsCount = 0;
      }
      this._maxListeners = this._maxListeners || void 0;
    };
    EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
      if (typeof n !== "number" || n < 0 || NumberIsNaN(n)) {
        throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + ".");
      }
      this._maxListeners = n;
      return this;
    };
    function _getMaxListeners(that) {
      if (that._maxListeners === void 0)
        return EventEmitter.defaultMaxListeners;
      return that._maxListeners;
    }
    EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
      return _getMaxListeners(this);
    };
    EventEmitter.prototype.emit = function emit(type) {
      var args = [];
      for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
      var doError = type === "error";
      var events = this._events;
      if (events !== void 0)
        doError = doError && events.error === void 0;
      else if (!doError)
        return false;
      if (doError) {
        var er;
        if (args.length > 0)
          er = args[0];
        if (er instanceof Error) {
          throw er;
        }
        var err = new Error("Unhandled error." + (er ? " (" + er.message + ")" : ""));
        err.context = er;
        throw err;
      }
      var handler = events[type];
      if (handler === void 0)
        return false;
      if (typeof handler === "function") {
        ReflectApply(handler, this, args);
      } else {
        var len = handler.length;
        var listeners = arrayClone(handler, len);
        for (var i = 0; i < len; ++i)
          ReflectApply(listeners[i], this, args);
      }
      return true;
    };
    function _addListener(target, type, listener, prepend) {
      var m;
      var events;
      var existing;
      checkListener(listener);
      events = target._events;
      if (events === void 0) {
        events = target._events = /* @__PURE__ */ Object.create(null);
        target._eventsCount = 0;
      } else {
        if (events.newListener !== void 0) {
          target.emit(
            "newListener",
            type,
            listener.listener ? listener.listener : listener
          );
          events = target._events;
        }
        existing = events[type];
      }
      if (existing === void 0) {
        existing = events[type] = listener;
        ++target._eventsCount;
      } else {
        if (typeof existing === "function") {
          existing = events[type] = prepend ? [listener, existing] : [existing, listener];
        } else if (prepend) {
          existing.unshift(listener);
        } else {
          existing.push(listener);
        }
        m = _getMaxListeners(target);
        if (m > 0 && existing.length > m && !existing.warned) {
          existing.warned = true;
          var w = new Error("Possible EventEmitter memory leak detected. " + existing.length + " " + String(type) + " listeners added. Use emitter.setMaxListeners() to increase limit");
          w.name = "MaxListenersExceededWarning";
          w.emitter = target;
          w.type = type;
          w.count = existing.length;
          ProcessEmitWarning(w);
        }
      }
      return target;
    }
    EventEmitter.prototype.addListener = function addListener(type, listener) {
      return _addListener(this, type, listener, false);
    };
    EventEmitter.prototype.on = EventEmitter.prototype.addListener;
    EventEmitter.prototype.prependListener = function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };
    function onceWrapper() {
      if (!this.fired) {
        this.target.removeListener(this.type, this.wrapFn);
        this.fired = true;
        if (arguments.length === 0)
          return this.listener.call(this.target);
        return this.listener.apply(this.target, arguments);
      }
    }
    function _onceWrap(target, type, listener) {
      var state = { fired: false, wrapFn: void 0, target, type, listener };
      var wrapped = onceWrapper.bind(state);
      wrapped.listener = listener;
      state.wrapFn = wrapped;
      return wrapped;
    }
    EventEmitter.prototype.once = function once2(type, listener) {
      checkListener(listener);
      this.on(type, _onceWrap(this, type, listener));
      return this;
    };
    EventEmitter.prototype.prependOnceListener = function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };
    EventEmitter.prototype.removeListener = function removeListener(type, listener) {
      var list, events, position, i, originalListener;
      checkListener(listener);
      events = this._events;
      if (events === void 0)
        return this;
      list = events[type];
      if (list === void 0)
        return this;
      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = /* @__PURE__ */ Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit("removeListener", type, list.listener || listener);
        }
      } else if (typeof list !== "function") {
        position = -1;
        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }
        if (position < 0)
          return this;
        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }
        if (list.length === 1)
          events[type] = list[0];
        if (events.removeListener !== void 0)
          this.emit("removeListener", type, originalListener || listener);
      }
      return this;
    };
    EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
    EventEmitter.prototype.removeAllListeners = function removeAllListeners(type) {
      var listeners, events, i;
      events = this._events;
      if (events === void 0)
        return this;
      if (events.removeListener === void 0) {
        if (arguments.length === 0) {
          this._events = /* @__PURE__ */ Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== void 0) {
          if (--this._eventsCount === 0)
            this._events = /* @__PURE__ */ Object.create(null);
          else
            delete events[type];
        }
        return this;
      }
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === "removeListener") continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners("removeListener");
        this._events = /* @__PURE__ */ Object.create(null);
        this._eventsCount = 0;
        return this;
      }
      listeners = events[type];
      if (typeof listeners === "function") {
        this.removeListener(type, listeners);
      } else if (listeners !== void 0) {
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }
      return this;
    };
    function _listeners(target, type, unwrap) {
      var events = target._events;
      if (events === void 0)
        return [];
      var evlistener = events[type];
      if (evlistener === void 0)
        return [];
      if (typeof evlistener === "function")
        return unwrap ? [evlistener.listener || evlistener] : [evlistener];
      return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
    }
    EventEmitter.prototype.listeners = function listeners(type) {
      return _listeners(this, type, true);
    };
    EventEmitter.prototype.rawListeners = function rawListeners(type) {
      return _listeners(this, type, false);
    };
    EventEmitter.listenerCount = function(emitter, type) {
      if (typeof emitter.listenerCount === "function") {
        return emitter.listenerCount(type);
      } else {
        return listenerCount.call(emitter, type);
      }
    };
    EventEmitter.prototype.listenerCount = listenerCount;
    function listenerCount(type) {
      var events = this._events;
      if (events !== void 0) {
        var evlistener = events[type];
        if (typeof evlistener === "function") {
          return 1;
        } else if (evlistener !== void 0) {
          return evlistener.length;
        }
      }
      return 0;
    }
    EventEmitter.prototype.eventNames = function eventNames() {
      return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
    };
    function arrayClone(arr, n) {
      var copy2 = new Array(n);
      for (var i = 0; i < n; ++i)
        copy2[i] = arr[i];
      return copy2;
    }
    function spliceOne(list, index) {
      for (; index + 1 < list.length; index++)
        list[index] = list[index + 1];
      list.pop();
    }
    function unwrapListeners(arr) {
      var ret = new Array(arr.length);
      for (var i = 0; i < ret.length; ++i) {
        ret[i] = arr[i].listener || arr[i];
      }
      return ret;
    }
    function once(emitter, name) {
      return new Promise(function(resolve, reject) {
        function errorListener(err) {
          emitter.removeListener(name, resolver);
          reject(err);
        }
        function resolver() {
          if (typeof emitter.removeListener === "function") {
            emitter.removeListener("error", errorListener);
          }
          resolve([].slice.call(arguments));
        }
        ;
        eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
        if (name !== "error") {
          addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
        }
      });
    }
    function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
      if (typeof emitter.on === "function") {
        eventTargetAgnosticAddListener(emitter, "error", handler, flags);
      }
    }
    function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
      if (typeof emitter.on === "function") {
        if (flags.once) {
          emitter.once(name, listener);
        } else {
          emitter.on(name, listener);
        }
      } else if (typeof emitter.addEventListener === "function") {
        emitter.addEventListener(name, function wrapListener(arg) {
          if (flags.once) {
            emitter.removeEventListener(name, wrapListener);
          }
          listener(arg);
        });
      } else {
        throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
      }
    }
  }
});

// ../node_modules/maybe-combine-errors/index.js
var require_maybe_combine_errors = __commonJS({
  "../node_modules/maybe-combine-errors/index.js"(exports, module) {
    "use strict";
    var kErrors = Symbol("kErrors");
    module.exports = function(errors) {
      errors = errors.filter(defined);
      if (errors.length === 0) return;
      if (errors.length === 1) return errors[0];
      return new CombinedError(errors);
    };
    var CombinedError = class extends Error {
      constructor(errors) {
        const unique = new Set(errors.map(getMessage).filter(Boolean));
        const message = Array.from(unique).join("; ");
        super(message);
        value(this, "name", "CombinedError");
        value(this, kErrors, errors);
        getter(this, "stack", () => errors.map(getStack).join("\n\n"));
        getter(this, "transient", () => errors.length > 0 && errors.every(transient));
        getter(this, "expected", () => errors.length > 0 && errors.every(expected));
      }
      [Symbol.iterator]() {
        return this[kErrors][Symbol.iterator]();
      }
    };
    function value(obj, prop, value2) {
      Object.defineProperty(obj, prop, { value: value2 });
    }
    function getter(obj, prop, get) {
      Object.defineProperty(obj, prop, { get });
    }
    function defined(err) {
      return err != null;
    }
    function getMessage(err) {
      return err.message;
    }
    function getStack(err) {
      return err.stack;
    }
    function transient(err) {
      return err.transient === true;
    }
    function expected(err) {
      return err.expected === true;
    }
  }
});

// ../node_modules/abstract-level/lib/common.js
var require_common = __commonJS({
  "../node_modules/abstract-level/lib/common.js"(exports) {
    "use strict";
    var ModuleError = require_module_error();
    var deprecations = /* @__PURE__ */ new Set();
    exports.getOptions = function(options, def) {
      if (typeof options === "object" && options !== null) {
        return options;
      }
      if (def !== void 0) {
        return def;
      }
      return {};
    };
    exports.emptyOptions = Object.freeze({});
    exports.noop = function() {
    };
    exports.resolvedPromise = Promise.resolve();
    exports.deprecate = function(message) {
      if (!deprecations.has(message)) {
        deprecations.add(message);
        const c = globalThis.console;
        if (typeof c !== "undefined" && typeof c.warn === "function") {
          c.warn(new ModuleError(message, { code: "LEVEL_LEGACY" }));
        }
      }
    };
  }
});

// ../node_modules/abstract-level/lib/errors.js
var require_errors = __commonJS({
  "../node_modules/abstract-level/lib/errors.js"(exports) {
    "use strict";
    var ModuleError = require_module_error();
    var AbortError = class extends ModuleError {
      constructor(cause) {
        super("Operation has been aborted", {
          code: "LEVEL_ABORTED",
          cause
        });
      }
      // Set name to AbortError for web compatibility. See:
      // https://dom.spec.whatwg.org/#aborting-ongoing-activities
      // https://github.com/nodejs/node/pull/35911#discussion_r515779306
      get name() {
        return "AbortError";
      }
    };
    exports.AbortError = AbortError;
  }
});

// ../node_modules/abstract-level/abstract-iterator.js
var require_abstract_iterator = __commonJS({
  "../node_modules/abstract-level/abstract-iterator.js"(exports) {
    "use strict";
    var ModuleError = require_module_error();
    var combineErrors = require_maybe_combine_errors();
    var { getOptions, emptyOptions, noop } = require_common();
    var { AbortError } = require_errors();
    var kDecodeOne = Symbol("decodeOne");
    var kDecodeMany = Symbol("decodeMany");
    var kKeyEncoding = Symbol("keyEncoding");
    var kValueEncoding = Symbol("valueEncoding");
    var CommonIterator = class {
      #working = false;
      #pendingClose = null;
      #closingPromise = null;
      #count = 0;
      #signal;
      #limit;
      #ended;
      #snapshot;
      constructor(db, options) {
        if (typeof db !== "object" || db === null) {
          const hint = db === null ? "null" : typeof db;
          throw new TypeError(`The first argument must be an abstract-level database, received ${hint}`);
        }
        if (typeof options !== "object" || options === null) {
          throw new TypeError("The second argument must be an options object");
        }
        this[kKeyEncoding] = options[kKeyEncoding];
        this[kValueEncoding] = options[kValueEncoding];
        this.#limit = Number.isInteger(options.limit) && options.limit >= 0 ? options.limit : Infinity;
        this.#signal = options.signal != null ? options.signal : null;
        this.#snapshot = options.snapshot != null ? options.snapshot : null;
        this.#ended = false;
        this.db = db;
        this.db.attachResource(this);
      }
      get count() {
        return this.#count;
      }
      get limit() {
        return this.#limit;
      }
      async next() {
        this.#startWork();
        try {
          if (this.#ended || this.#count >= this.#limit) {
            this.#ended = true;
            return void 0;
          }
          let item = await this._next();
          if (item === void 0) {
            this.#ended = true;
            return void 0;
          }
          try {
            item = this[kDecodeOne](item);
          } catch (err) {
            throw new IteratorDecodeError(err);
          }
          this.#count++;
          return item;
        } finally {
          this.#endWork();
        }
      }
      async _next() {
      }
      async nextv(size, options) {
        if (!Number.isInteger(size)) {
          throw new TypeError("The first argument 'size' must be an integer");
        }
        options = getOptions(options, emptyOptions);
        if (size < 1) size = 1;
        if (this.#limit < Infinity) size = Math.min(size, this.#limit - this.#count);
        this.#startWork();
        try {
          if (this.#ended || size <= 0) {
            this.#ended = true;
            return [];
          }
          const items = await this._nextv(size, options);
          if (items.length === 0) {
            this.#ended = true;
            return items;
          }
          try {
            this[kDecodeMany](items);
          } catch (err) {
            throw new IteratorDecodeError(err);
          }
          this.#count += items.length;
          return items;
        } finally {
          this.#endWork();
        }
      }
      async _nextv(size, options) {
        const acc = [];
        while (acc.length < size) {
          const item = await this._next(options);
          if (item !== void 0) {
            acc.push(item);
          } else {
            this.#ended = true;
            break;
          }
        }
        return acc;
      }
      async all(options) {
        options = getOptions(options, emptyOptions);
        this.#startWork();
        try {
          if (this.#ended || this.#count >= this.#limit) {
            return [];
          }
          const items = await this._all(options);
          try {
            this[kDecodeMany](items);
          } catch (err) {
            throw new IteratorDecodeError(err);
          }
          this.#count += items.length;
          return items;
        } catch (err) {
          this.#endWork();
          await this.#destroy(err);
        } finally {
          this.#ended = true;
          if (this.#working) {
            this.#endWork();
            await this.close();
          }
        }
      }
      async _all(options) {
        let count = this.#count;
        const acc = [];
        while (true) {
          const size = this.#limit < Infinity ? Math.min(1e3, this.#limit - count) : 1e3;
          if (size <= 0) {
            return acc;
          }
          const items = await this._nextv(size, options);
          if (items.length === 0) {
            return acc;
          }
          acc.push.apply(acc, items);
          count += items.length;
        }
      }
      seek(target, options) {
        options = getOptions(options, emptyOptions);
        if (this.#closingPromise !== null) {
        } else if (this.#working) {
          throw new ModuleError("Iterator is busy: cannot call seek() until next() has completed", {
            code: "LEVEL_ITERATOR_BUSY"
          });
        } else {
          const keyEncoding = this.db.keyEncoding(options.keyEncoding || this[kKeyEncoding]);
          const keyFormat = keyEncoding.format;
          if (options.keyEncoding !== keyFormat) {
            options = { ...options, keyEncoding: keyFormat };
          }
          const mapped = this.db.prefixKey(keyEncoding.encode(target), keyFormat, false);
          this._seek(mapped, options);
          this.#ended = false;
        }
      }
      _seek(target, options) {
        throw new ModuleError("Iterator does not implement seek()", {
          code: "LEVEL_NOT_SUPPORTED"
        });
      }
      async close() {
        if (this.#closingPromise !== null) {
          return this.#closingPromise.catch(noop);
        }
        this.#closingPromise = new Promise((resolve, reject) => {
          this.#pendingClose = () => {
            this.#pendingClose = null;
            this.#privateClose().then(resolve, reject);
          };
        });
        if (!this.#working) {
          this.#pendingClose();
        }
        return this.#closingPromise;
      }
      async _close() {
      }
      async *[Symbol.asyncIterator]() {
        try {
          let item;
          while ((item = await this.next()) !== void 0) {
            yield item;
          }
        } catch (err) {
          await this.#destroy(err);
        } finally {
          await this.close();
        }
      }
      #startWork() {
        if (this.#closingPromise !== null) {
          throw new ModuleError("Iterator is not open: cannot read after close()", {
            code: "LEVEL_ITERATOR_NOT_OPEN"
          });
        } else if (this.#working) {
          throw new ModuleError("Iterator is busy: cannot read until previous read has completed", {
            code: "LEVEL_ITERATOR_BUSY"
          });
        } else if (this.#signal?.aborted) {
          throw new AbortError();
        }
        this.#snapshot?.ref();
        this.#working = true;
      }
      #endWork() {
        this.#working = false;
        this.#pendingClose?.();
        this.#snapshot?.unref();
      }
      async #privateClose() {
        await this._close();
        this.db.detachResource(this);
      }
      async #destroy(err) {
        try {
          await this.close();
        } catch (closeErr) {
          throw combineErrors([err, closeErr]);
        }
        throw err;
      }
    };
    if (typeof Symbol.asyncDispose === "symbol") {
      CommonIterator.prototype[Symbol.asyncDispose] = async function() {
        return this.close();
      };
    }
    var AbstractIterator = class extends CommonIterator {
      #keys;
      #values;
      constructor(db, options) {
        super(db, options);
        this.#keys = options.keys !== false;
        this.#values = options.values !== false;
      }
      [kDecodeOne](entry) {
        const key = entry[0];
        const value = entry[1];
        if (key !== void 0) {
          entry[0] = this.#keys ? this[kKeyEncoding].decode(key) : void 0;
        }
        if (value !== void 0) {
          entry[1] = this.#values ? this[kValueEncoding].decode(value) : void 0;
        }
        return entry;
      }
      [kDecodeMany](entries) {
        const keyEncoding = this[kKeyEncoding];
        const valueEncoding = this[kValueEncoding];
        for (const entry of entries) {
          const key = entry[0];
          const value = entry[1];
          if (key !== void 0) entry[0] = this.#keys ? keyEncoding.decode(key) : void 0;
          if (value !== void 0) entry[1] = this.#values ? valueEncoding.decode(value) : void 0;
        }
      }
    };
    var AbstractKeyIterator = class extends CommonIterator {
      [kDecodeOne](key) {
        return this[kKeyEncoding].decode(key);
      }
      [kDecodeMany](keys) {
        const keyEncoding = this[kKeyEncoding];
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (key !== void 0) keys[i] = keyEncoding.decode(key);
        }
      }
    };
    var AbstractValueIterator = class extends CommonIterator {
      [kDecodeOne](value) {
        return this[kValueEncoding].decode(value);
      }
      [kDecodeMany](values) {
        const valueEncoding = this[kValueEncoding];
        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          if (value !== void 0) values[i] = valueEncoding.decode(value);
        }
      }
    };
    var IteratorDecodeError = class extends ModuleError {
      constructor(cause) {
        super("Iterator could not decode data", {
          code: "LEVEL_DECODE_ERROR",
          cause
        });
      }
    };
    AbstractIterator.keyEncoding = kKeyEncoding;
    AbstractIterator.valueEncoding = kValueEncoding;
    exports.AbstractIterator = AbstractIterator;
    exports.AbstractKeyIterator = AbstractKeyIterator;
    exports.AbstractValueIterator = AbstractValueIterator;
  }
});

// ../node_modules/abstract-level/lib/default-kv-iterator.js
var require_default_kv_iterator = __commonJS({
  "../node_modules/abstract-level/lib/default-kv-iterator.js"(exports) {
    "use strict";
    var { AbstractKeyIterator, AbstractValueIterator } = require_abstract_iterator();
    var kIterator = Symbol("iterator");
    var kHandleOne = Symbol("handleOne");
    var kHandleMany = Symbol("handleMany");
    var DefaultKeyIterator = class extends AbstractKeyIterator {
      constructor(db, options) {
        super(db, options);
        this[kIterator] = db.iterator({ ...options, keys: true, values: false });
      }
      [kHandleOne](entry) {
        return entry[0];
      }
      [kHandleMany](entries) {
        for (let i = 0; i < entries.length; i++) {
          entries[i] = entries[i][0];
        }
      }
    };
    var DefaultValueIterator = class extends AbstractValueIterator {
      constructor(db, options) {
        super(db, options);
        this[kIterator] = db.iterator({ ...options, keys: false, values: true });
      }
      [kHandleOne](entry) {
        return entry[1];
      }
      [kHandleMany](entries) {
        for (let i = 0; i < entries.length; i++) {
          entries[i] = entries[i][1];
        }
      }
    };
    for (const Iterator of [DefaultKeyIterator, DefaultValueIterator]) {
      Iterator.prototype._next = async function() {
        const entry = await this[kIterator].next();
        return entry === void 0 ? entry : this[kHandleOne](entry);
      };
      Iterator.prototype._nextv = async function(size, options) {
        const entries = await this[kIterator].nextv(size, options);
        this[kHandleMany](entries);
        return entries;
      };
      Iterator.prototype._all = async function(options) {
        const entries = await this[kIterator].all(options);
        this[kHandleMany](entries);
        return entries;
      };
      Iterator.prototype._seek = function(target, options) {
        this[kIterator].seek(target, options);
      };
      Iterator.prototype._close = async function() {
        return this[kIterator].close();
      };
    }
    exports.DefaultKeyIterator = DefaultKeyIterator;
    exports.DefaultValueIterator = DefaultValueIterator;
  }
});

// ../node_modules/abstract-level/lib/deferred-iterator.js
var require_deferred_iterator = __commonJS({
  "../node_modules/abstract-level/lib/deferred-iterator.js"(exports) {
    "use strict";
    var { AbstractIterator, AbstractKeyIterator, AbstractValueIterator } = require_abstract_iterator();
    var ModuleError = require_module_error();
    var kNut = Symbol("nut");
    var kUndefer = Symbol("undefer");
    var kFactory = Symbol("factory");
    var kSignalOptions = Symbol("signalOptions");
    var DeferredIterator = class extends AbstractIterator {
      constructor(db, options) {
        super(db, options);
        this[kNut] = null;
        this[kFactory] = () => db.iterator(options);
        this[kSignalOptions] = { signal: options.signal };
        this.db.defer(() => this[kUndefer](), this[kSignalOptions]);
      }
    };
    var DeferredKeyIterator = class extends AbstractKeyIterator {
      constructor(db, options) {
        super(db, options);
        this[kNut] = null;
        this[kFactory] = () => db.keys(options);
        this[kSignalOptions] = { signal: options.signal };
        this.db.defer(() => this[kUndefer](), this[kSignalOptions]);
      }
    };
    var DeferredValueIterator = class extends AbstractValueIterator {
      constructor(db, options) {
        super(db, options);
        this[kNut] = null;
        this[kFactory] = () => db.values(options);
        this[kSignalOptions] = { signal: options.signal };
        this.db.defer(() => this[kUndefer](), this[kSignalOptions]);
      }
    };
    for (const Iterator of [DeferredIterator, DeferredKeyIterator, DeferredValueIterator]) {
      Iterator.prototype[kUndefer] = function() {
        if (this.db.status === "open") {
          this[kNut] = this[kFactory]();
        }
      };
      Iterator.prototype._next = async function() {
        if (this[kNut] !== null) {
          return this[kNut].next();
        } else if (this.db.status === "opening") {
          return this.db.deferAsync(() => this._next(), this[kSignalOptions]);
        } else {
          throw new ModuleError("Iterator is not open: cannot call next() after close()", {
            code: "LEVEL_ITERATOR_NOT_OPEN"
          });
        }
      };
      Iterator.prototype._nextv = async function(size, options) {
        if (this[kNut] !== null) {
          return this[kNut].nextv(size, options);
        } else if (this.db.status === "opening") {
          return this.db.deferAsync(() => this._nextv(size, options), this[kSignalOptions]);
        } else {
          throw new ModuleError("Iterator is not open: cannot call nextv() after close()", {
            code: "LEVEL_ITERATOR_NOT_OPEN"
          });
        }
      };
      Iterator.prototype._all = async function(options) {
        if (this[kNut] !== null) {
          return this[kNut].all();
        } else if (this.db.status === "opening") {
          return this.db.deferAsync(() => this._all(options), this[kSignalOptions]);
        } else {
          throw new ModuleError("Iterator is not open: cannot call all() after close()", {
            code: "LEVEL_ITERATOR_NOT_OPEN"
          });
        }
      };
      Iterator.prototype._seek = function(target, options) {
        if (this[kNut] !== null) {
          this[kNut]._seek(target, options);
        } else if (this.db.status === "opening") {
          this.db.defer(() => this._seek(target, options), this[kSignalOptions]);
        }
      };
      Iterator.prototype._close = async function() {
        if (this[kNut] !== null) {
          return this[kNut].close();
        } else if (this.db.status === "opening") {
          return this.db.deferAsync(() => this._close());
        }
      };
    }
    exports.DeferredIterator = DeferredIterator;
    exports.DeferredKeyIterator = DeferredKeyIterator;
    exports.DeferredValueIterator = DeferredValueIterator;
  }
});

// ../node_modules/abstract-level/lib/prefixes.js
var require_prefixes = __commonJS({
  "../node_modules/abstract-level/lib/prefixes.js"(exports) {
    "use strict";
    exports.prefixDescendantKey = function(key, keyFormat, descendant, ancestor) {
      while (descendant !== null && descendant !== ancestor) {
        key = descendant.prefixKey(key, keyFormat, true);
        descendant = descendant.parent;
      }
      return key;
    };
    exports.isDescendant = function(db, ancestor) {
      while (true) {
        if (db.parent == null) return false;
        if (db.parent === ancestor) return true;
        db = db.parent;
      }
    };
  }
});

// ../node_modules/abstract-level/lib/prewrite-batch.js
var require_prewrite_batch = __commonJS({
  "../node_modules/abstract-level/lib/prewrite-batch.js"(exports) {
    "use strict";
    var { prefixDescendantKey, isDescendant } = require_prefixes();
    var PrewriteBatch = class {
      #db;
      #privateOperations;
      #publicOperations;
      constructor(db, privateOperations, publicOperations) {
        this.#db = db;
        this.#privateOperations = privateOperations;
        this.#publicOperations = publicOperations;
      }
      add(op) {
        const isPut = op.type === "put";
        const delegated = op.sublevel != null;
        const db = delegated ? op.sublevel : this.#db;
        db._assertValidKey(op.key);
        op.keyEncoding = db.keyEncoding(op.keyEncoding);
        if (isPut) {
          db._assertValidValue(op.value);
          op.valueEncoding = db.valueEncoding(op.valueEncoding);
        } else if (op.type !== "del") {
          throw new TypeError("A batch operation must have a type property that is 'put' or 'del'");
        }
        const keyEncoding = op.keyEncoding;
        const preencodedKey = keyEncoding.encode(op.key);
        const keyFormat = keyEncoding.format;
        const siblings = delegated && !isDescendant(op.sublevel, this.#db) && op.sublevel !== this.#db;
        const encodedKey = delegated && !siblings ? prefixDescendantKey(preencodedKey, keyFormat, db, this.#db) : preencodedKey;
        if (delegated && !siblings) {
          op.sublevel = null;
        }
        let publicOperation = null;
        if (this.#publicOperations !== null && !siblings) {
          publicOperation = { ...op };
          publicOperation.encodedKey = encodedKey;
          if (delegated) {
            publicOperation.key = encodedKey;
            publicOperation.keyEncoding = this.#db.keyEncoding(keyFormat);
          }
          this.#publicOperations.push(publicOperation);
        }
        op.key = siblings ? encodedKey : this.#db.prefixKey(encodedKey, keyFormat, true);
        op.keyEncoding = keyFormat;
        if (isPut) {
          const valueEncoding = op.valueEncoding;
          const encodedValue = valueEncoding.encode(op.value);
          const valueFormat = valueEncoding.format;
          op.value = encodedValue;
          op.valueEncoding = valueFormat;
          if (publicOperation !== null) {
            publicOperation.encodedValue = encodedValue;
            if (delegated) {
              publicOperation.value = encodedValue;
              publicOperation.valueEncoding = this.#db.valueEncoding(valueFormat);
            }
          }
        }
        this.#privateOperations.push(op);
        return this;
      }
    };
    exports.PrewriteBatch = PrewriteBatch;
  }
});

// ../node_modules/abstract-level/abstract-chained-batch.js
var require_abstract_chained_batch = __commonJS({
  "../node_modules/abstract-level/abstract-chained-batch.js"(exports) {
    "use strict";
    var combineErrors = require_maybe_combine_errors();
    var ModuleError = require_module_error();
    var { getOptions, emptyOptions, noop } = require_common();
    var { prefixDescendantKey, isDescendant } = require_prefixes();
    var { PrewriteBatch } = require_prewrite_batch();
    var kPublicOperations = Symbol("publicOperations");
    var kPrivateOperations = Symbol("privateOperations");
    var AbstractChainedBatch = class {
      #status = "open";
      #length = 0;
      #closePromise = null;
      #publicOperations;
      #prewriteRun;
      #prewriteBatch;
      #prewriteData;
      #addMode;
      constructor(db, options) {
        if (typeof db !== "object" || db === null) {
          const hint = db === null ? "null" : typeof db;
          throw new TypeError(`The first argument must be an abstract-level database, received ${hint}`);
        }
        const enableWriteEvent = db.listenerCount("write") > 0;
        const enablePrewriteHook = !db.hooks.prewrite.noop;
        this.#publicOperations = enableWriteEvent ? [] : null;
        this.#addMode = getOptions(options, emptyOptions).add === true;
        if (enablePrewriteHook) {
          const data = new PrewriteData([], enableWriteEvent ? [] : null);
          this.#prewriteData = data;
          this.#prewriteBatch = new PrewriteBatch(db, data[kPrivateOperations], data[kPublicOperations]);
          this.#prewriteRun = db.hooks.prewrite.run;
        } else {
          this.#prewriteData = null;
          this.#prewriteBatch = null;
          this.#prewriteRun = null;
        }
        this.db = db;
        this.db.attachResource(this);
      }
      get length() {
        if (this.#prewriteData !== null) {
          return this.#length + this.#prewriteData.length;
        } else {
          return this.#length;
        }
      }
      put(key, value, options) {
        this.#assertStatus();
        options = getOptions(options, emptyOptions);
        const delegated = options.sublevel != null;
        const db = delegated ? options.sublevel : this.db;
        db._assertValidKey(key);
        db._assertValidValue(value);
        const op = {
          ...options,
          type: "put",
          key,
          value,
          keyEncoding: db.keyEncoding(options.keyEncoding),
          valueEncoding: db.valueEncoding(options.valueEncoding)
        };
        if (this.#prewriteRun !== null) {
          try {
            this.#prewriteRun(op, this.#prewriteBatch);
            op.keyEncoding = db.keyEncoding(op.keyEncoding);
            op.valueEncoding = db.valueEncoding(op.valueEncoding);
          } catch (err) {
            throw new ModuleError("The prewrite hook failed on batch.put()", {
              code: "LEVEL_HOOK_ERROR",
              cause: err
            });
          }
        }
        const keyEncoding = op.keyEncoding;
        const preencodedKey = keyEncoding.encode(op.key);
        const keyFormat = keyEncoding.format;
        const siblings = delegated && !isDescendant(op.sublevel, this.db) && op.sublevel !== this.db;
        const encodedKey = delegated && !siblings ? prefixDescendantKey(preencodedKey, keyFormat, db, this.db) : preencodedKey;
        const valueEncoding = op.valueEncoding;
        const encodedValue = valueEncoding.encode(op.value);
        const valueFormat = valueEncoding.format;
        if (delegated && !siblings) {
          op.sublevel = null;
        }
        if (this.#publicOperations !== null && !siblings) {
          const publicOperation = { ...op };
          publicOperation.encodedKey = encodedKey;
          publicOperation.encodedValue = encodedValue;
          if (delegated) {
            publicOperation.key = encodedKey;
            publicOperation.value = encodedValue;
            publicOperation.keyEncoding = this.db.keyEncoding(keyFormat);
            publicOperation.valueEncoding = this.db.valueEncoding(valueFormat);
          }
          this.#publicOperations.push(publicOperation);
        }
        op.key = siblings ? encodedKey : this.db.prefixKey(encodedKey, keyFormat, true);
        op.value = encodedValue;
        op.keyEncoding = keyFormat;
        op.valueEncoding = valueFormat;
        if (this.#addMode) {
          this._add(op);
        } else {
          this._put(op.key, encodedValue, op);
        }
        this.#length++;
        return this;
      }
      _put(key, value, options) {
      }
      del(key, options) {
        this.#assertStatus();
        options = getOptions(options, emptyOptions);
        const delegated = options.sublevel != null;
        const db = delegated ? options.sublevel : this.db;
        db._assertValidKey(key);
        const op = {
          ...options,
          type: "del",
          key,
          keyEncoding: db.keyEncoding(options.keyEncoding)
        };
        if (this.#prewriteRun !== null) {
          try {
            this.#prewriteRun(op, this.#prewriteBatch);
            op.keyEncoding = db.keyEncoding(op.keyEncoding);
          } catch (err) {
            throw new ModuleError("The prewrite hook failed on batch.del()", {
              code: "LEVEL_HOOK_ERROR",
              cause: err
            });
          }
        }
        const keyEncoding = op.keyEncoding;
        const preencodedKey = keyEncoding.encode(op.key);
        const keyFormat = keyEncoding.format;
        const encodedKey = delegated ? prefixDescendantKey(preencodedKey, keyFormat, db, this.db) : preencodedKey;
        if (delegated) op.sublevel = null;
        if (this.#publicOperations !== null) {
          const publicOperation = { ...op };
          publicOperation.encodedKey = encodedKey;
          if (delegated) {
            publicOperation.key = encodedKey;
            publicOperation.keyEncoding = this.db.keyEncoding(keyFormat);
          }
          this.#publicOperations.push(publicOperation);
        }
        op.key = this.db.prefixKey(encodedKey, keyFormat, true);
        op.keyEncoding = keyFormat;
        if (this.#addMode) {
          this._add(op);
        } else {
          this._del(op.key, op);
        }
        this.#length++;
        return this;
      }
      _del(key, options) {
      }
      _add(op) {
      }
      clear() {
        this.#assertStatus();
        this._clear();
        if (this.#publicOperations !== null) this.#publicOperations = [];
        if (this.#prewriteData !== null) this.#prewriteData.clear();
        this.#length = 0;
        return this;
      }
      _clear() {
      }
      async write(options) {
        this.#assertStatus();
        options = getOptions(options);
        if (this.#length === 0) {
          return this.close();
        } else {
          this.#status = "writing";
          const close = this.#prepareClose();
          try {
            if (this.#prewriteData !== null) {
              const publicOperations = this.#prewriteData[kPublicOperations];
              const privateOperations = this.#prewriteData[kPrivateOperations];
              const length = this.#prewriteData.length;
              for (let i = 0; i < length; i++) {
                const op = privateOperations[i];
                if (this.#addMode) {
                  this._add(op);
                } else if (op.type === "put") {
                  this._put(op.key, op.value, op);
                } else {
                  this._del(op.key, op);
                }
              }
              if (publicOperations !== null && length !== 0) {
                this.#publicOperations = this.#publicOperations.concat(publicOperations);
              }
            }
            await this._write(options);
          } catch (err) {
            close();
            try {
              await this.#closePromise;
            } catch (closeErr) {
              err = combineErrors([err, closeErr]);
            }
            throw err;
          }
          close();
          if (this.#publicOperations !== null) {
            this.db.emit("write", this.#publicOperations);
          }
          return this.#closePromise;
        }
      }
      async _write(options) {
      }
      async close() {
        if (this.#closePromise !== null) {
          return this.#closePromise.catch(noop);
        } else {
          this.#prepareClose()();
          return this.#closePromise;
        }
      }
      async _close() {
      }
      #assertStatus() {
        if (this.#status !== "open") {
          throw new ModuleError("Batch is not open: cannot change operations after write() or close()", {
            code: "LEVEL_BATCH_NOT_OPEN"
          });
        }
        if (this.db.status !== "open") {
          throw new ModuleError("Database is not open", {
            code: "LEVEL_DATABASE_NOT_OPEN"
          });
        }
      }
      #prepareClose() {
        let close;
        this.#closePromise = new Promise((resolve, reject) => {
          close = () => {
            this.#privateClose().then(resolve, reject);
          };
        });
        return close;
      }
      async #privateClose() {
        this.#status = "closing";
        await this._close();
        this.db.detachResource(this);
      }
    };
    if (typeof Symbol.asyncDispose === "symbol") {
      AbstractChainedBatch.prototype[Symbol.asyncDispose] = async function() {
        return this.close();
      };
    }
    var PrewriteData = class {
      constructor(privateOperations, publicOperations) {
        this[kPrivateOperations] = privateOperations;
        this[kPublicOperations] = publicOperations;
      }
      get length() {
        return this[kPrivateOperations].length;
      }
      clear() {
        for (const k of [kPublicOperations, kPrivateOperations]) {
          const ops = this[k];
          if (ops !== null) {
            ops.splice(0, ops.length);
          }
        }
      }
    };
    exports.AbstractChainedBatch = AbstractChainedBatch;
  }
});

// ../node_modules/abstract-level/lib/default-chained-batch.js
var require_default_chained_batch = __commonJS({
  "../node_modules/abstract-level/lib/default-chained-batch.js"(exports) {
    "use strict";
    var { AbstractChainedBatch } = require_abstract_chained_batch();
    var DefaultChainedBatch = class extends AbstractChainedBatch {
      #encoded = [];
      constructor(db) {
        super(db, { add: true });
      }
      _add(op) {
        this.#encoded.push(op);
      }
      _clear() {
        this.#encoded = [];
      }
      async _write(options) {
        return this.db._batch(this.#encoded, options);
      }
    };
    exports.DefaultChainedBatch = DefaultChainedBatch;
  }
});

// ../node_modules/abstract-level/lib/hooks.js
var require_hooks = __commonJS({
  "../node_modules/abstract-level/lib/hooks.js"(exports) {
    "use strict";
    var { noop } = require_common();
    var DatabaseHooks = class {
      constructor() {
        this.postopen = new Hook({ async: true });
        this.prewrite = new Hook({ async: false });
        this.newsub = new Hook({ async: false });
      }
    };
    var Hook = class {
      #functions = /* @__PURE__ */ new Set();
      #isAsync;
      constructor(options) {
        this.#isAsync = options.async;
        this.noop = true;
        this.run = this.#runner();
      }
      add(fn) {
        assertFunction(fn);
        this.#functions.add(fn);
        this.noop = false;
        this.run = this.#runner();
      }
      delete(fn) {
        assertFunction(fn);
        this.#functions.delete(fn);
        this.noop = this.#functions.size === 0;
        this.run = this.#runner();
      }
      #runner() {
        if (this.noop) {
          return noop;
        } else if (this.#functions.size === 1) {
          const [fn] = this.#functions;
          return fn;
        } else if (this.#isAsync) {
          const run = async function(functions, ...args) {
            for (const fn of functions) {
              await fn(...args);
            }
          };
          return run.bind(null, Array.from(this.#functions));
        } else {
          const run = function(functions, ...args) {
            for (const fn of functions) {
              fn(...args);
            }
          };
          return run.bind(null, Array.from(this.#functions));
        }
      }
    };
    var assertFunction = function(fn) {
      if (typeof fn !== "function") {
        const hint = fn === null ? "null" : typeof fn;
        throw new TypeError(`The first argument must be a function, received ${hint}`);
      }
    };
    exports.DatabaseHooks = DatabaseHooks;
  }
});

// ../node_modules/abstract-level/lib/event-monitor.js
var require_event_monitor = __commonJS({
  "../node_modules/abstract-level/lib/event-monitor.js"(exports) {
    "use strict";
    var { deprecate } = require_common();
    exports.EventMonitor = class EventMonitor {
      constructor(emitter) {
        this.write = false;
        const beforeAdded = (name) => {
          if (name === "write") {
            this.write = true;
          }
          if (name === "put" || name === "del" || name === "batch") {
            deprecate(`The '${name}' event has been removed in favor of 'write'`);
          }
        };
        const afterRemoved = (name) => {
          if (name === "write") {
            this.write = emitter.listenerCount("write") > 0;
          }
        };
        emitter.on("newListener", beforeAdded);
        emitter.on("removeListener", afterRemoved);
      }
    };
  }
});

// ../node_modules/abstract-level/lib/deferred-queue.js
var require_deferred_queue = __commonJS({
  "../node_modules/abstract-level/lib/deferred-queue.js"(exports) {
    "use strict";
    var { getOptions, emptyOptions } = require_common();
    var { AbortError } = require_errors();
    var DeferredOperation = class {
      constructor(fn, signal) {
        this.fn = fn;
        this.signal = signal;
      }
    };
    var DeferredQueue = class {
      #operations;
      #signals;
      constructor() {
        this.#operations = [];
        this.#signals = /* @__PURE__ */ new Set();
      }
      add(fn, options) {
        options = getOptions(options, emptyOptions);
        const signal = options.signal;
        if (signal == null) {
          this.#operations.push(new DeferredOperation(fn, null));
          return;
        }
        if (signal.aborted) {
          fn(new AbortError());
          return;
        }
        if (!this.#signals.has(signal)) {
          this.#signals.add(signal);
          signal.addEventListener("abort", this.#handleAbort, { once: true });
        }
        this.#operations.push(new DeferredOperation(fn, signal));
      }
      drain() {
        const operations = this.#operations;
        const signals = this.#signals;
        this.#operations = [];
        this.#signals = /* @__PURE__ */ new Set();
        for (const signal of signals) {
          signal.removeEventListener("abort", this.#handleAbort);
        }
        for (const operation of operations) {
          operation.fn.call(null);
        }
      }
      #handleAbort = (ev) => {
        const signal = ev.target;
        const err = new AbortError();
        const aborted = [];
        this.#operations = this.#operations.filter(function(operation) {
          if (operation.signal !== null && operation.signal === signal) {
            aborted.push(operation);
            return false;
          } else {
            return true;
          }
        });
        this.#signals.delete(signal);
        for (const operation of aborted) {
          operation.fn.call(null, err);
        }
      };
    };
    exports.DeferredQueue = DeferredQueue;
  }
});

// ../node_modules/abstract-level/lib/range-options.js
var require_range_options = __commonJS({
  "../node_modules/abstract-level/lib/range-options.js"(exports, module) {
    "use strict";
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var rangeOptions = /* @__PURE__ */ new Set(["lt", "lte", "gt", "gte"]);
    module.exports = function(options, keyEncoding) {
      const result = {};
      for (const k in options) {
        if (!hasOwnProperty.call(options, k)) continue;
        if (k === "keyEncoding" || k === "valueEncoding") continue;
        if (rangeOptions.has(k)) {
          result[k] = keyEncoding.encode(options[k]);
        } else {
          result[k] = options[k];
        }
      }
      result.reverse = !!result.reverse;
      result.limit = Number.isInteger(result.limit) && result.limit >= 0 ? result.limit : -1;
      return result;
    };
  }
});

// ../node_modules/abstract-level/lib/abstract-sublevel-iterator.js
var require_abstract_sublevel_iterator = __commonJS({
  "../node_modules/abstract-level/lib/abstract-sublevel-iterator.js"(exports) {
    "use strict";
    var { AbstractIterator, AbstractKeyIterator, AbstractValueIterator } = require_abstract_iterator();
    var AbstractSublevelIterator = class extends AbstractIterator {
      #iterator;
      #unfix;
      constructor(db, options, iterator, unfix) {
        super(db, options);
        this.#iterator = iterator;
        this.#unfix = unfix;
      }
      async _next() {
        const entry = await this.#iterator.next();
        if (entry !== void 0) {
          const key = entry[0];
          if (key !== void 0) entry[0] = this.#unfix(key);
        }
        return entry;
      }
      async _nextv(size, options) {
        const entries = await this.#iterator.nextv(size, options);
        const unfix = this.#unfix;
        for (const entry of entries) {
          const key = entry[0];
          if (key !== void 0) entry[0] = unfix(key);
        }
        return entries;
      }
      async _all(options) {
        const entries = await this.#iterator.all(options);
        const unfix = this.#unfix;
        for (const entry of entries) {
          const key = entry[0];
          if (key !== void 0) entry[0] = unfix(key);
        }
        return entries;
      }
      _seek(target, options) {
        this.#iterator.seek(target, options);
      }
      async _close() {
        return this.#iterator.close();
      }
    };
    var AbstractSublevelKeyIterator = class extends AbstractKeyIterator {
      #iterator;
      #unfix;
      constructor(db, options, iterator, unfix) {
        super(db, options);
        this.#iterator = iterator;
        this.#unfix = unfix;
      }
      async _next() {
        const key = await this.#iterator.next();
        return key === void 0 ? key : this.#unfix(key);
      }
      async _nextv(size, options) {
        const keys = await this.#iterator.nextv(size, options);
        const unfix = this.#unfix;
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (key !== void 0) keys[i] = unfix(key);
        }
        return keys;
      }
      async _all(options) {
        const keys = await this.#iterator.all(options);
        const unfix = this.#unfix;
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (key !== void 0) keys[i] = unfix(key);
        }
        return keys;
      }
      _seek(target, options) {
        this.#iterator.seek(target, options);
      }
      async _close() {
        return this.#iterator.close();
      }
    };
    var AbstractSublevelValueIterator = class extends AbstractValueIterator {
      #iterator;
      constructor(db, options, iterator) {
        super(db, options);
        this.#iterator = iterator;
      }
      async _next() {
        return this.#iterator.next();
      }
      async _nextv(size, options) {
        return this.#iterator.nextv(size, options);
      }
      async _all(options) {
        return this.#iterator.all(options);
      }
      _seek(target, options) {
        this.#iterator.seek(target, options);
      }
      async _close() {
        return this.#iterator.close();
      }
    };
    exports.AbstractSublevelIterator = AbstractSublevelIterator;
    exports.AbstractSublevelKeyIterator = AbstractSublevelKeyIterator;
    exports.AbstractSublevelValueIterator = AbstractSublevelValueIterator;
  }
});

// ../node_modules/abstract-level/lib/abstract-sublevel.js
var require_abstract_sublevel = __commonJS({
  "../node_modules/abstract-level/lib/abstract-sublevel.js"(exports, module) {
    "use strict";
    var ModuleError = require_module_error();
    var { Buffer: Buffer2 } = require_buffer() || {};
    var {
      AbstractSublevelIterator,
      AbstractSublevelKeyIterator,
      AbstractSublevelValueIterator
    } = require_abstract_sublevel_iterator();
    var kRoot = Symbol("root");
    var textEncoder = new TextEncoder();
    var defaults = { separator: "!" };
    module.exports = function({ AbstractLevel }) {
      class AbstractSublevel extends AbstractLevel {
        #globalPrefix;
        #localPrefix;
        #localPath;
        #globalPath;
        #globalUpperBound;
        #parent;
        #unfix;
        static defaults(options) {
          if (options == null) {
            return defaults;
          } else if (!options.separator) {
            return { ...options, separator: "!" };
          } else {
            return options;
          }
        }
        constructor(db, name, options) {
          const { separator, manifest, ...forward } = AbstractSublevel.defaults(options);
          const names = [].concat(name).map((name2) => trim(name2, separator));
          const reserved = separator.charCodeAt(0) + 1;
          const root = db[kRoot] || db;
          if (!names.every((name2) => textEncoder.encode(name2).every((x) => x > reserved && x < 127))) {
            throw new ModuleError(`Sublevel name must use bytes > ${reserved} < ${127}`, {
              code: "LEVEL_INVALID_PREFIX"
            });
          }
          super(mergeManifests(db, manifest), forward);
          const localPrefix = names.map((name2) => separator + name2 + separator).join("");
          const globalPrefix = (db.prefix || "") + localPrefix;
          const globalUpperBound = globalPrefix.slice(0, -1) + String.fromCharCode(reserved);
          this[kRoot] = root;
          this.#parent = db;
          this.#localPath = names;
          this.#globalPath = db.prefix ? db.path().concat(names) : names;
          this.#globalPrefix = new MultiFormat(globalPrefix);
          this.#globalUpperBound = new MultiFormat(globalUpperBound);
          this.#localPrefix = new MultiFormat(localPrefix);
          this.#unfix = new Unfixer();
        }
        prefixKey(key, keyFormat, local) {
          const prefix = local ? this.#localPrefix : this.#globalPrefix;
          if (keyFormat === "utf8") {
            return prefix.utf8 + key;
          } else if (key.byteLength === 0) {
            return prefix[keyFormat];
          } else if (keyFormat === "view") {
            const view = prefix.view;
            const result = new Uint8Array(view.byteLength + key.byteLength);
            result.set(view, 0);
            result.set(key, view.byteLength);
            return result;
          } else {
            const buffer = prefix.buffer;
            return Buffer2.concat([buffer, key], buffer.byteLength + key.byteLength);
          }
        }
        // Not exposed for now.
        #prefixRange(range, keyFormat) {
          if (range.gte !== void 0) {
            range.gte = this.prefixKey(range.gte, keyFormat, false);
          } else if (range.gt !== void 0) {
            range.gt = this.prefixKey(range.gt, keyFormat, false);
          } else {
            range.gte = this.#globalPrefix[keyFormat];
          }
          if (range.lte !== void 0) {
            range.lte = this.prefixKey(range.lte, keyFormat, false);
          } else if (range.lt !== void 0) {
            range.lt = this.prefixKey(range.lt, keyFormat, false);
          } else {
            range.lte = this.#globalUpperBound[keyFormat];
          }
        }
        get prefix() {
          return this.#globalPrefix.utf8;
        }
        get db() {
          return this[kRoot];
        }
        get parent() {
          return this.#parent;
        }
        path(local = false) {
          return local ? this.#localPath : this.#globalPath;
        }
        async _open(options) {
          await this.#parent.open({ passive: true });
          this.#parent.attachResource(this);
        }
        async _close() {
          this.#parent.detachResource(this);
        }
        async _put(key, value, options) {
          return this.#parent.put(key, value, options);
        }
        async _get(key, options) {
          return this.#parent.get(key, options);
        }
        _getSync(key, options) {
          return this.#parent.getSync(key, options);
        }
        async _getMany(keys, options) {
          return this.#parent.getMany(keys, options);
        }
        async _has(key, options) {
          return this.#parent.has(key, options);
        }
        async _hasMany(keys, options) {
          return this.#parent.hasMany(keys, options);
        }
        async _del(key, options) {
          return this.#parent.del(key, options);
        }
        async _batch(operations, options) {
          return this.#parent.batch(operations, options);
        }
        // TODO: call parent instead of root
        async _clear(options) {
          this.#prefixRange(options, options.keyEncoding);
          return this[kRoot].clear(options);
        }
        // TODO: call parent instead of root
        _iterator(options) {
          this.#prefixRange(options, options.keyEncoding);
          const iterator = this[kRoot].iterator(options);
          const unfix = this.#unfix.get(this.#globalPrefix.utf8.length, options.keyEncoding);
          return new AbstractSublevelIterator(this, options, iterator, unfix);
        }
        _keys(options) {
          this.#prefixRange(options, options.keyEncoding);
          const iterator = this[kRoot].keys(options);
          const unfix = this.#unfix.get(this.#globalPrefix.utf8.length, options.keyEncoding);
          return new AbstractSublevelKeyIterator(this, options, iterator, unfix);
        }
        _values(options) {
          this.#prefixRange(options, options.keyEncoding);
          const iterator = this[kRoot].values(options);
          return new AbstractSublevelValueIterator(this, options, iterator);
        }
        _snapshot(options) {
          return this[kRoot].snapshot(options);
        }
      }
      return { AbstractSublevel };
    };
    var mergeManifests = function(parent, manifest) {
      return {
        // Inherit manifest of parent db
        ...parent.supports,
        // Disable unsupported features
        createIfMissing: false,
        errorIfExists: false,
        // Unset additional events because we're not forwarding them
        events: {},
        // Unset additional methods (like approximateSize) which we can't support here unless
        // the AbstractSublevel class is overridden by an implementation of `abstract-level`.
        additionalMethods: {},
        // Inherit manifest of custom AbstractSublevel subclass. Such a class is not
        // allowed to override encodings.
        ...manifest,
        encodings: {
          utf8: supportsEncoding(parent, "utf8"),
          buffer: supportsEncoding(parent, "buffer"),
          view: supportsEncoding(parent, "view")
        }
      };
    };
    var supportsEncoding = function(parent, encoding) {
      return parent.supports.encodings[encoding] ? parent.keyEncoding(encoding).name === encoding : false;
    };
    var MultiFormat = class {
      constructor(key) {
        this.utf8 = key;
        this.view = textEncoder.encode(key);
        this.buffer = Buffer2 ? Buffer2.from(this.view.buffer, 0, this.view.byteLength) : {};
      }
    };
    var Unfixer = class {
      constructor() {
        this.cache = /* @__PURE__ */ new Map();
      }
      get(prefixLength, keyFormat) {
        let unfix = this.cache.get(keyFormat);
        if (unfix === void 0) {
          if (keyFormat === "view") {
            unfix = function(prefixLength2, key) {
              return key.subarray(prefixLength2);
            }.bind(null, prefixLength);
          } else {
            unfix = function(prefixLength2, key) {
              return key.slice(prefixLength2);
            }.bind(null, prefixLength);
          }
          this.cache.set(keyFormat, unfix);
        }
        return unfix;
      }
    };
    var trim = function(str, char) {
      let start = 0;
      let end = str.length;
      while (start < end && str[start] === char) start++;
      while (end > start && str[end - 1] === char) end--;
      return str.slice(start, end);
    };
  }
});

// ../node_modules/abstract-level/abstract-level.js
var require_abstract_level = __commonJS({
  "../node_modules/abstract-level/abstract-level.js"(exports) {
    "use strict";
    var { supports } = require_level_supports();
    var { Transcoder } = require_level_transcoder();
    var { EventEmitter } = require_events();
    var ModuleError = require_module_error();
    var combineErrors = require_maybe_combine_errors();
    var { AbstractIterator } = require_abstract_iterator();
    var { DefaultKeyIterator, DefaultValueIterator } = require_default_kv_iterator();
    var { DeferredIterator, DeferredKeyIterator, DeferredValueIterator } = require_deferred_iterator();
    var { DefaultChainedBatch } = require_default_chained_batch();
    var { DatabaseHooks } = require_hooks();
    var { PrewriteBatch } = require_prewrite_batch();
    var { EventMonitor } = require_event_monitor();
    var { getOptions, noop, emptyOptions, resolvedPromise } = require_common();
    var { prefixDescendantKey, isDescendant } = require_prefixes();
    var { DeferredQueue } = require_deferred_queue();
    var rangeOptions = require_range_options();
    var AbstractLevel = class extends EventEmitter {
      #status = "opening";
      #deferOpen = true;
      #statusChange = null;
      #statusLocked = false;
      #resources;
      #queue;
      #options;
      #defaultOptions;
      #transcoder;
      #keyEncoding;
      #valueEncoding;
      #eventMonitor;
      constructor(manifest, options) {
        super();
        if (typeof manifest !== "object" || manifest === null) {
          throw new TypeError("The first argument 'manifest' must be an object");
        }
        options = getOptions(options);
        const { keyEncoding, valueEncoding, passive, ...forward } = options;
        this.#resources = /* @__PURE__ */ new Set();
        this.#queue = new DeferredQueue();
        this.#options = forward;
        const implicitSnapshots = manifest.snapshots !== false && manifest.implicitSnapshots !== false;
        this.hooks = new DatabaseHooks();
        this.supports = supports(manifest, {
          deferredOpen: true,
          seek: true,
          implicitSnapshots,
          permanence: manifest.permanence !== false,
          encodings: manifest.encodings || {},
          events: {
            ...manifest.events,
            opening: true,
            open: true,
            closing: true,
            closed: true,
            write: true,
            clear: true
          }
        });
        this.#eventMonitor = new EventMonitor(this);
        this.#transcoder = new Transcoder(formats(this));
        this.#keyEncoding = this.#transcoder.encoding(keyEncoding || "utf8");
        this.#valueEncoding = this.#transcoder.encoding(valueEncoding || "utf8");
        for (const encoding of this.#transcoder.encodings()) {
          if (!this.supports.encodings[encoding.commonName]) {
            this.supports.encodings[encoding.commonName] = true;
          }
        }
        this.#defaultOptions = {
          empty: emptyOptions,
          entry: Object.freeze({
            keyEncoding: this.#keyEncoding.commonName,
            valueEncoding: this.#valueEncoding.commonName
          }),
          entryFormat: Object.freeze({
            keyEncoding: this.#keyEncoding.format,
            valueEncoding: this.#valueEncoding.format
          }),
          key: Object.freeze({
            keyEncoding: this.#keyEncoding.commonName
          }),
          keyFormat: Object.freeze({
            keyEncoding: this.#keyEncoding.format
          }),
          owner: Object.freeze({
            owner: this
          })
        };
        queueMicrotask(() => {
          if (this.#deferOpen) {
            this.open({ passive: false }).catch(noop);
          }
        });
      }
      get status() {
        return this.#status;
      }
      get parent() {
        return null;
      }
      keyEncoding(encoding) {
        return this.#transcoder.encoding(encoding ?? this.#keyEncoding);
      }
      valueEncoding(encoding) {
        return this.#transcoder.encoding(encoding ?? this.#valueEncoding);
      }
      async open(options) {
        options = { ...this.#options, ...getOptions(options) };
        options.createIfMissing = options.createIfMissing !== false;
        options.errorIfExists = !!options.errorIfExists;
        const postopen = this.hooks.postopen.noop ? null : this.hooks.postopen.run;
        const passive = options.passive;
        if (passive && this.#deferOpen) {
          await void 0;
        }
        this.#assertUnlocked();
        while (this.#statusChange !== null) await this.#statusChange.catch(noop);
        this.#assertUnlocked();
        if (passive) {
          if (this.#status !== "open") throw new NotOpenError();
        } else if (this.#status === "closed" || this.#deferOpen) {
          this.#deferOpen = false;
          this.#statusChange = resolvedPromise;
          this.#statusChange = (async () => {
            this.#status = "opening";
            try {
              this.emit("opening");
              await this._open(options);
            } catch (err) {
              this.#status = "closed";
              this.#queue.drain();
              try {
                await this.#closeResources();
              } catch (resourceErr) {
                err = combineErrors([err, resourceErr]);
              }
              throw new NotOpenError(err);
            }
            this.#status = "open";
            if (postopen !== null) {
              let hookErr;
              try {
                this.#statusLocked = true;
                await postopen(options);
              } catch (err) {
                hookErr = convertRejection(err);
              } finally {
                this.#statusLocked = false;
              }
              if (hookErr) {
                this.#status = "closing";
                this.#queue.drain();
                try {
                  await this.#closeResources();
                  await this._close();
                } catch (closeErr) {
                  this.#statusLocked = true;
                  hookErr = combineErrors([hookErr, closeErr]);
                }
                this.#status = "closed";
                throw new ModuleError("The postopen hook failed on open()", {
                  code: "LEVEL_HOOK_ERROR",
                  cause: hookErr
                });
              }
            }
            this.#queue.drain();
            this.emit("open");
          })();
          try {
            await this.#statusChange;
          } finally {
            this.#statusChange = null;
          }
        } else if (this.#status !== "open") {
          throw new NotOpenError();
        }
      }
      async _open(options) {
      }
      async close() {
        this.#assertUnlocked();
        while (this.#statusChange !== null) await this.#statusChange.catch(noop);
        this.#assertUnlocked();
        if (this.#status === "open" || this.#deferOpen) {
          const fromInitial = this.#deferOpen;
          this.#deferOpen = false;
          this.#statusChange = resolvedPromise;
          this.#statusChange = (async () => {
            this.#status = "closing";
            this.#queue.drain();
            try {
              this.emit("closing");
              await this.#closeResources();
              if (!fromInitial) await this._close();
            } catch (err) {
              this.#status = "open";
              this.#queue.drain();
              throw new NotClosedError(err);
            }
            this.#status = "closed";
            this.#queue.drain();
            this.emit("closed");
          })();
          try {
            await this.#statusChange;
          } finally {
            this.#statusChange = null;
          }
        } else if (this.#status !== "closed") {
          throw new NotClosedError();
        }
      }
      async #closeResources() {
        if (this.#resources.size === 0) {
          return;
        }
        const resources = Array.from(this.#resources);
        const promises = resources.map(closeResource);
        const results = await Promise.allSettled(promises);
        const errors = [];
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === "fulfilled") {
            this.#resources.delete(resources[i]);
          } else {
            errors.push(convertRejection(results[i].reason));
          }
        }
        if (errors.length > 0) {
          throw combineErrors(errors);
        }
      }
      async _close() {
      }
      async get(key, options) {
        options = getOptions(options, this.#defaultOptions.entry);
        if (this.#status === "opening") {
          return this.deferAsync(() => this.get(key, options));
        }
        this.#assertOpen();
        this._assertValidKey(key);
        const snapshot = options.snapshot;
        const keyEncoding = this.keyEncoding(options.keyEncoding);
        const valueEncoding = this.valueEncoding(options.valueEncoding);
        const keyFormat = keyEncoding.format;
        const valueFormat = valueEncoding.format;
        if (options === this.#defaultOptions.entry) {
          options = this.#defaultOptions.entryFormat;
        } else if (options.keyEncoding !== keyFormat || options.valueEncoding !== valueFormat) {
          options = { ...options, keyEncoding: keyFormat, valueEncoding: valueFormat };
        }
        const encodedKey = keyEncoding.encode(key);
        const mappedKey = this.prefixKey(encodedKey, keyFormat, true);
        snapshot?.ref();
        let value;
        try {
          value = await this._get(mappedKey, options);
        } finally {
          snapshot?.unref();
        }
        try {
          return value === void 0 ? value : valueEncoding.decode(value);
        } catch (err) {
          throw new ModuleError("Could not decode value", {
            code: "LEVEL_DECODE_ERROR",
            cause: err
          });
        }
      }
      async _get(key, options) {
        return void 0;
      }
      getSync(key, options) {
        if (this.status !== "open") {
          throw new ModuleError("Database is not open", {
            code: "LEVEL_DATABASE_NOT_OPEN"
          });
        }
        this._assertValidKey(key);
        if (options == null) {
          const encodedKey2 = this.#keyEncoding.encode(key);
          const mappedKey2 = this.prefixKey(encodedKey2, this.#keyEncoding.format, true);
          const value2 = this._getSync(mappedKey2, this.#defaultOptions.entryFormat);
          try {
            return value2 !== void 0 ? this.#valueEncoding.decode(value2) : void 0;
          } catch (err) {
            throw new ModuleError("Could not decode value", {
              code: "LEVEL_DECODE_ERROR",
              cause: err
            });
          }
        }
        const snapshot = options.snapshot;
        const keyEncoding = this.keyEncoding(options.keyEncoding);
        const valueEncoding = this.valueEncoding(options.valueEncoding);
        const keyFormat = keyEncoding.format;
        const valueFormat = valueEncoding.format;
        if (options.keyEncoding !== keyFormat || options.valueEncoding !== valueFormat) {
          options = { ...options, keyEncoding: keyFormat, valueEncoding: valueFormat };
        }
        const encodedKey = keyEncoding.encode(key);
        const mappedKey = this.prefixKey(encodedKey, keyFormat, true);
        let value;
        snapshot?.ref();
        try {
          value = this._getSync(mappedKey, options);
        } finally {
          snapshot?.unref();
        }
        try {
          return value !== void 0 ? valueEncoding.decode(value) : void 0;
        } catch (err) {
          throw new ModuleError("Could not decode value", {
            code: "LEVEL_DECODE_ERROR",
            cause: err
          });
        }
      }
      _getSync(key, options) {
        throw new ModuleError("Database does not support getSync()", {
          code: "LEVEL_NOT_SUPPORTED"
        });
      }
      async getMany(keys, options) {
        options = getOptions(options, this.#defaultOptions.entry);
        if (this.#status === "opening") {
          return this.deferAsync(() => this.getMany(keys, options));
        }
        this.#assertOpen();
        if (!Array.isArray(keys)) {
          throw new TypeError("The first argument 'keys' must be an array");
        }
        if (keys.length === 0) {
          return [];
        }
        const snapshot = options.snapshot;
        const keyEncoding = this.keyEncoding(options.keyEncoding);
        const valueEncoding = this.valueEncoding(options.valueEncoding);
        const keyFormat = keyEncoding.format;
        const valueFormat = valueEncoding.format;
        if (options === this.#defaultOptions.entry) {
          options = this.#defaultOptions.entryFormat;
        } else if (options.keyEncoding !== keyFormat || options.valueEncoding !== valueFormat) {
          options = { ...options, keyEncoding: keyFormat, valueEncoding: valueFormat };
        }
        const mappedKeys = new Array(keys.length);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          this._assertValidKey(key);
          mappedKeys[i] = this.prefixKey(keyEncoding.encode(key), keyFormat, true);
        }
        snapshot?.ref();
        let values;
        try {
          values = await this._getMany(mappedKeys, options);
        } finally {
          snapshot?.unref();
        }
        try {
          for (let i = 0; i < values.length; i++) {
            if (values[i] !== void 0) {
              values[i] = valueEncoding.decode(values[i]);
            }
          }
        } catch (err) {
          throw new ModuleError(`Could not decode one or more of ${values.length} value(s)`, {
            code: "LEVEL_DECODE_ERROR",
            cause: err
          });
        }
        return values;
      }
      async _getMany(keys, options) {
        return new Array(keys.length).fill(void 0);
      }
      async has(key, options) {
        options = getOptions(options, this.#defaultOptions.key);
        if (this.#status === "opening") {
          return this.deferAsync(() => this.has(key, options));
        }
        this.#assertOpen();
        this._assertValidKey(key);
        const snapshot = options.snapshot;
        const keyEncoding = this.keyEncoding(options.keyEncoding);
        const keyFormat = keyEncoding.format;
        if (options === this.#defaultOptions.key) {
          options = this.#defaultOptions.keyFormat;
        } else if (options.keyEncoding !== keyFormat) {
          options = { ...options, keyEncoding: keyFormat };
        }
        const encodedKey = keyEncoding.encode(key);
        const mappedKey = this.prefixKey(encodedKey, keyFormat, true);
        snapshot?.ref();
        try {
          return this._has(mappedKey, options);
        } finally {
          snapshot?.unref();
        }
      }
      async _has(key, options) {
        throw new ModuleError("Database does not support has()", {
          code: "LEVEL_NOT_SUPPORTED"
        });
      }
      async hasMany(keys, options) {
        options = getOptions(options, this.#defaultOptions.key);
        if (this.#status === "opening") {
          return this.deferAsync(() => this.hasMany(keys, options));
        }
        this.#assertOpen();
        if (!Array.isArray(keys)) {
          throw new TypeError("The first argument 'keys' must be an array");
        }
        if (keys.length === 0) {
          return [];
        }
        const snapshot = options.snapshot;
        const keyEncoding = this.keyEncoding(options.keyEncoding);
        const keyFormat = keyEncoding.format;
        if (options === this.#defaultOptions.key) {
          options = this.#defaultOptions.keyFormat;
        } else if (options.keyEncoding !== keyFormat) {
          options = { ...options, keyEncoding: keyFormat };
        }
        const mappedKeys = new Array(keys.length);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          this._assertValidKey(key);
          mappedKeys[i] = this.prefixKey(keyEncoding.encode(key), keyFormat, true);
        }
        snapshot?.ref();
        try {
          return this._hasMany(mappedKeys, options);
        } finally {
          snapshot?.unref();
        }
      }
      async _hasMany(keys, options) {
        throw new ModuleError("Database does not support hasMany()", {
          code: "LEVEL_NOT_SUPPORTED"
        });
      }
      async put(key, value, options) {
        if (!this.hooks.prewrite.noop) {
          return this.batch([{ type: "put", key, value }], options);
        }
        options = getOptions(options, this.#defaultOptions.entry);
        if (this.#status === "opening") {
          return this.deferAsync(() => this.put(key, value, options));
        }
        this.#assertOpen();
        this._assertValidKey(key);
        this._assertValidValue(value);
        const keyEncoding = this.keyEncoding(options.keyEncoding);
        const valueEncoding = this.valueEncoding(options.valueEncoding);
        const keyFormat = keyEncoding.format;
        const valueFormat = valueEncoding.format;
        const enableWriteEvent = this.#eventMonitor.write;
        const original = options;
        if (options === this.#defaultOptions.entry) {
          options = this.#defaultOptions.entryFormat;
        } else if (options.keyEncoding !== keyFormat || options.valueEncoding !== valueFormat) {
          options = { ...options, keyEncoding: keyFormat, valueEncoding: valueFormat };
        }
        const encodedKey = keyEncoding.encode(key);
        const prefixedKey = this.prefixKey(encodedKey, keyFormat, true);
        const encodedValue = valueEncoding.encode(value);
        await this._put(prefixedKey, encodedValue, options);
        if (enableWriteEvent) {
          const op = {
            ...original,
            type: "put",
            key,
            value,
            keyEncoding,
            valueEncoding,
            encodedKey,
            encodedValue
          };
          this.emit("write", [op]);
        }
      }
      async _put(key, value, options) {
      }
      async del(key, options) {
        if (!this.hooks.prewrite.noop) {
          return this.batch([{ type: "del", key }], options);
        }
        options = getOptions(options, this.#defaultOptions.key);
        if (this.#status === "opening") {
          return this.deferAsync(() => this.del(key, options));
        }
        this.#assertOpen();
        this._assertValidKey(key);
        const keyEncoding = this.keyEncoding(options.keyEncoding);
        const keyFormat = keyEncoding.format;
        const enableWriteEvent = this.#eventMonitor.write;
        const original = options;
        if (options === this.#defaultOptions.key) {
          options = this.#defaultOptions.keyFormat;
        } else if (options.keyEncoding !== keyFormat) {
          options = { ...options, keyEncoding: keyFormat };
        }
        const encodedKey = keyEncoding.encode(key);
        const prefixedKey = this.prefixKey(encodedKey, keyFormat, true);
        await this._del(prefixedKey, options);
        if (enableWriteEvent) {
          const op = {
            ...original,
            type: "del",
            key,
            keyEncoding,
            encodedKey
          };
          this.emit("write", [op]);
        }
      }
      async _del(key, options) {
      }
      // TODO (future): add way for implementations to declare which options are for the
      // whole batch rather than defaults for individual operations. E.g. the sync option
      // of classic-level, that should not be copied to individual operations.
      batch(operations, options) {
        if (!arguments.length) {
          this.#assertOpen();
          return this._chainedBatch();
        }
        options = getOptions(options, this.#defaultOptions.empty);
        return this.#arrayBatch(operations, options);
      }
      // Wrapped for async error handling
      async #arrayBatch(operations, options) {
        if (this.#status === "opening") {
          return this.deferAsync(() => this.#arrayBatch(operations, options));
        }
        this.#assertOpen();
        if (!Array.isArray(operations)) {
          throw new TypeError("The first argument 'operations' must be an array");
        }
        if (operations.length === 0) {
          return;
        }
        const length = operations.length;
        const enablePrewriteHook = !this.hooks.prewrite.noop;
        const enableWriteEvent = this.#eventMonitor.write;
        const publicOperations = enableWriteEvent ? new Array(length) : null;
        const privateOperations = new Array(length);
        const prewriteBatch = enablePrewriteHook ? new PrewriteBatch(this, privateOperations, publicOperations) : null;
        for (let i = 0; i < length; i++) {
          const op = { ...options, ...operations[i] };
          const isPut = op.type === "put";
          const delegated = op.sublevel != null;
          const db = delegated ? op.sublevel : this;
          db._assertValidKey(op.key);
          op.keyEncoding = db.keyEncoding(op.keyEncoding);
          if (isPut) {
            db._assertValidValue(op.value);
            op.valueEncoding = db.valueEncoding(op.valueEncoding);
          } else if (op.type !== "del") {
            throw new TypeError("A batch operation must have a type property that is 'put' or 'del'");
          }
          if (enablePrewriteHook) {
            try {
              this.hooks.prewrite.run(op, prewriteBatch);
              op.keyEncoding = db.keyEncoding(op.keyEncoding);
              if (isPut) op.valueEncoding = db.valueEncoding(op.valueEncoding);
            } catch (err) {
              throw new ModuleError("The prewrite hook failed on batch()", {
                code: "LEVEL_HOOK_ERROR",
                cause: err
              });
            }
          }
          const keyEncoding = op.keyEncoding;
          const preencodedKey = keyEncoding.encode(op.key);
          const keyFormat = keyEncoding.format;
          const siblings = delegated && !isDescendant(op.sublevel, this) && op.sublevel !== this;
          const encodedKey = delegated && !siblings ? prefixDescendantKey(preencodedKey, keyFormat, db, this) : preencodedKey;
          if (delegated && !siblings) {
            op.sublevel = null;
          }
          let publicOperation = null;
          if (enableWriteEvent && !siblings) {
            publicOperation = { ...op };
            publicOperation.encodedKey = encodedKey;
            if (delegated) {
              publicOperation.key = encodedKey;
              publicOperation.keyEncoding = this.keyEncoding(keyFormat);
            }
            publicOperations[i] = publicOperation;
          }
          op.key = siblings ? encodedKey : this.prefixKey(encodedKey, keyFormat, true);
          op.keyEncoding = keyFormat;
          if (isPut) {
            const valueEncoding = op.valueEncoding;
            const encodedValue = valueEncoding.encode(op.value);
            const valueFormat = valueEncoding.format;
            op.value = encodedValue;
            op.valueEncoding = valueFormat;
            if (enableWriteEvent && !siblings) {
              publicOperation.encodedValue = encodedValue;
              if (delegated) {
                publicOperation.value = encodedValue;
                publicOperation.valueEncoding = this.valueEncoding(valueFormat);
              }
            }
          }
          privateOperations[i] = op;
        }
        await this._batch(privateOperations, options);
        if (enableWriteEvent) {
          this.emit("write", publicOperations);
        }
      }
      async _batch(operations, options) {
      }
      sublevel(name, options) {
        const xopts = AbstractSublevel.defaults(options);
        const sublevel = this._sublevel(name, xopts);
        if (!this.hooks.newsub.noop) {
          try {
            this.hooks.newsub.run(sublevel, xopts);
          } catch (err) {
            throw new ModuleError("The newsub hook failed on sublevel()", {
              code: "LEVEL_HOOK_ERROR",
              cause: err
            });
          }
        }
        return sublevel;
      }
      _sublevel(name, options) {
        return new AbstractSublevel(this, name, options);
      }
      prefixKey(key, keyFormat, local) {
        return key;
      }
      async clear(options) {
        options = getOptions(options, this.#defaultOptions.empty);
        if (this.#status === "opening") {
          return this.deferAsync(() => this.clear(options));
        }
        this.#assertOpen();
        const original = options;
        const keyEncoding = this.keyEncoding(options.keyEncoding);
        const snapshot = options.snapshot;
        options = rangeOptions(options, keyEncoding);
        options.keyEncoding = keyEncoding.format;
        if (options.limit !== 0) {
          snapshot?.ref();
          try {
            await this._clear(options);
          } finally {
            snapshot?.unref();
          }
          this.emit("clear", original);
        }
      }
      async _clear(options) {
      }
      iterator(options) {
        const keyEncoding = this.keyEncoding(options?.keyEncoding);
        const valueEncoding = this.valueEncoding(options?.valueEncoding);
        options = rangeOptions(options, keyEncoding);
        options.keys = options.keys !== false;
        options.values = options.values !== false;
        options[AbstractIterator.keyEncoding] = keyEncoding;
        options[AbstractIterator.valueEncoding] = valueEncoding;
        options.keyEncoding = keyEncoding.format;
        options.valueEncoding = valueEncoding.format;
        if (this.#status === "opening") {
          return new DeferredIterator(this, options);
        }
        this.#assertOpen();
        return this._iterator(options);
      }
      _iterator(options) {
        return new AbstractIterator(this, options);
      }
      keys(options) {
        const keyEncoding = this.keyEncoding(options?.keyEncoding);
        const valueEncoding = this.valueEncoding(options?.valueEncoding);
        options = rangeOptions(options, keyEncoding);
        options[AbstractIterator.keyEncoding] = keyEncoding;
        options[AbstractIterator.valueEncoding] = valueEncoding;
        options.keyEncoding = keyEncoding.format;
        options.valueEncoding = valueEncoding.format;
        if (this.#status === "opening") {
          return new DeferredKeyIterator(this, options);
        }
        this.#assertOpen();
        return this._keys(options);
      }
      _keys(options) {
        return new DefaultKeyIterator(this, options);
      }
      values(options) {
        const keyEncoding = this.keyEncoding(options?.keyEncoding);
        const valueEncoding = this.valueEncoding(options?.valueEncoding);
        options = rangeOptions(options, keyEncoding);
        options[AbstractIterator.keyEncoding] = keyEncoding;
        options[AbstractIterator.valueEncoding] = valueEncoding;
        options.keyEncoding = keyEncoding.format;
        options.valueEncoding = valueEncoding.format;
        if (this.#status === "opening") {
          return new DeferredValueIterator(this, options);
        }
        this.#assertOpen();
        return this._values(options);
      }
      _values(options) {
        return new DefaultValueIterator(this, options);
      }
      snapshot(options) {
        this.#assertOpen();
        if (typeof options !== "object" || options === null) {
          options = this.#defaultOptions.owner;
        } else if (options.owner == null) {
          options = { ...options, owner: this };
        }
        return this._snapshot(options);
      }
      _snapshot(options) {
        throw new ModuleError("Database does not support explicit snapshots", {
          code: "LEVEL_NOT_SUPPORTED"
        });
      }
      defer(fn, options) {
        if (typeof fn !== "function") {
          throw new TypeError("The first argument must be a function");
        }
        this.#queue.add(function(abortError) {
          if (!abortError) fn();
        }, options);
      }
      deferAsync(fn, options) {
        if (typeof fn !== "function") {
          throw new TypeError("The first argument must be a function");
        }
        return new Promise((resolve, reject) => {
          this.#queue.add(function(abortError) {
            if (abortError) reject(abortError);
            else fn().then(resolve, reject);
          }, options);
        });
      }
      attachResource(resource) {
        if (typeof resource !== "object" || resource === null || typeof resource.close !== "function") {
          throw new TypeError("The first argument must be a resource object");
        }
        this.#resources.add(resource);
      }
      detachResource(resource) {
        this.#resources.delete(resource);
      }
      _chainedBatch() {
        return new DefaultChainedBatch(this);
      }
      _assertValidKey(key) {
        if (key === null || key === void 0) {
          throw new ModuleError("Key cannot be null or undefined", {
            code: "LEVEL_INVALID_KEY"
          });
        }
      }
      _assertValidValue(value) {
        if (value === null || value === void 0) {
          throw new ModuleError("Value cannot be null or undefined", {
            code: "LEVEL_INVALID_VALUE"
          });
        }
      }
      #assertOpen() {
        if (this.#status !== "open") {
          throw new ModuleError("Database is not open", {
            code: "LEVEL_DATABASE_NOT_OPEN"
          });
        }
      }
      #assertUnlocked() {
        if (this.#statusLocked) {
          throw new ModuleError("Database status is locked", {
            code: "LEVEL_STATUS_LOCKED"
          });
        }
      }
    };
    var { AbstractSublevel } = require_abstract_sublevel()({ AbstractLevel });
    exports.AbstractLevel = AbstractLevel;
    exports.AbstractSublevel = AbstractSublevel;
    if (typeof Symbol.asyncDispose === "symbol") {
      AbstractLevel.prototype[Symbol.asyncDispose] = async function() {
        return this.close();
      };
    }
    var formats = function(db) {
      return Object.keys(db.supports.encodings).filter((k) => !!db.supports.encodings[k]);
    };
    var closeResource = function(resource) {
      return resource.close();
    };
    var convertRejection = function(reason) {
      if (reason instanceof Error) {
        return reason;
      }
      if (Object.prototype.toString.call(reason) === "[object Error]") {
        return reason;
      }
      const hint = reason === null ? "null" : typeof reason;
      const msg = `Promise rejection reason must be an Error, received ${hint}`;
      return new TypeError(msg);
    };
    var NotOpenError = class extends ModuleError {
      constructor(cause) {
        super("Database failed to open", {
          code: "LEVEL_DATABASE_NOT_OPEN",
          cause
        });
      }
    };
    var NotClosedError = class extends ModuleError {
      constructor(cause) {
        super("Database failed to close", {
          code: "LEVEL_DATABASE_NOT_CLOSED",
          cause
        });
      }
    };
  }
});

// ../node_modules/abstract-level/abstract-snapshot.js
var require_abstract_snapshot = __commonJS({
  "../node_modules/abstract-level/abstract-snapshot.js"(exports) {
    "use strict";
    var ModuleError = require_module_error();
    var { noop } = require_common();
    var AbstractSnapshot = class {
      #open = true;
      #referenceCount = 0;
      #pendingClose = null;
      #closePromise = null;
      #owner;
      constructor(options) {
        const owner = options.owner;
        if (typeof owner !== "object" || owner === null) {
          const hint = owner === null ? "null" : typeof owner;
          throw new TypeError(`Owner must be an abstract-level database, received ${hint}`);
        }
        this.#owner = owner;
        this.#owner.attachResource(this);
      }
      ref() {
        if (!this.#open) {
          throw new ModuleError("Snapshot is not open: cannot use snapshot after close()", {
            code: "LEVEL_SNAPSHOT_NOT_OPEN"
          });
        }
        this.#referenceCount++;
      }
      unref() {
        if (--this.#referenceCount === 0) {
          this.#pendingClose?.();
        }
      }
      async close() {
        if (this.#closePromise !== null) {
          return this.#closePromise.catch(noop);
        }
        this.#open = false;
        this.#closePromise = new Promise((resolve, reject) => {
          this.#pendingClose = () => {
            this.#pendingClose = null;
            privateClose(this, this.#owner).then(resolve, reject);
          };
        });
        if (this.#referenceCount === 0) {
          this.#pendingClose();
        }
        return this.#closePromise;
      }
      async _close() {
      }
    };
    if (typeof Symbol.asyncDispose === "symbol") {
      AbstractSnapshot.prototype[Symbol.asyncDispose] = async function() {
        return this.close();
      };
    }
    var privateClose = async function(snapshot, owner) {
      await snapshot._close();
      owner.detachResource(snapshot);
    };
    exports.AbstractSnapshot = AbstractSnapshot;
  }
});

// ../node_modules/abstract-level/index.js
var require_abstract_level2 = __commonJS({
  "../node_modules/abstract-level/index.js"(exports) {
    "use strict";
    exports.AbstractLevel = require_abstract_level().AbstractLevel;
    exports.AbstractSublevel = require_abstract_level().AbstractSublevel;
    exports.AbstractIterator = require_abstract_iterator().AbstractIterator;
    exports.AbstractKeyIterator = require_abstract_iterator().AbstractKeyIterator;
    exports.AbstractValueIterator = require_abstract_iterator().AbstractValueIterator;
    exports.AbstractChainedBatch = require_abstract_chained_batch().AbstractChainedBatch;
    exports.AbstractSnapshot = require_abstract_snapshot().AbstractSnapshot;
  }
});

// ../node_modules/browser-level/util/key-range.js
var require_key_range = __commonJS({
  "../node_modules/browser-level/util/key-range.js"(exports, module) {
    "use strict";
    module.exports = function createKeyRange(options) {
      const lower = options.gte !== void 0 ? options.gte : options.gt !== void 0 ? options.gt : void 0;
      const upper = options.lte !== void 0 ? options.lte : options.lt !== void 0 ? options.lt : void 0;
      const lowerExclusive = options.gte === void 0;
      const upperExclusive = options.lte === void 0;
      if (lower !== void 0 && upper !== void 0) {
        return IDBKeyRange.bound(lower, upper, lowerExclusive, upperExclusive);
      } else if (lower !== void 0) {
        return IDBKeyRange.lowerBound(lower, lowerExclusive);
      } else if (upper !== void 0) {
        return IDBKeyRange.upperBound(upper, upperExclusive);
      } else {
        return null;
      }
    };
  }
});

// ../node_modules/browser-level/util/deserialize.js
var require_deserialize = __commonJS({
  "../node_modules/browser-level/util/deserialize.js"(exports, module) {
    "use strict";
    var textEncoder = new TextEncoder();
    module.exports = function(data) {
      if (data === void 0) {
        return data;
      } else if (data instanceof Uint8Array) {
        return data;
      } else if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
      } else {
        return textEncoder.encode(data);
      }
    };
  }
});

// ../node_modules/browser-level/iterator.js
var require_iterator = __commonJS({
  "../node_modules/browser-level/iterator.js"(exports) {
    "use strict";
    var { AbstractIterator } = require_abstract_level2();
    var createKeyRange = require_key_range();
    var deserialize2 = require_deserialize();
    var kCache = Symbol("cache");
    var kFinished = Symbol("finished");
    var kOptions = Symbol("options");
    var kCurrentOptions = Symbol("currentOptions");
    var kPosition = Symbol("position");
    var kLocation = Symbol("location");
    var kFirst = Symbol("first");
    var emptyOptions = {};
    var Iterator = class extends AbstractIterator {
      constructor(db, location, options) {
        super(db, options);
        this[kCache] = [];
        this[kFinished] = this.limit === 0;
        this[kOptions] = options;
        this[kCurrentOptions] = { ...options };
        this[kPosition] = void 0;
        this[kLocation] = location;
        this[kFirst] = true;
      }
      // Note: if called by _all() then size can be Infinity. This is an internal
      // detail; by design AbstractIterator.nextv() does not support Infinity.
      async _nextv(size, options) {
        this[kFirst] = false;
        if (this[kFinished]) {
          return [];
        }
        if (this[kCache].length > 0) {
          size = Math.min(size, this[kCache].length);
          return this[kCache].splice(0, size);
        }
        if (this[kPosition] !== void 0) {
          if (this[kOptions].reverse) {
            this[kCurrentOptions].lt = this[kPosition];
            this[kCurrentOptions].lte = void 0;
          } else {
            this[kCurrentOptions].gt = this[kPosition];
            this[kCurrentOptions].gte = void 0;
          }
        }
        let keyRange;
        try {
          keyRange = createKeyRange(this[kCurrentOptions]);
        } catch (_2) {
          this[kFinished] = true;
          return [];
        }
        const transaction = this.db.db.transaction([this[kLocation]], "readonly");
        const store = transaction.objectStore(this[kLocation]);
        const entries = [];
        const promise = new Promise(function(resolve, reject) {
          transaction.onabort = () => {
            reject(transaction.error || new Error("aborted by user"));
          };
          transaction.oncomplete = () => {
            resolve(entries);
          };
        });
        if (!this[kOptions].reverse) {
          let keys;
          let values;
          const complete = () => {
            if (keys === void 0 || values === void 0) return;
            const length = Math.max(keys.length, values.length);
            if (length === 0 || size === Infinity) {
              this[kFinished] = true;
            } else {
              this[kPosition] = keys[length - 1];
            }
            entries.length = length;
            for (let i = 0; i < length; i++) {
              const key = keys[i];
              const value = values[i];
              entries[i] = [
                this[kOptions].keys ? deserialize2(key) : void 0,
                this[kOptions].values ? deserialize2(value) : void 0
              ];
            }
            maybeCommit(transaction);
          };
          if (this[kOptions].keys || size < Infinity) {
            store.getAllKeys(keyRange, size < Infinity ? size : void 0).onsuccess = (ev) => {
              keys = ev.target.result;
              complete();
            };
          } else {
            keys = [];
            complete();
          }
          if (this[kOptions].values) {
            store.getAll(keyRange, size < Infinity ? size : void 0).onsuccess = (ev) => {
              values = ev.target.result;
              complete();
            };
          } else {
            values = [];
            complete();
          }
        } else {
          const method = !this[kOptions].values && store.openKeyCursor ? "openKeyCursor" : "openCursor";
          store[method](keyRange, "prev").onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) {
              const { key, value } = cursor;
              this[kPosition] = key;
              entries.push([
                this[kOptions].keys && key !== void 0 ? deserialize2(key) : void 0,
                this[kOptions].values && value !== void 0 ? deserialize2(value) : void 0
              ]);
              if (entries.length < size) {
                cursor.continue();
              } else {
                maybeCommit(transaction);
              }
            } else {
              this[kFinished] = true;
            }
          };
        }
        return promise;
      }
      async _next() {
        if (this[kCache].length > 0) {
          return this[kCache].shift();
        }
        if (!this[kFinished]) {
          let size = Math.min(100, this.limit - this.count);
          if (this[kFirst]) {
            this[kFirst] = false;
            size = 1;
          }
          this[kCache] = await this._nextv(size, emptyOptions);
          return this[kCache].shift();
        }
      }
      async _all(options) {
        this[kFirst] = false;
        const cache = this[kCache].splice(0, this[kCache].length);
        const size = this.limit - this.count - cache.length;
        if (size <= 0) {
          return cache;
        }
        let entries = await this._nextv(size, emptyOptions);
        if (cache.length > 0) entries = cache.concat(entries);
        return entries;
      }
      _seek(target, options) {
        this[kFirst] = true;
        this[kCache] = [];
        this[kFinished] = false;
        this[kPosition] = void 0;
        this[kCurrentOptions] = { ...this[kOptions] };
        let keyRange;
        try {
          keyRange = createKeyRange(this[kOptions]);
        } catch (_2) {
          this[kFinished] = true;
          return;
        }
        if (keyRange !== null && !keyRange.includes(target)) {
          this[kFinished] = true;
        } else if (this[kOptions].reverse) {
          this[kCurrentOptions].lte = target;
        } else {
          this[kCurrentOptions].gte = target;
        }
      }
    };
    exports.Iterator = Iterator;
    function maybeCommit(transaction) {
      if (typeof transaction.commit === "function") {
        transaction.commit();
      }
    }
  }
});

// ../node_modules/browser-level/util/clear.js
var require_clear = __commonJS({
  "../node_modules/browser-level/util/clear.js"(exports, module) {
    "use strict";
    module.exports = async function clear(db, location, keyRange, options) {
      if (options.limit === 0) return;
      const transaction = db.db.transaction([location], "readwrite");
      const store = transaction.objectStore(location);
      let count = 0;
      const promise = new Promise(function(resolve, reject) {
        transaction.oncomplete = resolve;
        transaction.onabort = function() {
          reject(transaction.error || new Error("aborted by user"));
        };
      });
      const method = store.openKeyCursor ? "openKeyCursor" : "openCursor";
      const direction = options.reverse ? "prev" : "next";
      store[method](keyRange, direction).onsuccess = function(ev) {
        const cursor = ev.target.result;
        if (cursor) {
          store.delete(cursor.key).onsuccess = function() {
            if (options.limit <= 0 || ++count < options.limit) {
              cursor.continue();
            }
          };
        }
      };
      return promise;
    };
  }
});

// ../node_modules/browser-level/index.js
var require_browser_level = __commonJS({
  "../node_modules/browser-level/index.js"(exports) {
    "use strict";
    var { AbstractLevel } = require_abstract_level2();
    var { Iterator } = require_iterator();
    var deserialize2 = require_deserialize();
    var clear = require_clear();
    var createKeyRange = require_key_range();
    var DEFAULT_PREFIX = "level-js-";
    var kIDB = Symbol("idb");
    var kNamePrefix = Symbol("namePrefix");
    var kLocation = Symbol("location");
    var kVersion = Symbol("version");
    var kStore = Symbol("store");
    var kOnComplete = Symbol("onComplete");
    var BrowserLevel = class extends AbstractLevel {
      constructor(location, options) {
        const { prefix, version, ...forward } = options || {};
        super({
          encodings: { view: true },
          snapshots: false,
          createIfMissing: false,
          errorIfExists: false,
          seek: true,
          has: true,
          getSync: false
        }, forward);
        if (typeof location !== "string" || location === "") {
          throw new TypeError("The first argument 'location' must be a non-empty string");
        }
        this[kLocation] = location;
        this[kNamePrefix] = prefix == null ? DEFAULT_PREFIX : prefix;
        this[kVersion] = parseInt(version || 1, 10);
        this[kIDB] = null;
      }
      get location() {
        return this[kLocation];
      }
      get namePrefix() {
        return this[kNamePrefix];
      }
      get version() {
        return this[kVersion];
      }
      // Exposed for backwards compat and unit tests
      get db() {
        return this[kIDB];
      }
      get type() {
        return "browser-level";
      }
      async _open(options) {
        const request = indexedDB.open(this[kNamePrefix] + this[kLocation], this[kVersion]);
        request.onupgradeneeded = (ev) => {
          const db = ev.target.result;
          if (!db.objectStoreNames.contains(this[kLocation])) {
            db.createObjectStore(this[kLocation]);
          }
        };
        return new Promise((resolve, reject) => {
          request.onerror = function() {
            reject(request.error || new Error("unknown error"));
          };
          request.onsuccess = () => {
            this[kIDB] = request.result;
            resolve();
          };
        });
      }
      [kStore](mode) {
        const transaction = this[kIDB].transaction([this[kLocation]], mode);
        return transaction.objectStore(this[kLocation]);
      }
      [kOnComplete](request) {
        const transaction = request.transaction;
        return new Promise(function(resolve, reject) {
          transaction.onabort = function() {
            reject(transaction.error || new Error("aborted by user"));
          };
          transaction.oncomplete = function() {
            resolve(request.result);
          };
        });
      }
      async _get(key, options) {
        const store = this[kStore]("readonly");
        const request = store.get(key);
        const value = await this[kOnComplete](request);
        return deserialize2(value);
      }
      async _getMany(keys, options) {
        const store = this[kStore]("readonly");
        const iterator = keys.values();
        const n = Math.min(16, keys.length);
        const bees = new Array(n);
        const values = new Array(keys.length);
        let keyIndex = 0;
        let abort = false;
        const bee = async function() {
          try {
            for (const key of iterator) {
              if (abort) break;
              const valueIndex = keyIndex++;
              const request = store.get(key);
              await new Promise(function(resolve, reject) {
                request.onsuccess = () => {
                  values[valueIndex] = deserialize2(request.result);
                  resolve();
                };
                request.onerror = (ev) => {
                  ev.stopPropagation();
                  reject(request.error);
                };
              });
            }
          } catch (err) {
            abort = true;
            throw err;
          }
        };
        for (let i = 0; i < n; i++) {
          bees[i] = bee();
        }
        await Promise.allSettled(bees);
        return values;
      }
      async _has(key, options) {
        const store = this[kStore]("readonly");
        const request = store.count(key);
        const count = await this[kOnComplete](request);
        return count === 1;
      }
      async _hasMany(keys, options) {
        const store = this[kStore]("readonly");
        const iterator = keys.values();
        const n = Math.min(16, keys.length);
        const bees = new Array(n);
        const results = new Array(keys.length);
        let keyIndex = 0;
        let abort = false;
        const bee = async function() {
          try {
            for (const key of iterator) {
              if (abort) break;
              const resultIndex = keyIndex++;
              const request = store.count(key);
              await new Promise(function(resolve, reject) {
                request.onsuccess = () => {
                  results[resultIndex] = request.result === 1;
                  resolve();
                };
                request.onerror = (ev) => {
                  ev.stopPropagation();
                  reject(request.error);
                };
              });
            }
          } catch (err) {
            abort = true;
            throw err;
          }
        };
        for (let i = 0; i < n; i++) {
          bees[i] = bee();
        }
        await Promise.allSettled(bees);
        return results;
      }
      async _del(key, options) {
        const store = this[kStore]("readwrite");
        const request = store.delete(key);
        return this[kOnComplete](request);
      }
      async _put(key, value, options) {
        const store = this[kStore]("readwrite");
        const request = store.put(value, key);
        return this[kOnComplete](request);
      }
      // TODO: implement key and value iterators
      _iterator(options) {
        return new Iterator(this, this[kLocation], options);
      }
      async _batch(operations, options) {
        const store = this[kStore]("readwrite");
        const transaction = store.transaction;
        let index = 0;
        let error;
        const promise = new Promise(function(resolve, reject) {
          transaction.onabort = function() {
            reject(error || transaction.error || new Error("aborted by user"));
          };
          transaction.oncomplete = resolve;
        });
        function loop() {
          const op = operations[index++];
          const key = op.key;
          let req;
          try {
            req = op.type === "del" ? store.delete(key) : store.put(op.value, key);
          } catch (err) {
            error = err;
            transaction.abort();
            return;
          }
          if (index < operations.length) {
            req.onsuccess = loop;
          } else if (typeof transaction.commit === "function") {
            transaction.commit();
          }
        }
        loop();
        return promise;
      }
      async _clear(options) {
        let keyRange;
        try {
          keyRange = createKeyRange(options);
        } catch (e) {
          return;
        }
        if (options.limit >= 0) {
          return clear(this, this[kLocation], keyRange, options);
        }
        const store = this[kStore]("readwrite");
        const request = keyRange ? store.delete(keyRange) : store.clear();
        return this[kOnComplete](request);
      }
      async _close() {
        this[kIDB].close();
      }
    };
    BrowserLevel.destroy = async function(location, prefix) {
      if (prefix == null) {
        prefix = DEFAULT_PREFIX;
      }
      const request = indexedDB.deleteDatabase(prefix + location);
      return new Promise(function(resolve, reject) {
        request.onsuccess = resolve;
        request.onerror = reject;
      });
    };
    exports.BrowserLevel = BrowserLevel;
  }
});

// ../node_modules/level/browser.js
var require_browser = __commonJS({
  "../node_modules/level/browser.js"(exports) {
    exports.Level = require_browser_level().BrowserLevel;
  }
});

// browser-external:crypto
var require_crypto = __commonJS({
  "browser-external:crypto"(exports, module) {
    module.exports = Object.create(new Proxy({}, {
      get(_2, key) {
        if (key !== "__esModule" && key !== "__proto__" && key !== "constructor" && key !== "splice") {
          console.warn(`Module "crypto" has been externalized for browser compatibility. Cannot access "crypto.${key}" in client code. See https://vite.dev/guide/troubleshooting.html#module-externalized-for-browser-compatibility for more details.`);
        }
      }
    }));
  }
});

// ../node_modules/@midnight-ntwrk/midnight-js-level-private-state-provider/dist/index.mjs
var import_buffer = __toESM(require_buffer(), 1);
var import_level = __toESM(require_browser(), 1);
var import_lodash = __toESM(require_lodash(), 1);

// ../node_modules/superjson/dist/double-indexed-kv.js
var DoubleIndexedKV = class {
  constructor() {
    this.keyToValue = /* @__PURE__ */ new Map();
    this.valueToKey = /* @__PURE__ */ new Map();
  }
  set(key, value) {
    this.keyToValue.set(key, value);
    this.valueToKey.set(value, key);
  }
  getByKey(key) {
    return this.keyToValue.get(key);
  }
  getByValue(value) {
    return this.valueToKey.get(value);
  }
  clear() {
    this.keyToValue.clear();
    this.valueToKey.clear();
  }
};

// ../node_modules/superjson/dist/registry.js
var Registry = class {
  constructor(generateIdentifier) {
    this.generateIdentifier = generateIdentifier;
    this.kv = new DoubleIndexedKV();
  }
  register(value, identifier) {
    if (this.kv.getByValue(value)) {
      return;
    }
    if (!identifier) {
      identifier = this.generateIdentifier(value);
    }
    this.kv.set(identifier, value);
  }
  clear() {
    this.kv.clear();
  }
  getIdentifier(value) {
    return this.kv.getByValue(value);
  }
  getValue(identifier) {
    return this.kv.getByKey(identifier);
  }
};

// ../node_modules/superjson/dist/class-registry.js
var ClassRegistry = class extends Registry {
  constructor() {
    super((c) => c.name);
    this.classToAllowedProps = /* @__PURE__ */ new Map();
  }
  register(value, options) {
    if (typeof options === "object") {
      if (options.allowProps) {
        this.classToAllowedProps.set(value, options.allowProps);
      }
      super.register(value, options.identifier);
    } else {
      super.register(value, options);
    }
  }
  getAllowedProps(value) {
    return this.classToAllowedProps.get(value);
  }
};

// ../node_modules/superjson/dist/util.js
function valuesOfObj(record) {
  if ("values" in Object) {
    return Object.values(record);
  }
  const values = [];
  for (const key in record) {
    if (record.hasOwnProperty(key)) {
      values.push(record[key]);
    }
  }
  return values;
}
function find(record, predicate) {
  const values = valuesOfObj(record);
  if ("find" in values) {
    return values.find(predicate);
  }
  const valuesNotNever = values;
  for (let i = 0; i < valuesNotNever.length; i++) {
    const value = valuesNotNever[i];
    if (predicate(value)) {
      return value;
    }
  }
  return void 0;
}
function forEach(record, run) {
  Object.entries(record).forEach(([key, value]) => run(value, key));
}
function includes(arr, value) {
  return arr.indexOf(value) !== -1;
}
function findArr(record, predicate) {
  for (let i = 0; i < record.length; i++) {
    const value = record[i];
    if (predicate(value)) {
      return value;
    }
  }
  return void 0;
}

// ../node_modules/superjson/dist/custom-transformer-registry.js
var CustomTransformerRegistry = class {
  constructor() {
    this.transfomers = {};
  }
  register(transformer) {
    this.transfomers[transformer.name] = transformer;
  }
  findApplicable(v) {
    return find(this.transfomers, (transformer) => transformer.isApplicable(v));
  }
  findByName(name) {
    return this.transfomers[name];
  }
};

// ../node_modules/superjson/dist/is.js
var getType = (payload) => Object.prototype.toString.call(payload).slice(8, -1);
var isUndefined = (payload) => typeof payload === "undefined";
var isNull = (payload) => payload === null;
var isPlainObject = (payload) => {
  if (typeof payload !== "object" || payload === null)
    return false;
  if (payload === Object.prototype)
    return false;
  if (Object.getPrototypeOf(payload) === null)
    return true;
  return Object.getPrototypeOf(payload) === Object.prototype;
};
var isEmptyObject = (payload) => isPlainObject(payload) && Object.keys(payload).length === 0;
var isArray = (payload) => Array.isArray(payload);
var isString = (payload) => typeof payload === "string";
var isNumber = (payload) => typeof payload === "number" && !isNaN(payload);
var isBoolean = (payload) => typeof payload === "boolean";
var isRegExp = (payload) => payload instanceof RegExp;
var isMap = (payload) => payload instanceof Map;
var isSet = (payload) => payload instanceof Set;
var isSymbol = (payload) => getType(payload) === "Symbol";
var isDate = (payload) => payload instanceof Date && !isNaN(payload.valueOf());
var isError = (payload) => payload instanceof Error;
var isNaNValue = (payload) => typeof payload === "number" && isNaN(payload);
var isPrimitive = (payload) => isBoolean(payload) || isNull(payload) || isUndefined(payload) || isNumber(payload) || isString(payload) || isSymbol(payload);
var isBigint = (payload) => typeof payload === "bigint";
var isInfinite = (payload) => payload === Infinity || payload === -Infinity;
var isTypedArray = (payload) => ArrayBuffer.isView(payload) && !(payload instanceof DataView);
var isURL = (payload) => payload instanceof URL;

// ../node_modules/superjson/dist/pathstringifier.js
var escapeKey = (key) => key.replace(/\./g, "\\.");
var stringifyPath = (path) => path.map(String).map(escapeKey).join(".");
var parsePath = (string) => {
  const result = [];
  let segment = "";
  for (let i = 0; i < string.length; i++) {
    let char = string.charAt(i);
    const isEscapedDot = char === "\\" && string.charAt(i + 1) === ".";
    if (isEscapedDot) {
      segment += ".";
      i++;
      continue;
    }
    const isEndOfSegment = char === ".";
    if (isEndOfSegment) {
      result.push(segment);
      segment = "";
      continue;
    }
    segment += char;
  }
  const lastSegment = segment;
  result.push(lastSegment);
  return result;
};

// ../node_modules/superjson/dist/transformer.js
function simpleTransformation(isApplicable, annotation, transform, untransform) {
  return {
    isApplicable,
    annotation,
    transform,
    untransform
  };
}
var simpleRules = [
  simpleTransformation(isUndefined, "undefined", () => null, () => void 0),
  simpleTransformation(isBigint, "bigint", (v) => v.toString(), (v) => {
    if (typeof BigInt !== "undefined") {
      return BigInt(v);
    }
    console.error("Please add a BigInt polyfill.");
    return v;
  }),
  simpleTransformation(isDate, "Date", (v) => v.toISOString(), (v) => new Date(v)),
  simpleTransformation(isError, "Error", (v, superJson) => {
    const baseError = {
      name: v.name,
      message: v.message
    };
    superJson.allowedErrorProps.forEach((prop) => {
      baseError[prop] = v[prop];
    });
    return baseError;
  }, (v, superJson) => {
    const e = new Error(v.message);
    e.name = v.name;
    e.stack = v.stack;
    superJson.allowedErrorProps.forEach((prop) => {
      e[prop] = v[prop];
    });
    return e;
  }),
  simpleTransformation(isRegExp, "regexp", (v) => "" + v, (regex) => {
    const body = regex.slice(1, regex.lastIndexOf("/"));
    const flags = regex.slice(regex.lastIndexOf("/") + 1);
    return new RegExp(body, flags);
  }),
  simpleTransformation(
    isSet,
    "set",
    // (sets only exist in es6+)
    // eslint-disable-next-line es5/no-es6-methods
    (v) => [...v.values()],
    (v) => new Set(v)
  ),
  simpleTransformation(isMap, "map", (v) => [...v.entries()], (v) => new Map(v)),
  simpleTransformation((v) => isNaNValue(v) || isInfinite(v), "number", (v) => {
    if (isNaNValue(v)) {
      return "NaN";
    }
    if (v > 0) {
      return "Infinity";
    } else {
      return "-Infinity";
    }
  }, Number),
  simpleTransformation((v) => v === 0 && 1 / v === -Infinity, "number", () => {
    return "-0";
  }, Number),
  simpleTransformation(isURL, "URL", (v) => v.toString(), (v) => new URL(v))
];
function compositeTransformation(isApplicable, annotation, transform, untransform) {
  return {
    isApplicable,
    annotation,
    transform,
    untransform
  };
}
var symbolRule = compositeTransformation((s, superJson) => {
  if (isSymbol(s)) {
    const isRegistered = !!superJson.symbolRegistry.getIdentifier(s);
    return isRegistered;
  }
  return false;
}, (s, superJson) => {
  const identifier = superJson.symbolRegistry.getIdentifier(s);
  return ["symbol", identifier];
}, (v) => v.description, (_2, a, superJson) => {
  const value = superJson.symbolRegistry.getValue(a[1]);
  if (!value) {
    throw new Error("Trying to deserialize unknown symbol");
  }
  return value;
});
var constructorToName = [
  Int8Array,
  Uint8Array,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  Uint8ClampedArray
].reduce((obj, ctor) => {
  obj[ctor.name] = ctor;
  return obj;
}, {});
var typedArrayRule = compositeTransformation(isTypedArray, (v) => ["typed-array", v.constructor.name], (v) => [...v], (v, a) => {
  const ctor = constructorToName[a[1]];
  if (!ctor) {
    throw new Error("Trying to deserialize unknown typed array");
  }
  return new ctor(v);
});
function isInstanceOfRegisteredClass(potentialClass, superJson) {
  if (potentialClass?.constructor) {
    const isRegistered = !!superJson.classRegistry.getIdentifier(potentialClass.constructor);
    return isRegistered;
  }
  return false;
}
var classRule = compositeTransformation(isInstanceOfRegisteredClass, (clazz, superJson) => {
  const identifier = superJson.classRegistry.getIdentifier(clazz.constructor);
  return ["class", identifier];
}, (clazz, superJson) => {
  const allowedProps = superJson.classRegistry.getAllowedProps(clazz.constructor);
  if (!allowedProps) {
    return { ...clazz };
  }
  const result = {};
  allowedProps.forEach((prop) => {
    result[prop] = clazz[prop];
  });
  return result;
}, (v, a, superJson) => {
  const clazz = superJson.classRegistry.getValue(a[1]);
  if (!clazz) {
    throw new Error(`Trying to deserialize unknown class '${a[1]}' - check https://github.com/blitz-js/superjson/issues/116#issuecomment-773996564`);
  }
  return Object.assign(Object.create(clazz.prototype), v);
});
var customRule = compositeTransformation((value, superJson) => {
  return !!superJson.customTransformerRegistry.findApplicable(value);
}, (value, superJson) => {
  const transformer = superJson.customTransformerRegistry.findApplicable(value);
  return ["custom", transformer.name];
}, (value, superJson) => {
  const transformer = superJson.customTransformerRegistry.findApplicable(value);
  return transformer.serialize(value);
}, (v, a, superJson) => {
  const transformer = superJson.customTransformerRegistry.findByName(a[1]);
  if (!transformer) {
    throw new Error("Trying to deserialize unknown custom value");
  }
  return transformer.deserialize(v);
});
var compositeRules = [classRule, symbolRule, customRule, typedArrayRule];
var transformValue = (value, superJson) => {
  const applicableCompositeRule = findArr(compositeRules, (rule) => rule.isApplicable(value, superJson));
  if (applicableCompositeRule) {
    return {
      value: applicableCompositeRule.transform(value, superJson),
      type: applicableCompositeRule.annotation(value, superJson)
    };
  }
  const applicableSimpleRule = findArr(simpleRules, (rule) => rule.isApplicable(value, superJson));
  if (applicableSimpleRule) {
    return {
      value: applicableSimpleRule.transform(value, superJson),
      type: applicableSimpleRule.annotation
    };
  }
  return void 0;
};
var simpleRulesByAnnotation = {};
simpleRules.forEach((rule) => {
  simpleRulesByAnnotation[rule.annotation] = rule;
});
var untransformValue = (json, type, superJson) => {
  if (isArray(type)) {
    switch (type[0]) {
      case "symbol":
        return symbolRule.untransform(json, type, superJson);
      case "class":
        return classRule.untransform(json, type, superJson);
      case "custom":
        return customRule.untransform(json, type, superJson);
      case "typed-array":
        return typedArrayRule.untransform(json, type, superJson);
      default:
        throw new Error("Unknown transformation: " + type);
    }
  } else {
    const transformation = simpleRulesByAnnotation[type];
    if (!transformation) {
      throw new Error("Unknown transformation: " + type);
    }
    return transformation.untransform(json, superJson);
  }
};

// ../node_modules/superjson/dist/accessDeep.js
var getNthKey = (value, n) => {
  if (n > value.size)
    throw new Error("index out of bounds");
  const keys = value.keys();
  while (n > 0) {
    keys.next();
    n--;
  }
  return keys.next().value;
};
function validatePath(path) {
  if (includes(path, "__proto__")) {
    throw new Error("__proto__ is not allowed as a property");
  }
  if (includes(path, "prototype")) {
    throw new Error("prototype is not allowed as a property");
  }
  if (includes(path, "constructor")) {
    throw new Error("constructor is not allowed as a property");
  }
}
var getDeep = (object, path) => {
  validatePath(path);
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    if (isSet(object)) {
      object = getNthKey(object, +key);
    } else if (isMap(object)) {
      const row = +key;
      const type = +path[++i] === 0 ? "key" : "value";
      const keyOfRow = getNthKey(object, row);
      switch (type) {
        case "key":
          object = keyOfRow;
          break;
        case "value":
          object = object.get(keyOfRow);
          break;
      }
    } else {
      object = object[key];
    }
  }
  return object;
};
var setDeep = (object, path, mapper) => {
  validatePath(path);
  if (path.length === 0) {
    return mapper(object);
  }
  let parent = object;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (isArray(parent)) {
      const index = +key;
      parent = parent[index];
    } else if (isPlainObject(parent)) {
      parent = parent[key];
    } else if (isSet(parent)) {
      const row = +key;
      parent = getNthKey(parent, row);
    } else if (isMap(parent)) {
      const isEnd = i === path.length - 2;
      if (isEnd) {
        break;
      }
      const row = +key;
      const type = +path[++i] === 0 ? "key" : "value";
      const keyOfRow = getNthKey(parent, row);
      switch (type) {
        case "key":
          parent = keyOfRow;
          break;
        case "value":
          parent = parent.get(keyOfRow);
          break;
      }
    }
  }
  const lastKey = path[path.length - 1];
  if (isArray(parent)) {
    parent[+lastKey] = mapper(parent[+lastKey]);
  } else if (isPlainObject(parent)) {
    parent[lastKey] = mapper(parent[lastKey]);
  }
  if (isSet(parent)) {
    const oldValue = getNthKey(parent, +lastKey);
    const newValue = mapper(oldValue);
    if (oldValue !== newValue) {
      parent.delete(oldValue);
      parent.add(newValue);
    }
  }
  if (isMap(parent)) {
    const row = +path[path.length - 2];
    const keyToRow = getNthKey(parent, row);
    const type = +lastKey === 0 ? "key" : "value";
    switch (type) {
      case "key": {
        const newKey = mapper(keyToRow);
        parent.set(newKey, parent.get(keyToRow));
        if (newKey !== keyToRow) {
          parent.delete(keyToRow);
        }
        break;
      }
      case "value": {
        parent.set(keyToRow, mapper(parent.get(keyToRow)));
        break;
      }
    }
  }
  return object;
};

// ../node_modules/superjson/dist/plainer.js
function traverse(tree, walker2, origin = []) {
  if (!tree) {
    return;
  }
  if (!isArray(tree)) {
    forEach(tree, (subtree, key) => traverse(subtree, walker2, [...origin, ...parsePath(key)]));
    return;
  }
  const [nodeValue, children] = tree;
  if (children) {
    forEach(children, (child, key) => {
      traverse(child, walker2, [...origin, ...parsePath(key)]);
    });
  }
  walker2(nodeValue, origin);
}
function applyValueAnnotations(plain, annotations, superJson) {
  traverse(annotations, (type, path) => {
    plain = setDeep(plain, path, (v) => untransformValue(v, type, superJson));
  });
  return plain;
}
function applyReferentialEqualityAnnotations(plain, annotations) {
  function apply(identicalPaths, path) {
    const object = getDeep(plain, parsePath(path));
    identicalPaths.map(parsePath).forEach((identicalObjectPath) => {
      plain = setDeep(plain, identicalObjectPath, () => object);
    });
  }
  if (isArray(annotations)) {
    const [root, other] = annotations;
    root.forEach((identicalPath) => {
      plain = setDeep(plain, parsePath(identicalPath), () => plain);
    });
    if (other) {
      forEach(other, apply);
    }
  } else {
    forEach(annotations, apply);
  }
  return plain;
}
var isDeep = (object, superJson) => isPlainObject(object) || isArray(object) || isMap(object) || isSet(object) || isInstanceOfRegisteredClass(object, superJson);
function addIdentity(object, path, identities) {
  const existingSet = identities.get(object);
  if (existingSet) {
    existingSet.push(path);
  } else {
    identities.set(object, [path]);
  }
}
function generateReferentialEqualityAnnotations(identitites, dedupe) {
  const result = {};
  let rootEqualityPaths = void 0;
  identitites.forEach((paths) => {
    if (paths.length <= 1) {
      return;
    }
    if (!dedupe) {
      paths = paths.map((path) => path.map(String)).sort((a, b) => a.length - b.length);
    }
    const [representativePath, ...identicalPaths] = paths;
    if (representativePath.length === 0) {
      rootEqualityPaths = identicalPaths.map(stringifyPath);
    } else {
      result[stringifyPath(representativePath)] = identicalPaths.map(stringifyPath);
    }
  });
  if (rootEqualityPaths) {
    if (isEmptyObject(result)) {
      return [rootEqualityPaths];
    } else {
      return [rootEqualityPaths, result];
    }
  } else {
    return isEmptyObject(result) ? void 0 : result;
  }
}
var walker = (object, identities, superJson, dedupe, path = [], objectsInThisPath = [], seenObjects = /* @__PURE__ */ new Map()) => {
  const primitive = isPrimitive(object);
  if (!primitive) {
    addIdentity(object, path, identities);
    const seen = seenObjects.get(object);
    if (seen) {
      return dedupe ? {
        transformedValue: null
      } : seen;
    }
  }
  if (!isDeep(object, superJson)) {
    const transformed2 = transformValue(object, superJson);
    const result2 = transformed2 ? {
      transformedValue: transformed2.value,
      annotations: [transformed2.type]
    } : {
      transformedValue: object
    };
    if (!primitive) {
      seenObjects.set(object, result2);
    }
    return result2;
  }
  if (includes(objectsInThisPath, object)) {
    return {
      transformedValue: null
    };
  }
  const transformationResult = transformValue(object, superJson);
  const transformed = transformationResult?.value ?? object;
  const transformedValue = isArray(transformed) ? [] : {};
  const innerAnnotations = {};
  forEach(transformed, (value, index) => {
    if (index === "__proto__" || index === "constructor" || index === "prototype") {
      throw new Error(`Detected property ${index}. This is a prototype pollution risk, please remove it from your object.`);
    }
    const recursiveResult = walker(value, identities, superJson, dedupe, [...path, index], [...objectsInThisPath, object], seenObjects);
    transformedValue[index] = recursiveResult.transformedValue;
    if (isArray(recursiveResult.annotations)) {
      innerAnnotations[index] = recursiveResult.annotations;
    } else if (isPlainObject(recursiveResult.annotations)) {
      forEach(recursiveResult.annotations, (tree, key) => {
        innerAnnotations[escapeKey(index) + "." + key] = tree;
      });
    }
  });
  const result = isEmptyObject(innerAnnotations) ? {
    transformedValue,
    annotations: !!transformationResult ? [transformationResult.type] : void 0
  } : {
    transformedValue,
    annotations: !!transformationResult ? [transformationResult.type, innerAnnotations] : innerAnnotations
  };
  if (!primitive) {
    seenObjects.set(object, result);
  }
  return result;
};

// ../node_modules/is-what/dist/index.js
function getType2(payload) {
  return Object.prototype.toString.call(payload).slice(8, -1);
}
function isArray2(payload) {
  return getType2(payload) === "Array";
}
function isPlainObject2(payload) {
  if (getType2(payload) !== "Object")
    return false;
  const prototype = Object.getPrototypeOf(payload);
  return !!prototype && prototype.constructor === Object && prototype === Object.prototype;
}
function isNull2(payload) {
  return getType2(payload) === "Null";
}
function isOneOf(a, b, c, d, e) {
  return (value) => a(value) || b(value) || !!c && c(value) || !!d && d(value) || !!e && e(value);
}
function isUndefined2(payload) {
  return getType2(payload) === "Undefined";
}
var isNullOrUndefined = isOneOf(isNull2, isUndefined2);

// ../node_modules/copy-anything/dist/index.js
function assignProp(carry, key, newVal, originalObject, includeNonenumerable) {
  const propType = {}.propertyIsEnumerable.call(originalObject, key) ? "enumerable" : "nonenumerable";
  if (propType === "enumerable")
    carry[key] = newVal;
  if (includeNonenumerable && propType === "nonenumerable") {
    Object.defineProperty(carry, key, {
      value: newVal,
      enumerable: false,
      writable: true,
      configurable: true
    });
  }
}
function copy(target, options = {}) {
  if (isArray2(target)) {
    return target.map((item) => copy(item, options));
  }
  if (!isPlainObject2(target)) {
    return target;
  }
  const props = Object.getOwnPropertyNames(target);
  const symbols = Object.getOwnPropertySymbols(target);
  return [...props, ...symbols].reduce((carry, key) => {
    if (isArray2(options.props) && !options.props.includes(key)) {
      return carry;
    }
    const val = target[key];
    const newVal = copy(val, options);
    assignProp(carry, key, newVal, target, options.nonenumerable);
    return carry;
  }, {});
}

// ../node_modules/superjson/dist/index.js
var SuperJSON = class {
  /**
   * @param dedupeReferentialEqualities  If true, SuperJSON will make sure only one instance of referentially equal objects are serialized and the rest are replaced with `null`.
   */
  constructor({ dedupe = false } = {}) {
    this.classRegistry = new ClassRegistry();
    this.symbolRegistry = new Registry((s) => s.description ?? "");
    this.customTransformerRegistry = new CustomTransformerRegistry();
    this.allowedErrorProps = [];
    this.dedupe = dedupe;
  }
  serialize(object) {
    const identities = /* @__PURE__ */ new Map();
    const output = walker(object, identities, this, this.dedupe);
    const res = {
      json: output.transformedValue
    };
    if (output.annotations) {
      res.meta = {
        ...res.meta,
        values: output.annotations
      };
    }
    const equalityAnnotations = generateReferentialEqualityAnnotations(identities, this.dedupe);
    if (equalityAnnotations) {
      res.meta = {
        ...res.meta,
        referentialEqualities: equalityAnnotations
      };
    }
    return res;
  }
  deserialize(payload) {
    const { json, meta } = payload;
    let result = copy(json);
    if (meta?.values) {
      result = applyValueAnnotations(result, meta.values, this);
    }
    if (meta?.referentialEqualities) {
      result = applyReferentialEqualityAnnotations(result, meta.referentialEqualities);
    }
    return result;
  }
  stringify(object) {
    return JSON.stringify(this.serialize(object));
  }
  parse(string) {
    return this.deserialize(JSON.parse(string));
  }
  registerClass(v, options) {
    this.classRegistry.register(v, options);
  }
  registerSymbol(v, identifier) {
    this.symbolRegistry.register(v, identifier);
  }
  registerCustom(transformer, name) {
    this.customTransformerRegistry.register({
      name,
      ...transformer
    });
  }
  allowErrorProps(...props) {
    this.allowedErrorProps.push(...props);
  }
};
SuperJSON.defaultInstance = new SuperJSON();
SuperJSON.serialize = SuperJSON.defaultInstance.serialize.bind(SuperJSON.defaultInstance);
SuperJSON.deserialize = SuperJSON.defaultInstance.deserialize.bind(SuperJSON.defaultInstance);
SuperJSON.stringify = SuperJSON.defaultInstance.stringify.bind(SuperJSON.defaultInstance);
SuperJSON.parse = SuperJSON.defaultInstance.parse.bind(SuperJSON.defaultInstance);
SuperJSON.registerClass = SuperJSON.defaultInstance.registerClass.bind(SuperJSON.defaultInstance);
SuperJSON.registerSymbol = SuperJSON.defaultInstance.registerSymbol.bind(SuperJSON.defaultInstance);
SuperJSON.registerCustom = SuperJSON.defaultInstance.registerCustom.bind(SuperJSON.defaultInstance);
SuperJSON.allowErrorProps = SuperJSON.defaultInstance.allowErrorProps.bind(SuperJSON.defaultInstance);
var serialize = SuperJSON.serialize;
var deserialize = SuperJSON.deserialize;
var stringify = SuperJSON.stringify;
var parse = SuperJSON.parse;
var registerClass = SuperJSON.registerClass;
var registerCustom = SuperJSON.registerCustom;
var registerSymbol = SuperJSON.registerSymbol;
var allowErrorProps = SuperJSON.allowErrorProps;

// ../node_modules/@midnight-ntwrk/midnight-js-level-private-state-provider/dist/index.mjs
var import_crypto = __toESM(require_crypto(), 1);
var ALGORITHM = "aes-256-gcm";
var KEY_LENGTH = 32;
var IV_LENGTH = 12;
var AUTH_TAG_LENGTH = 16;
var SALT_LENGTH = 32;
var PBKDF2_ITERATIONS = 1e5;
var ENCRYPTION_VERSION = 1;
var VERSION_PREFIX_LENGTH = 1;
var HEADER_LENGTH = VERSION_PREFIX_LENGTH + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
var StorageEncryption = class {
  encryptionKey;
  salt;
  constructor(password, existingSalt) {
    this.salt = existingSalt ?? (0, import_crypto.randomBytes)(SALT_LENGTH);
    this.encryptionKey = this.deriveKey(password, this.salt);
  }
  deriveKey(password, salt) {
    return (0, import_crypto.pbkdf2Sync)(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
  }
  encrypt(data) {
    const plaintext = import_buffer.Buffer.from(data, "utf-8");
    const iv = (0, import_crypto.randomBytes)(IV_LENGTH);
    const cipher = (0, import_crypto.createCipheriv)(ALGORITHM, this.encryptionKey, iv);
    const encrypted = import_buffer.Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const version = import_buffer.Buffer.from([ENCRYPTION_VERSION]);
    const result = import_buffer.Buffer.concat([version, this.salt, iv, authTag, encrypted]);
    return result.toString("base64");
  }
  decrypt(encryptedData) {
    const data = import_buffer.Buffer.from(encryptedData, "base64");
    if (data.length < HEADER_LENGTH) {
      throw new Error("Invalid encrypted data: too short");
    }
    const version = data[0];
    if (version !== ENCRYPTION_VERSION) {
      throw new Error(`Unsupported encryption version: ${version}`);
    }
    const salt = data.subarray(VERSION_PREFIX_LENGTH, VERSION_PREFIX_LENGTH + SALT_LENGTH);
    const iv = data.subarray(VERSION_PREFIX_LENGTH + SALT_LENGTH, VERSION_PREFIX_LENGTH + SALT_LENGTH + IV_LENGTH);
    const authTag = data.subarray(VERSION_PREFIX_LENGTH + SALT_LENGTH + IV_LENGTH, VERSION_PREFIX_LENGTH + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(HEADER_LENGTH);
    if (!this.salt.equals(salt)) {
      throw new Error("Salt mismatch: data was encrypted with a different password");
    }
    const decipher = (0, import_crypto.createDecipheriv)(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = import_buffer.Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf-8");
  }
  static isEncrypted(data) {
    try {
      const buffer = import_buffer.Buffer.from(data, "base64");
      return buffer.length >= HEADER_LENGTH && buffer[0] === ENCRYPTION_VERSION;
    } catch {
      return false;
    }
  }
  getSalt() {
    return this.salt;
  }
};
var validatePassword = (password) => {
  if (!password) {
    throw new Error("Password is required for private state encryption.\nPlease provide a password via privateStoragePasswordProvider in the configuration.");
  }
  if (password.length < 16) {
    throw new Error("Password must be at least 16 characters long.\nUse a strong, randomly generated password for production.");
  }
};
var getPasswordFromProvider = async (provider) => {
  const password = await provider();
  validatePassword(password);
  return password;
};
var MN_LDB_DEFAULT_DB_NAME = "midnight-level-db";
var MN_LDB_DEFAULT_PRIS_STORE_NAME = "private-states";
var MN_LDB_DEFAULT_KEY_STORE_NAME = "signing-keys";
var DEFAULT_CONFIG = {
  /**
   * The name of the database.
   */
  midnightDbName: MN_LDB_DEFAULT_DB_NAME,
  /**
   * The name of the "level" on which to store private state.
   */
  privateStateStoreName: MN_LDB_DEFAULT_PRIS_STORE_NAME,
  /**
   * The name of the "level" on which to store signing keys.
   */
  signingKeyStoreName: MN_LDB_DEFAULT_KEY_STORE_NAME
};
registerCustom({
  isApplicable: (v) => v instanceof import_buffer.Buffer,
  serialize: (v) => v.toString("hex"),
  deserialize: (v) => import_buffer.Buffer.from(v, "hex")
}, "buffer");
var withSubLevel = async (dbName, levelName, thunk) => {
  const level = new import_level.Level(dbName, {
    createIfMissing: true
  });
  const subLevel = level.sublevel(levelName, {
    valueEncoding: "utf-8"
  });
  try {
    await level.open();
    await subLevel.open();
    return await thunk(subLevel);
  } finally {
    await subLevel.close();
    await level.close();
  }
};
var METADATA_KEY = "__midnight_encryption_metadata__";
var getOrCreateEncryption = async (dbName, levelName, passwordProvider) => {
  const password = await getPasswordFromProvider(passwordProvider);
  return withSubLevel(dbName, levelName, async (subLevel) => {
    try {
      const metadataJson = await subLevel.get(METADATA_KEY);
      if (!metadataJson) {
        throw new Error("Metadata not found");
      }
      const metadata = JSON.parse(metadataJson);
      const salt = import_buffer.Buffer.from(metadata.salt, "hex");
      return new StorageEncryption(password, salt);
    } catch {
      const encryption = new StorageEncryption(password);
      const metadata = {
        salt: encryption.getSalt().toString("hex"),
        version: 1
      };
      await subLevel.put(METADATA_KEY, JSON.stringify(metadata));
      return encryption;
    }
  });
};
var subLevelMaybeGet = async (dbName, levelName, key, passwordProvider) => {
  const encryption = await getOrCreateEncryption(dbName, levelName, passwordProvider);
  return withSubLevel(dbName, levelName, async (subLevel) => {
    try {
      const encryptedValue = await subLevel.get(key);
      if (encryptedValue === void 0) {
        return null;
      }
      let decryptedValue;
      if (StorageEncryption.isEncrypted(encryptedValue)) {
        decryptedValue = encryption.decrypt(encryptedValue);
      } else {
        decryptedValue = encryptedValue;
        const reEncrypted = encryption.encrypt(encryptedValue);
        await subLevel.put(key, reEncrypted);
      }
      const value = parse(decryptedValue);
      if (value === void 0) {
        return null;
      }
      return value;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "LEVEL_NOT_FOUND") {
        return null;
      }
      throw error;
    }
  });
};
var levelPrivateStateProvider = (config) => {
  const fullConfig = import_lodash.default.defaults(config, DEFAULT_CONFIG);
  if (config.privateStoragePasswordProvider && config.walletProvider) {
    throw new Error("Cannot provide both privateStoragePasswordProvider and walletProvider.\nProvide only one: walletProvider for default behavior, or privateStoragePasswordProvider for custom password.");
  }
  if (!config.privateStoragePasswordProvider && !config.walletProvider) {
    throw new Error("Either privateStoragePasswordProvider or walletProvider must be provided.\nProvide walletProvider to use wallet encryption key, or privateStoragePasswordProvider for custom password.");
  }
  const passwordProvider = config.privateStoragePasswordProvider || (() => config.walletProvider.getEncryptionPublicKey());
  return {
    get(privateStateId) {
      return subLevelMaybeGet(fullConfig.midnightDbName, fullConfig.privateStateStoreName, privateStateId, passwordProvider);
    },
    remove(privateStateId) {
      return withSubLevel(fullConfig.midnightDbName, fullConfig.privateStateStoreName, (subLevel) => subLevel.del(privateStateId));
    },
    async set(privateStateId, state) {
      const encryption = await getOrCreateEncryption(fullConfig.midnightDbName, fullConfig.privateStateStoreName, passwordProvider);
      const serialized = stringify(state);
      const encrypted = encryption.encrypt(serialized);
      return withSubLevel(fullConfig.midnightDbName, fullConfig.privateStateStoreName, (subLevel) => subLevel.put(privateStateId, encrypted));
    },
    clear() {
      return withSubLevel(fullConfig.midnightDbName, fullConfig.privateStateStoreName, (subLevel) => subLevel.clear());
    },
    getSigningKey(address) {
      return subLevelMaybeGet(fullConfig.midnightDbName, fullConfig.signingKeyStoreName, address, passwordProvider);
    },
    removeSigningKey(address) {
      return withSubLevel(fullConfig.midnightDbName, fullConfig.signingKeyStoreName, (subLevel) => subLevel.del(address));
    },
    async setSigningKey(address, signingKey) {
      const encryption = await getOrCreateEncryption(fullConfig.midnightDbName, fullConfig.signingKeyStoreName, passwordProvider);
      const serialized = stringify(signingKey);
      const encrypted = encryption.encrypt(serialized);
      return withSubLevel(fullConfig.midnightDbName, fullConfig.signingKeyStoreName, (subLevel) => subLevel.put(address, encrypted));
    },
    clearSigningKeys() {
      return withSubLevel(fullConfig.midnightDbName, fullConfig.signingKeyStoreName, (subLevel) => subLevel.clear());
    }
  };
};
export {
  DEFAULT_CONFIG,
  StorageEncryption,
  levelPrivateStateProvider
};
//# sourceMappingURL=@midnight-ntwrk_midnight-js-level-private-state-provider.js.map
