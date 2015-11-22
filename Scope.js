var Reflect = require('harmony-reflect');
// Defining function and variable names regex
var nameRegex = /^[$A-Z_][0-9A-Z_$]*$/i;

/**
 * Scope's object representation
 * @param parentFunction
 * @param evaluate
 * @param environment
 * @param thisVar
 * @param parentScope
 * @param functionScopes
 * @constructor
 */
function Scope(parentFunction, evaluate, environment, thisVar, parentScope, functionScopes) {
  // Function the scope belongs to
  this.parentFunction = parentFunction;
  // Evaluate method, within the parent Function
  this.evaluate = evaluate;
  // Scope's environment variables (within parent function);
  this.environment = environment;
  // Scope's "this" variable
  this.this = thisVar;
  // Current scope, parent's scope if any
  this.parentScope = parentScope || null;
  // Setting the environment prototype chain, so parent environment properties are accessible
  if ( this.parentScope ) {
    Reflect.setPrototypeOf(this.environment, this.parentScope.environment);
    // Making environment object non extensible (no more properties), and non configurable
    Object.seal(this.environment);
  }
  // scope -> function and function -> scope associations
  this.functionScopes = functionScopes || new WeakMap();
  // Registering scope, parent function weak association
  this.functionScopes.set(this, parentFunction);
  // Registering evaluate function, parent scope weak association
  this.functionScopes.set(evaluate, this);
}

/**
 * Retrieve the parent scope of a function
 * @param func
 * @returns {*|null}
 */
Scope.prototype.getParentScope = function (func) {
  var parentScope = this.functionScopes.get(func);
  return parentScope || null;
};

/**
 * Create a new scope
 * @param parentFunction
 * @param evaluate
 * @param environment
 * @param context
 * @returns {*}
 */
Scope.prototype.create = function (parentFunction, evaluate, environment, context) {
  // Determining the parent scope of the parentFunction
  var parentScope = this.functionScopes.get(parentFunction);
  // Creating new scope
  var scope = new Scope(parentFunction, evaluate, environment, context, parentScope, this.functionScopes);
  // Association new scope with parent function;
  this.functionScopes.set(scope, parentFunction);
  // returning scope... just in case.
  return scope;
};

/**
 * Links a closure, to is parent scope.
 * @param closure
 * @returns {*|null}
 */
Scope.prototype.link = function (closure) {
  this.functionScopes.set(closure, this);
  return closure;
};

/**
 * Evaluates code within the scope environment
 * @param code
 * @returns {*}
 */
Scope.prototype.eval = function scopeEval(code) {
  return this.evaluate.call(this.this, code);
};

/**
 * Saves scope's environment variables, to match the state of the variables within the parent function
 */
Scope.prototype.save = function () {
  if ( !this.parentScope ) {
    return;
  } // if this is the root scope, there is nothing to save
  var variableNames = Object.keys(this.environment);
  var saveCode = [];
  for ( var i = 0; i < variableNames.length; i++ ) {
    var name = variableNames[i];
    saveCode.push("this." + name + " = " + name);
  }
  this.evaluate.call(this.environment, saveCode.join(";"));
};

/**
 * Updates all variables within the parent Function, to match the values of the scope's environment
 */
Scope.prototype.update = function () {
  var variableNames = Object.keys(this.environment);
  var updateCode = [];
  for ( var i = 0; i < variableNames.length; i++ ) {
    var name = variableNames[i];
    updateCode.push(name + " = this." + name);
  }
  this.evaluate.call(this.environment, updateCode.join(";"));
};

/**
 * Gets the value of a variable within the parent function
 * @param name
 * @returns {*}
 */
Scope.prototype.get = function (name) {
  // If the variable name is not valued, throw a syntax error
  if ( !nameRegex.test(name) ) {
    throw(new SyntaxError());
  }
  return this.evaluate(name);
}

/**
 * Sets the value of a variable within the parent function
 * @param name
 * @param value
 * @returns {*}
 */
Scope.prototype.set = function (name, value) {
  // If the variable name is not valued, throw a syntax error
  if ( !nameRegex.test(name) ) {
    throw(new SyntaxError());
  }
  // Calling the evaluate function with value as "this", to import it within the function
  return this.evaluate.call(value, name + " = this");
}

/**
 * Gets the environment variables of a scope
 * @returns {*}
 */
Scope.prototype.getEnvironment = function () {
  this.save();
  return this.environment;
}

/**
 * Gets the value of a variable within the parent function
 * @param name
 * @returns {*}
 */
Scope.prototype.has = function (name) {
  if ( this.parent === null && ( name === 'global' || name === 'capture' || name === 'close') ) {  //If it is
    // one of the 3 global context allowed identifiers (everything else should be prefixed with global)
    return true;
  }
  else {
    return this.environment.hasOwnProperty(name) || ( this.parent ) ? this.parent.has(name) : false;
  }
};

/**
 * Sets the environment variables of a scope
 * @returns {*}
 */
Scope.prototype.setEnvironment = function (environment) {
  var variableNames = Object.keys(environment);
  for ( var i = 0; i < variableNames.length; i++ ) {
    var name = variableNames[i];
    if ( this.environment.hasOwnProperty(name) ) {
      this.environment[name] = environment[name];
    }
  }
  this.update();
}

/**
 * Exporting Scope constructor
 * @type {Scope}
 */
module.exports = Scope;
