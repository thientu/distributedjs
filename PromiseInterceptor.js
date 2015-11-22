var Reflect = require('harmony-reflect');
var promises = new WeakMap();

/**
 * configuring the stack trace settings and configuration
 * @param error
 * @param stack
 * @returns {*}
 */
//Error.prepareStackTrace = function(error, stack) {
//  return stack;
//};
/**
 * Setting a big number of stack trace elements to track deeply nested call code.
 * @type {number}
 */
Error.stackTraceLimit = 100;

/**
 * Maps all object accessed to the expected behaviour when the object is not accessed within the vm
 * @param name
 * @returns {Function}
 */
function getTrap(name) {
  return function proxyTrap(promise) {
    console.log("Intercepted call to", name);
    if ( PromiseInterceptor.intercept ) {
      // Allowing to recognize the promise interceptor without triggering the intercept operation
      if ( name === "get" && arguments[1] === "isPromiseInterceptor" ) {
        return true;
      }
      // Making sure it only gets called once per interception (to allow the interpreter to intercept too)
      PromiseInterceptor.intercept = null;
      // Capturing the error stack
      var error = {};
      Error.captureStackTrace(error, proxyTrap);
      var errorStack = (error).stack;
      return PromiseInterceptor.intercept.call(PromiseInterceptor, promise, errorStack);
    }
    else {
      return Reflect[name].apply(PromiseInterceptor, arguments);
    }
  }
}

/**
 * Trap for valueOf and toString
 * @param promise
 * @returns {*|XMLList|XML|Namespace|Array|boolean}
 */
function valueOfTrap(promise) {
  var error = {};
  Error.captureStackTrace(error, valueOfTrap);
  var errorStack = (error).stack;
  if ( PromiseInterceptor.intercept ) {
    return PromiseInterceptor.intercept.call(PromiseInterceptor, promise, errorStack);
  }
  else {
    console.log("Intercepted call to", name);
    return promise.__proto__.valueOf();
  }
}

/**
 * Building proxy handler, with all traps set to the same behaviour.
 * @type {{getOwnPropertyDescriptor: Function, getOwnPropertyNames: Function, getPrototypeOf: Function, defineProperty: Function, deleteProperty: Function, freeze: Function, seal: Function, preventExtensions: Function, isFrozen: Function, isSealed: Function, isExtensible: Function, has: Function, hasOwn: Function, get: Function, set: Function, enumerate: Function, keys: Function, apply: Function, construct: Function}}
 */
var handler = {
  getOwnPropertyDescriptor: getTrap("getOwnPropertyDescriptor"),
  getOwnPropertyNames     : getTrap("getOwnPropertyNames"),
  getPrototypeOf          : getTrap("getPrototypeOf"),
  defineProperty          : getTrap("defineProperty"),
  deleteProperty          : getTrap("deleteProperty"),
  freeze                  : getTrap("freeze"),
  seal                    : getTrap("seal"),
  preventExtensions       : getTrap("preventExtensions"),
  isFrozen                : getTrap("isFrozen"),
  isSealed                : getTrap("isSealed"),
  isExtensible            : getTrap("isExtensible"),
  has                     : getTrap("has"),
  hasOwn                  : getTrap("hasOwn"),
  get                     : getTrap("get"),
  set                     : getTrap("set"),
  enumerate               : getTrap("enumerate"),
  keys                    : getTrap("keys"),
  apply                   : getTrap("apply"),
  construct               : getTrap("construct")
};

/**
 * Promise Proxy wrapper
 * @param handler
 * @returns {*}
 * @constructor
 */
function PromiseInterceptor(handler) {
  var promise = new Promise(handler);
  // Capturing valueOf and toString, for non object promises
  Object.defineProperties(promise, {
    valueOf : {
      value: valueOfTrap
    },
    toString: {
      value: valueOfTrap
    }
  });
  var proxy = Proxy(promise, handler);
  // Storing proxy to promise for later retrieval
  promises.set(proxy, promise);
  return proxy;
}

/**
 * Gets the raw promise associated to the proxy
 * @param proxy
 * @returns {V}
 */
PromiseInterceptor.getPromise = function (proxy) {
  return promises.get(proxy);
};

/**
 * Checks if there is a promise associated to the proxy
 * @param proxy
 * @returns {boolean}
 */
PromiseInterceptor.hasPromise = function (proxy) {
  try {
    return promises.has(proxy);
  } catch ( e ) {
    return false;
  }
};
/**
 *
 * @param obj
 * @returns {boolean}
 */
PromiseInterceptor.isProxyPromise = function (obj) {
  return this.hasPromise(obj);
};
/**
 * Returns an array, with the points in the call stack where the code stopped
 * @param errorStack
 * @returns {Array}
 */
PromiseInterceptor.getExecutionStackPoints = function (errorStack) {
  var stack = errorStack.split(/\n\s+/g);
  var executionStackPoints = [];
  for ( var i = 0; i < stack.length; i++ ) {
    var point = "";
    var stackItem = stack[i];
    var point = stackItem.match(/(\w+) \(VM\d+\:(\d+)\:(\d+)\)$/);
    if ( point ) {
      var at = point[1]
      var line = point[2];
      var column = point[3];
      executionStackPoints.push({ at: at, line: line, col: column });
    }
  }
  return executionStackPoints;
};
/**
 *
 * @param evaluate
 * @param intercept
 * @returns {*}
 */
PromiseInterceptor.unWrap = function (evaluate, intercept) {
  var result;
  this.intercept = function (promise, errorStack) {
    var stackPoints = PromiseInterceptor.getExecutionStackPoints(errorStack);
    result = intercept.call(this, promise, stackPoints);
    throw(PromiseInterceptor); // interrupting after evaluation
  };
  try {
    result = evaluate();
  } catch ( err ) {
    // if the error is the one we threw, then stop here, otherwise, pass it on
    if ( err !== PromiseInterceptor ) {
      throw(err)
    }
  }

  // If result is a wrapped promise
  if ( this.isProxyPromise(result) ) {
    // Unwrap promise
    return this.getPromise(result);
  }
  else {
    return result;
  }
};
/**
 * Exporting PromiseInterceptor
 * @type {PromiseInterceptor}
 */
module.exports = PromiseInterceptor;
