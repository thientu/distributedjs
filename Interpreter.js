"strict mode";
var PromiseInterceptor = require('./PromiseInterceptor');
var recast = require("recast");
var types = recast.types;
var builders = recast.types.builders;

/**
 * Interpreter constructor
 * @param vm
 * @constructor
 */
function Interpreter(vm) {
  this.vm = vm;
  this.nodeStack = [];
  this.scope = this.vm.scope;
  this.nodeStates = new WeakMap();
  this.passive = false;
}

/**
 * Public eval function
 * @param ast
 * @returns {*}
 */
 
Interpreter.prototype.eval = function (ast) {
  var self = this;
  var promiseToEvaluate = new Promise(function(resolve, reject){
        self.evaluate(ast, resolve, reject);
  });
  return promiseToEvaluate;
};


Interpreter.prototype.evaluateFrom = function (executionStackPoints) {
  var self = this;
  
};

Interpreter.prototype.getContinuation = function (executionStackPoints) {
  var continuation;
  
  return continuation;
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 */
Interpreter.prototype.evaluate = function (node, continuation, errorContinuation) {
  // If node is null, simply run the continuation (used to simplify code in some cases)
  // var originalLoc = node.original.loc
  // var sloc = this.vm.compiler.smc.generatedPositionFor({line:originalLoc.start.line,column:originalLoc.start.column,source:'map.json'});
  // var eloc = this.vm.compiler.smc.generatedPositionFor({line:originalLoc.end.line,column:originalLoc.end.column,source:'map.json'});
  
  if ( !node ) {
    continuation(); // If the passed node is empty, just keep going;
  }
  else if ( node instanceof Object && typeof node.type !== "undefined" ) {
    if ( this.intercept(node, continuation, errorContinuation) ) {
      return;
    }

    switch ( node.type ) {
      case "EmptyStatement":
        continuation();
        break;
      case "Program":
        this.Program(node, continuation, errorContinuation);
        break;
      case "BlockStatement":
        this.BlockStatement(node, continuation, errorContinuation);
        break;
      case "FunctionDeclaration":
      case "FunctionExpression":
        this.FunctionExpression(node, continuation, errorContinuation);
        break;
      case "VariableDeclaration":
        this.evaluate(node.declarations, continuation, errorContinuation);
        break;
      case "VariableDeclarator":
        this.VariableDeclarator(node, continuation, errorContinuation);
        break;
      case "ExpressionStatement":
        this.evaluate(node.expression, continuation, errorContinuation);
        break;
      case "SequenceExpression":
        this.SequenceExpression(node, continuation, errorContinuation);
        break;
      case "CallExpression":
        this.CallExpression(node, continuation, errorContinuation);
        break;
      case "NewExpression":
        this.NewExpression(node, continuation, errorContinuation);
        break;
      case "IfStatement":
      case "ConditionalExpression":
        this.ConditionalExpression(node, continuation, errorContinuation);
        break;
      case "WhileStatement":
      case "DoWhileStatement":
      case "ForStatement":
        this.LoopExpression(node, continuation, errorContinuation);
        break;
      case "ForInStatement":
      case "ForOfStatement":
        this.ForInStatement(node, continuation, errorContinuation);
        break;
      case "BreakStatement":
      case "ContinueStatement":
        errorContinuation(node.type, (node.label ? node.label.name : undefined));
        break;
      case "ReturnStatement":
      case "ThrowStatement":
        this.ReturnStatement(node, continuation, errorContinuation);
        break;
      case "TryStatement":
      case "CatchClause":
        // Errors out because there should be no more catch statements
        throw new Error("Instrumented Code should not attempt to do try/catch directly");
        break;
      case "LogicalExpression":
        this.LogicalExpression(node, continuation, errorContinuation);
        break;
      case "BinaryExpression":
        this.BinaryExpression(node, continuation, errorContinuation);
        break;
      case "AssignmentExpression":
        this.AssignmentExpression(node, continuation, errorContinuation);
        break;
      case "UpdateExpression":
        this.UpdateExpression(node, continuation, errorContinuation);
        break;
      case "UnaryExpression":
        this.UnaryExpression(node, continuation, errorContinuation);
        break;
      case "Identifier":
        this.Identifier(node, continuation, errorContinuation);
        break;
      case "MemberExpression":
        this.MemberExpression(node, continuation, errorContinuation);
        break;
      case "ThisExpression":
        this.ThisExpression(node, continuation, errorContinuation);
        break;
      case "Literal":
        this.Literal(node, continuation, errorContinuation);
        break;
      case "ObjectExpression":
        this.ObjectExpression(node, continuation, errorContinuation);
        break;
      case "ArrayExpression":
        // TODO: handle non enumerable undefined elements  [,,,]
        this.evaluateArray(node.elements, continuation, errorContinuation);
        break;
      default:
        throw new Error("Node type " + node.type + " not supported");
    }
  }
  else {
    // TODO: Create custom error classes, so we send errors that are errors, can have meaningful/sandboxed stack traces

    throw new Error("Node type " + node.type + " not supported");
  }
};

/**
 *
 * @param nodes
 * @param continuation
 * @param errorContinuation
 */
Interpreter.prototype.evaluateArray = function (nodes, continuation, errorContinuation) {
  var self = this;
  var results = [];     // array where we will collect the results
  var i = 0;            // Initializing where we will start
  (function evaluateNextNode() {
    // if there are nodes to process
    if ( i < nodes.length ) {
      var node = nodes[i++];// evaluate first node while removing it from the remaining nodes array
      self.evaluate(node, function (result) {
                      // push the result of the evaluation to the results array
                      results.push(result);
                      // evaluate next node, passing the remaining nodes
                      evaluateNextNode();
                    },
                    errorContinuation);
    }
    // If there are no more nodes to process, then we may proceed with the continuation passing the results
    else {
      continuation.call(self, results);
    }
  }).call(this); // call with the nodes array
}

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.Program = function (node, continuation, errorContinuation) {
  var self = this;
  var caller = this.vm.getAstFunction(node); // Getting function object corresponding to this node, and defining it as a caller
  this.vm.pushCaller(caller, this.scope);  // Adding stack frame to the call stack
  this.BlockStatement(node, function (results) { // Body is an array of nodes, so
    // once all the statements have been evaluated, we remove the current frame from the call stack
    self.vm.popCaller();
    // passing the value of the last statement to the continuation, since this is the natural behaviour of eval
    //TODO: find out why, if results are reversed in most cases, we are passing the last one and not the first one
    continuation(results[results.length - 1]);

  }, errorContinuation);
}


/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.BlockStatement = function (node, continuation, errorContinuation) {
  // evaluating the body, making sure
  this.evaluateArray(node.body, continuation, function (errorType) {
    switch ( errorType ) {
      case "ReturnStatement":
      case "ContinueStatement":
      case "BreakStatement":
      case "ThrowStatement":
      case "Error":
        errorContinuation.apply(null, arguments);
        break;
      default:
        continuation.apply(null, arguments);
        break;
    }
  });
};

/**
 * 
 * 
 */

Interpreter.prototype.SequenceExpression = function (node, continuation, errorContinuation) {
  this.evaluateArray(node.expressions, function (results) { // Body is an array of nodes, so
    // passing the value of the last statement to the continuation, since this is the natural behaviour of eval
    continuation(results[results.length - 1]);
  }, errorContinuation);
}

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.FunctionExpression = function (node, continuation, errorContinuation) {
  //TODO: Find out if this needs to be instrumented, or if it is going to
  //TODO: be pre-instrumented. Actually, if the meta interpreter, will act on instrumented code or uninstrumented code
  //TODO: find out if we can simply use the node.loc start and end, to extract the source code from the parent body
  var functionCode = this.vm.code.substring(node.range[0], node.range[1]);
  //var functionCode = recast.print(builders.program([node])).code; // Maybe it is better to store source code?
  var functionObject = this.vm.eval(functionCode, function (error) {
    errorContinuation("Error", error);
  });
  this.scope.link(functionObject); //Linking function (since we are running on un-compiled ast)

  if ( node.id && !this.passive ) { // If it is a named function
    this.setValue(node.id.name, functionObject);
    if ( !this.scope.parent && !this.passive ) { // if we are in the global scope and it is named, then add it there
      this.scope.variables[node.id.name] = functionObject;
    }
  }
  continuation(functionObject);
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.VariableDeclarator = function (node, continuation, errorContinuation) {
  var self = this;
  this.evaluate(node.init, function (value) {
    if ( !self.passive ) {
      self.scope.set(node.id.name, value);
    }
    continuation(value, node.id.name);
  }, errorContinuation);
};

/**
 *
 * TODO: seems like on non member expressions, the arguments get processed after the callee,
 * TODO: and in identifier expressions, arguments get processed after the identifier has been validated to exist in
 * TODO: the scope
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.CallExpression = function (node, continuation, errorContinuation) {
  var self = this;
  if ( node.callee.type === "MemberExpression" ) {
    // Processing the arguments first
    self.evaluateArray(node.arguments, function (_arguments) {
    // Retrieving the callee    
      self.evaluate(node.callee, function (callee, thisObj, memberMethodName) {
        if ( typeof callee === "undefined" || typeof callee !== "function"  ) {
          errorContinuation("Error", new TypeError(typeof callee + " is not a function"));
        } else {
            if (callee === eval ) {
              continuation(self.scope.eval.apply(self.scope, _arguments));
            }
            else {
              self.vm.tryCatch(function () {
                "use strict"; // Making sure we do not leak the global object if "_this" is null
                continuation(callee.apply(thisObj, _arguments));
              }, errorContinuation);
            } 
        }
      });
     });
  }
  else {
    this.evaluate(node.callee, function (callee) {
      if ( typeof callee === "undefined" || typeof callee !== "function"  ) {
        errorContinuation("Error", new TypeError(typeof callee + " is not a function"));
      } else {
        self.evaluateArray(node.arguments, function (_arguments) {
          if (callee === eval ) {
            continuation(self.scope.eval.apply(self.scope, _arguments));
          }
          else {
            self.vm.tryCatch(function () {
              "use strict"; // Making sure we do not leak the global object if "_this" is null
              continuation(callee.apply(null, _arguments));
            }, errorContinuation);
          }
        });
      }
    });
  }
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.NewExpression = function (node, continuation, errorContinuation) {
  var self = this;
  this.evaluateArray(node.arguments, function (_arguments) { // evaluating the arguments of the expression
    self.evaluate(node.callee, function (Constructor) {      // evaluating the callee
      if ( typeof Constructor !== "function" ) {             // if the callee is not a function
        errorContinuation("Error", new TypeError(typeof Constructor + " is not a function"));
      }
      else {                  
        self.vm.tryCatch(function () {    
          var BoundConstructor = Function.prototype.bind.apply(Constructor, [void 0].concat(_arguments));  // Create function, bound to the arguments retrieved, and then using new on it.
          var newObject = new BoundConstructor;
          continuation(newObject);
        }, function (error) {
          errorContinuation("Error", error);
        });
      }
    });
  }, errorContinuation);
};
/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.ConditionalExpression = function (node, continuation, errorContinuation) {
  var self = this;
  this.evaluate(node.test, function (test) {
    if ( test ) {
      self.evaluate(node.consequent, continuation, errorContinuation);
    }
    else if ( node.alternate ) {
      self.evaluate(node.alternate, continuation, errorContinuation);
    }
    else {
      continuation();
    }
  }, errorContinuation);
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.LoopExpression = function (node, continuation, errorContinuation) {
  var self = this;
  var bodyResults = []; // Storing results, to return the last one for eval (which return automatically the last statement)
  if ( node.init ) {  // if there is an init (for statement)
    // TODO: Ask/find why we are passing the parent continuation as an error continuation
    self.evaluate(node.init, loopContinuation, continuation); // evaluating the init, and continuing with the
    // loop continuation
  }
  else if ( node.type === "WhileStatement" ) {  // if it is just a while statement, simply go into the loop continuation
    loopContinuation();
  }
  else { // Else, we start evaluating the body first (do while), then do a normal loop continuation
    self.evaluate(node.body, bodyContinuation, bodyErrorContinuation);
  }
  var lastResult;
  /**
   *
   * @param result
   */
  function bodyContinuation(results) { // Body continuation, stores the result, and evaluates the update when present, then continue looping
    lastResult = (results[results.length-1]); // keeping track of the evaluation results, for continuations that need them (i.e. Program/eval)
    // if there is an update, run it.
    // TODO: Ask/find why it is run before looping, and not after (perhaps it has run before once?)
    if ( node.update ) {
      self.evaluate(node.update, loopContinuation, errorContinuation);
    }
    else {
      loopContinuation();
    }
  }

  /**
   *
   * @param continuation
   */
  function updateAndContinue(continuation) {
    if ( node.update ) {
      self.evaluate(node.update, function () {
        continuation.apply(null, lastResult);
      }, errorContinuation);
    }
    else {
      continuation.apply(null, lastResult);
    }
  }

  /**
   *
   * @param errorType
   * @param value
   * @param extra
   */
  function bodyErrorContinuation(errorType, value, extra) {  // Creating body error continuation (paired with body continuation)
    switch ( errorType ) {
      case "BreakStatement":
        if ( typeof value === "undefined" ) {
          continuation.apply(null, extra.length ? extra : lastResult);
        }
        else {
          errorContinuation(errorType, value, loopContinuation);
        }
        break;
      case "ContinueStatement":
        if ( typeof value === "undefined" ) {
          updateAndContinue(loopContinuation);
        }
        else {
          // update first
          updateAndContinue(function () {
            errorContinuation(errorType, value, loopContinuation);
          });
        }
        break;
      default:
        errorContinuation.apply(null, arguments);
        break;
    }
  }

  /**
   *
   */
  function loopContinuation() {
    if ( node.test ) {  // if the there is a test node, evaluate it
      self.evaluate(node.test, function (test) {
        if ( test ) { // if the value from the test is truth-y evaluate the body
          self.evaluate(node.body, bodyContinuation, bodyErrorContinuation);
        }
        else { // if the test does not pass, then it is time to end the loop, so call the parent continuation
          // with all the results;
          continuation(lastResult);
        }
      }, errorContinuation);
    }
    // TODO: find out when the body needs to be evaluated without a test (all loops have a test)
    else {
      self.evaluate(node.body, bodyContinuation, bodyErrorContinuation);
    }
  }
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.ForInStatement = function (node, continuation, errorContinuation) {
  var self = this;

  function rightContinuation(right) {

    /**
     * Collect results into an array. Inconsistent with native implementation,
     * because all the getters would be called immediately at the very beginning
     */
    var
      leftHandSide = (node.left.type === "VariableDeclaration") ? node.left.declarations[0].id : node.left,
      results      = [];

    var keys = Object.keys(right);
    if ( node.type === 'ForOfStatement' ) {
      for ( var i = 0; i < keys.length; i++ ) {
        var key = keys[i];
        results.push(right[key]);
      }
    }
    else {
      results = keys;
    }

    /**
     * Haven't found yet a better way to follow semantics of let-hand-side expression updates.
     * Remember that
     *
     * for(var x in z) {}
     * for(x in z) {}
     * for(x.y in z) {}
     *
     * are all valid programs.
     *
     * TODO: what about values attached to the original AST?
     * TODO: See how this is affected by the fact that all calls are being splitted
     */
    function assignment(value) {
      return {
        "type"    : "AssignmentExpression",
        "operator": "=",
        "left"    : leftHandSide,
        "right"   : {
          "type" : "Literal",
          "value": value,
          "raw"  : "\"" + value + "\""
        }
      }
    }

    function bodyErrorContinuation(errorType, value, extra) {
      switch ( errorType ) {
        case "BreakStatement":
          if ( typeof value === "undefined" ) {
            continuation();
          }
          else {
            errorContinuation(errorType, value);
          }
          break;
        case "ContinueStatement":
          if ( typeof value === "undefined" ) {
            loopContinuation();
          }
          else {
            errorContinuation(errorType, value);
          }
          break;
        default:
          errorContinuation.apply(null, arguments);
          break;
      }
    }

    var loopResults;

    function loopContinuation(result) {
      if ( loopResults ) {
        loopResults.push(result);
      }
      else {
        loopResults = [];
      }
      if ( results.length ) {
        self.evaluate(assignment(results.shift()), function () {
          self.evaluate(node.body, loopContinuation, bodyErrorContinuation);
        }, errorContinuation);
      }
      else {
        continuation(loopResults.pop());
      }
    }

    loopContinuation();
  }

  this.evaluate(node.left, function leftContinuation() {
    self.evaluate(node.right, rightContinuation, errorContinuation)
  }, function forInStatementErrorContinuation(errorType, value) {
    if ( errorType === "Error" && (value instanceof ReferenceError) ) {
      this.setValue(node.left, void 0, rightContinuation, errorContinuation);
    }
    else {
      errorContinuation.apply(null, arguments);
    }
  });
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.ReturnStatement = function (node, continuation, errorContinuation) {
  if ( node.argument ) {
    this.evaluate(node.argument, function (result) {
      errorContinuation(node.type, result);
    }, errorContinuation);
  }
  else {
    errorContinuation(node.type);
  }
};
/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.ThrowStatement = function (node, continuation, errorContinuation) {
  this.evaluate(node.argument, function (argument) {
    errorContinuation(node.type, argument);
  }, errorContinuation);
};
/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.LogicalExpression = function (node, continuation, errorContinuation) {
  var self = this;
  this.evaluate(node.left, function (left) {
    if ( !left && node.operator === "&&" ) {
      continuation(left);
    }
    else if ( left && node.operator === "||" ) {
      continuation(left);
    }
    else {
      self.evaluate(node.right, function(right) {
        if ( node.operator === "&&" ) {
          continuation(left && right);
        } else if ( node.operator === "||" ) {
          continuation(left || right)
        } else {
          errorContinuation(new SyntaxError("Incorrect logical operator"));
        }
      }, errorContinuation);
    }
  }, errorContinuation);
};
/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.BinaryExpression = function (node, continuation, errorContinuation) {
  var self = this;
  this.evaluate(node.left, function (left) {
    self.evaluate(node.right, function (right) {
      var value;
      switch ( node.operator ) {
        case "+":
          value = left + right;
          break;
        case "-":
          value = left - right;
          break;
        case "===":
          value = left === right;
          break;
        case "==":
          value = left == right;
          break;
        case "!==":
          value = left !== right;
          break;
        case "!=":
          value = left != right;
          break;
        case "<":
          value = left < right;
          break;
        case "<=":
          value = left <= right;
          break;
        case ">":
          value = left > right;
          break;
        case ">=":
          value = left >= right;
          break;
        case "*":
          value = left * right;
          break;
        case "/":
          value = left / right;
          break;
        case "instanceof":
          value = left instanceof right;
          break;
        case "in":
          value = left in right;
          break;
        case "^":
          value = left ^ right;
          break;
        case "<<":
          value = left << right;
          break;
        case ">>":
          value = left >> right;
          break;
        case ">>>":
          value = left >>> right;
          break;
        case "%":
          value = left % right;
          break;
        case "&":
          value = left & right;
          break;
        case "|":
          value = left | right;
          break;
        default:
          errorContinuation("Error", new Error(node.type + " not implemented " + node.operator));
      }
      continuation(value);
    }, errorContinuation);
  }, errorContinuation);
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.AssignmentExpression = function (node, continuation, errorContinuation) {
  "use strict mode";
  var self = this;
  this.evaluate(node.right, function (right) {
    self.evaluate(node.left, function (left) {
      switch ( node.operator ) {
        case "=":
          left = right;
          break;
        case "+=":
          left += right;
          break;
        case "-=":
          left -= right;
          break;
        case "*=":
          left *= right;
          break;
        case "/=":
          left /= right;
          break;
        case "%=":
          left %= right;
          break;
        case "<<=":
          left <<= right;
          break;
        case ">>=":
          left >>= right;
          break;
        case ">>>=":
          left >>>= right;
          break;
        case "&=":
          left &= right;
          break;
        case "|=":
          left |= right;
          break;
        case "^=":
          left ^= right;
          break;
        default:
          errorContinuation("Error", new Error("Invalid operator"))    //TODO: use error creator, with stacktrace
      }
      self.setValue(node.left, left, continuation, errorContinuation);
    }, errorContinuation);
  }, errorContinuation);
};
/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.UpdateExpression = function (node, continuation, errorContinuation) {
  var self = this;
  this.evaluate(node.argument, function (argument) {
    var value = argument;
    if ( node.operator == "++" ) {
      value++;
    }
    else if ( node.operator == "--" ) {
      value--
    }
    else {
      errorContinuation("Error", "Unimplemented update operator" + node.operator);
    }
    self.setValue(node.argument, value, function (value) {
      continuation(( node.prefix ) ? value : argument);
    }, errorContinuation);
  });
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.UnaryExpression = function (node, continuation, errorContinuation) {
  if ( node.operator === "delete" ) {
    if ( node.argument.type === "MemberExpression" ) {
      this.evaluate(node.argument, function (value, object, propertyName) {
        continuation(delete object[propertyName]);
      }, errorContinuation)
    }
    else {
      errorContinuation("error", "delete on " + node.argument.type + ", is not implemented yet");
    }
  }
  else if ( node.operator === "typeof" && node.argument.type === "Identifier" && this.scope.get(node.argument.name) === void 0 ) {
    continuation("undefined");
  }
  else {
    this.evaluate(node.argument, function (argument) {
      switch ( node.operator ) {
        case "-":
          continuation(-argument);
          break;
        case "~":
          continuation(~argument);
          break;
        case "!":
          continuation(!argument);
          break;
        case "typeof":
          continuation(typeof argument);
          break;
        default:
          errorContinuation("error", node.operator + " on " + node.argument.type + " is not implemented yet");
      }

    }, errorContinuation);
  }
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.Identifier = function (node, continuation, errorContinuation) {
  if ( !this.scope.has(node.name) ) {
    var value = this.scope.get(node.name);
    this.resolveValue(value, continuation, errorContinuation); // Since the property might be a proxy promise, pass on the resolveValue method
  }
  else {
    errorContinuation("ReferenceError", new ReferenceError("Requested variable not found in current scope!"));
  }
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.MemberExpression = function (node, continuation, errorContinuation) {
  var self = this;
  this.evaluate(node.object, function (object) {
    var propertyNode = node.property;
    if ( propertyNode.type === "Identifier" && !node.computed ) {
      self.resolveValue(object[propertyNode.name], function(value){
        continuation(value, object, propertyNode.name);
      }, errorContinuation); // Since the property might be a proxy promise, pass on the resolveValue method
    }
    else {
      self.evaluate(propertyNode, function (propertyName) {
        continuation(object[propertyName], object, propertyName);
      }, errorContinuation);
    }
  }, errorContinuation);
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.ThisExpression = function (node, continuation, errorContinuation) {
  continuation(this.scope.this);
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.Literal = function (node, continuation, errorContinuation) {
  continuation(node.value);
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.ObjectExpression = function (node, continuation, errorContinuation) {
  var i = 0;
  var self = this;
  var objectProperties = Object.create(null);
  (function evaluateNextProperty() {
    // if there are nodes to process
    if ( i < node.properties.length ) {
      var property = node.properties[i++];// evaluate first node while removing it from the remaining nodes array
      var key  = property.key.name, kind = property.kind;
      self.evaluate(property.value, function (value) {
        if ( ["get", "set"].indexOf(kind) >= 0 ) {
          objectProperties[key] = objectProperties[key] || {};
          // defaults
          objectProperties[key].enumerable = true;
          objectProperties[key].configurable = true;
          objectProperties[key][kind] = value;
        }
        else {
          objectProperties[key] = {
            value       : value,
            configurable: true,
            writable    : true,
            enumerable  : true
          };
        }
        // evaluate next node, passing the remaining nodes
        evaluateNextProperty();
      },
      errorContinuation);
    }
    // If there are no more nodes to process, then we may proceed with the continuation passing the results
    else {
      var object = Object.create(Object.prototype, objectProperties);
      continuation.call(self, object);
    }
  }).call(this); // call with the nodes array
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @constructor
 */
Interpreter.prototype.ArrayExpression = function (node, continuation, errorContinuation) {
  // TODO: handle non enumerable undefined elements  [,,,]
  this.evaluateArray(node.elements, continuation, errorContinuation);
};

/**
 *
 * @param node
 * @param value
 * @param continuation
 * @param errorContinuation
 */
Interpreter.prototype.setValue = function (node, value, continuation, errorContinuation) {
  if ( node.type === "Identifier" ) {
    if ( !this.passive ) {
      if ( !this.scope.parent ) {

      }
      this.scope.set(node.name, value);
    }
    continuation(value);
  }
  else if ( node.type === "MemberExpression" ) {
    var propertyName = node.property.name;
    this.evaluate(node.object, function (object) {
      if ( !this.passive ) {
        object[propertyName] = value;
      }
      continuation(value);
    }, errorContinuation);

  }
};

/**
 *
 * @param executionStackPoints
 */
Interpreter.prototype.continue = function (executionStackPoints) {
  var stack = this.vm.stack.reverse();
  for ( var i = 0; i < stack.length; i++ ) {
    var stackFrame = stack[i];
    var executionPoint = executionStackPoints[i];
    var ast = this.vm.getFunctionAst(stackFrame.caller);
    this.jumpTo(ast, executionStackPoints);

  }
};

/**
 *
 * @param node
 * @returns {boolean}
 */
Interpreter.prototype.isPassive = function (node) {
  if ( this.loc && node.loc && this.loc.col == node.loc.col && this.loc.line == node.loc.line ) {
    return true;
  }
};

/**
 *
 * @param node
 * @returns {V}
 */
Interpreter.prototype.getNodeParseState = function (node) {
  var state = this.nodeStates.get(node);
  if ( !state ) {
    state = {};
    this.nodeStates.set(node, state);
  }
  return state;
};

/**
 *
 * @param node
 * @param continuation
 * @param errorContinuation
 * @param args
 * @returns {*}
 */
Interpreter.prototype.intercept = function (node, continuation, errorContinuation) {
  return false;
};

/**
 *
 * @param node
 * @returns {boolean}
 */
Interpreter.prototype.shouldStop = function (node) {
  return false;
};

/**
 *
 * @param ast
 * @param executionStackPoints
 */
Interpreter.prototype.jumpTo = function (ast, executionStackPoints) {

};

Interpreter.prototype.resolveValue = function(value, continuation, errorContinuation) {
  if (typeof value === "object" && PromiseInterceptor.isProxyPromise(value)) { // If the value being referenced is a promise, then process differently
      var promise = PromiseInterceptor.getPromise(value);
      promise.then(function(value){
        continuation(value);
      }, errorContinuation.bind(this)); // when the promise is fullfilled
    } else {
      continuation.call(this, value);
    }
}

module.exports = Interpreter;
