var escope = require("escope");
var recast = require("recast");
var types = recast.types;
var builders = recast.types.builders;

/**
 * Compiler scope/stack instrumentation constructor
 * @param code
 * @constructor
 */
function Compiler(code) {
  this.ast = null;
  this.code = "";
  this.output = "";
  if ( code ) {
    this.compile(code);
  }
}

/**
 * Instruments the code, so we can capture the scopes and the call stack of every method.
 * @param code
 * @returns {string}
 */
Compiler.prototype.compile = function (code) {
  this.code = code;
  this.ast = recast.parse(code);
  this.scopes = escope.analyze(this.ast).scopes;
  this.scope = this.scopes[0];
  this.scope.data = { node: this.scope.block, children: [] };
  // TODO EVENTUALLY: Support es6 lexical scoping;
  // Getting program body
  var body = this.ast.program.body;
  // Mapping global variable/function declarations to global object
  var globalScope = this.scopes[0];
  var expressions = [];
  var functionDeclarations = [];
  // Going through each one of the variable declarations detected by the scope analysis on the global scope
  this.processedIdentifiers = [];
  for ( var i = 0; i < globalScope.variables.length; i++ ) {
    var variable = globalScope.variables[i];
    // Retrieving the name of the variable identifier
    var name = variable.identifiers[0].name;
    var def = variable.defs[0];
    // Retrieving value of the variable
    var value;
    if ( def.node.type == "VariableDeclarator" ) {
      value = def.node.init || builders.identifier("undefined");
      // Removing declaration
      var declarations = def.parent.declarations;
      declarations.splice(declarations.indexOf(def.node), 1);
      // Keeping track of identifiers we have processed
      var identifier = def.name;
      this.processedIdentifiers.push(identifier);
    }
    else if ( def.node.type == "FunctionDeclaration" ) {
      value = builders.identifier(name);
      functionDeclarations.push(name);
    }
    // Building a new assignment expression, in the form of "global.name", for each declarations
    var expression = builders.assignmentExpression(
      "=",
      builders.memberExpression(
        builders.identifier("global"),
        builders.identifier(name)
      ),
      value
    );
    // Storing the expression in an array, to include in sequence expression later on
    expressions.push(expression);
  }
  // If there are any expressions add them to the expression statement
  var expressionStatement;
  if ( expressions.length ) {
    expressionStatement = builders.expressionStatement(
      builders.sequenceExpression(
        expressions
      )
    );
    // Removing empty declarations
    for ( var j = 0; j < body.length; j++ ) {
      if ( body[j].type == "VariableDeclaration" && body[j].declarations.length == 0 ) {
        body.splice(j--, 1);// Remove from array, and move the pointer one element
      }
    }
  }

  //TODO: Make sure we capture the arguments array
  // Capturing the environment and call stack
  this.captureCalls(globalScope);

  // Add the expression statement at the beginning of the body;
  if ( expressionStatement ) {
    body.unshift(expressionStatement);
  }

  // Breaking down object chains, to maintain all partial execution states of the function
  //TODO: Break chain calls down to simpler chunks, to cache the return values. This allows to maintain the execution
  //TODO: state within the closure, even after the execution has been interrupted by remote object access interception
  //TODO:  i.e.:  return [1,2,3,remoteObj].pop().remoteProperty(localVar) -->
  //TODO: _1 = [1,2,3,remoteObj]; _2 = _1.pop(); _3 = _2.remoteProperty(); return _3;
  // Instrumenting try/catch/Finalize
  //TODO: Replace try/catch with Try/Catch/Finalize(tryCallback, catchCallback, finalizeCallback), to let all other
  //TODO: errors bubble, while still capturing the errors that are relevant to the VM/Interpreter
  //TODO: while creating and formatting an error stack, that does not leak the parent program state.
  //TODO: Any variables declared inside the try/catch/finalize, should be moved to be declared outside the callbacks

  // Returning the resulting code
  this.output = recast.prettyPrint(this.ast).code;
  return this.output;
};

/**
 * Capturing the function environment, for scopes that have closures (eval, variable/function declarations, and "this")
 * global.capture(arguments, this, function(){ eval (arguments[0]) }, {vars:vars}, this)
 * @param scope
 */
Compiler.prototype.captureCalls = function (scope) {
  // Storing relevant scope data for later retrieval
  scope.data = { node: scope.block, children: [] };
  this.openFunction(scope); // Instrumenting the opening of a function
  this.replaceGlobals(scope); // replacing global variable access
  // processing children scopes
  for ( var j = 0; j < scope.childScopes.length; j++ ) {
    var childScope = scope.childScopes[j];
    this.captureCalls(childScope);
    this.linkClosures(childScope);
  }
  // Instrumenting the end of a function
  this.closeFunction(scope);
}

/**
 * Instruments the beginning of a function, by capturing the call stack, scope, and execution context
 * @param scope
 */
Compiler.prototype.openFunction = function (scope) {
  // Appending capture ast into body
  if ( scope.type !== "global" && scope.type !== "function-expression-name" ) {
    var body = scope.block.body.body;
    // capturing scope environment variables
    var keyValues = [];
    for ( var i = 0; i < scope.variables.length; i++ ) {
      var name = scope.variables[i].name;
      // If there are no references to this variable, then skip it (particularly true for the arguments object)
      if ( !scope.variables[i].references.length ) {
        continue;
      }
      keyValues.push(name + ":" + name);
    }
    // Adding a name to the function if it is anonymous
    if ( !scope.block.id ) {
      scope.block.id = builders.identifier("anonymous");
    }
    // Creating ast for the capture function
    var captureAst = recast.parse("capture(" + (scope.block.id.name) + ",function(){ return" +
                                  " eval(arguments[0])},{" + keyValues.join(',') + "},this);");
    // Adding the capture call at the beginning of the function body
    body.unshift(captureAst.program.body[0]);
  }
}

/**
 * Instrumenting the end of the function, but adding a close function as the last executed piece of code
 * @param scope
 */
Compiler.prototype.closeFunction = function (scope) {
  // Closing function
  if ( scope.type !== "global" && scope.type !== "function-expression-name" ) {
    // IF j is 0, then it means there was no return statement, so we added manually
    var body = scope.block.body.body;
    if ( !this.wrapReturnStatements(body) ) {
      var call = builders.expressionStatement(
        builders.callExpression(
          builders.identifier("close"),
          []
        )
      )
      body.push(call);
    }
  }
}

/**
 * Wraps all return statements in close functions
 * @param ast
 * @returns {boolean}
 */
Compiler.prototype.wrapReturnStatements = function (ast) {
  var found = false;
  var keys = Object.getOwnPropertyNames(ast);
  for ( var i = 0; i < keys.length; i++ ) {
    var key = keys[i];
    if ( typeof ast[key] === "object" && ast[key] !== null && key !== "original" && key !== "loc" && key !== "errors" && key.indexOf("weakMap") < 0 ) {
      if ( ast[key].type === "ReturnStatement" ) {
        ast[key].argument = builders.callExpression(
          builders.identifier("close"),
          [ast[key].argument]
        );
        found = true;
      }
      // else if it is not a function, keep traversing
      else if ( !ast[key].type || ast[key].type.indexOf("Function") === -1 ) {
        if ( this.wrapReturnStatements(ast[key]) ) {
          found = true;
        }
      }
    }
  }
  return found;
}

/**
 * Wraps all closures to the current scope via a link() call around them
 * @param scope
 */
Compiler.prototype.linkClosures = function (scope) {
  var parentData = scope.upper.data;
  parentData.children.push(scope.data);
  // If the scope has children scopes, then we want to capture them
  if ( scope.block.type == "FunctionExpression" ) {
    var wrapped = builders.callExpression(
      builders.identifier("link"),
      [scope.block]
    );
    this.wrapFunctionAst(scope.upper.block, scope.block, scope.upper.block.type, wrapped);
  }
  else if ( scope.block.type === "FunctionDeclaration" ) {
    var linkAst = builders.expressionStatement(
      builders.callExpression(
        builders.identifier("link"),
        [builders.identifier(scope.block.id.name)]
      )
    );
    // Finding parent scope block body, and inserting immediately after
    var body = ( scope.upper.block.type === "Program" ) ? scope.upper.block.body : scope.upper.block.body.body;
    for ( var i = 0; i < body.length; i++ ) {
      if ( body[i] === scope.block ) {  // if found
        body.splice(i + 1, 0, linkAst);  // insert just after
        break;
      }
    }
  }
}

/**
 * Wraps a closure, on a "link" call, as to link it to the current scope
 * @param ast
 * @param functionAst
 * @param type
 * @param wrappedFunctionAst
 * @returns {boolean}
 */
Compiler.prototype.wrapFunctionAst = function (ast, functionAst, type, wrappedFunctionAst) {
  var type = ast.type;
  var keys = Object.getOwnPropertyNames(ast);
  for ( var i = 0; i < keys.length; i++ ) {
    var key = keys[i];
    if ( typeof ast[key] === "object" && ast[key] !== null && key !== "original" && key !== "loc" && key !== "errors" && key.indexOf("weakMap") < 0 ) {
      if ( ast[key] === functionAst ) {
        if ( type === "BlockStatement" || type === "FunctionDeclaration" || type === "FunctionExpression" || type === "Program" ) {
          ast[key] = { type: "ExpressionStatement", expression: wrappedFunctionAst };
        }
        else {
          ast[key] = wrappedFunctionAst
        }
        return true;
      }
    }
  }
  // IF not found on the first go, iterate in the next level
  for ( var i = 0; i < keys.length; i++ ) {
    var key = keys[i];
    if ( typeof ast[key] === "object" && ast[key] !== null && key !== "original" && key !== "loc" && key !== "errors" && key.indexOf("weakMap") < 0 ) {
      if ( this.wrapFunctionAst(ast[key], functionAst, ast[key].type || type, wrappedFunctionAst) ) {
        return true
      }
    }
  }
  // If it gets here, then it was not found anywhere in from this node onwards
  return false;
}
/**
 *
 * @param containerAst
 * @param ast
 * @param wrap
 * @returns {boolean}
 */
Compiler.prototype.wrapAst = function (containerAst, ast, wrap, _path) {
  var path = _path ? _path : [];
  path.push(containerAst);

  var keys = Object.getOwnPropertyNames(containerAst);
  for ( var i = 0; i < keys.length; i++ ) {
    var key = keys[i];
    if ( typeof containerAst[key] === "object" && containerAst[key] !== null && key !== "original" && key !== "loc" && key !== "errors" && key.indexOf("weakMap") < 0 ) {
      if ( containerAst[key] === ast ) {
        containerAst[key] = wrap(path);
        return true;
      }
    }
  }
  for ( var i = 0; i < keys.length; i++ ) { // IF not found on the first go, iterate in the next level
    var key = keys[i];
    if ( typeof containerAst[key] === "object" && containerAst[key] !== null && key !== "original" && key !== "loc" && key !== "errors" && key.indexOf("weakMap") < 0 ) {
      if ( this.wrapAst(containerAst[key], ast, wrap, path) ) {
        return true
      }
    }
  }
  return false;    // If it gets here, then it was not found anywhere in from this node onwards
}

/**
 *
 * @param scope
 */
Compiler.prototype.replaceGlobals = function (scope) {
  // TODO: Use a robust node traversal library and transformation library to look at the code
  // Renaming global accesses to refer to the global object
  for ( var k = 0; k < scope.through.length; k++ ) {
    var through = scope.through[k];
    if ( !through.resolved ) { // If it has not been resolved, it is a global
      var identifier = through.identifier;
      if ( identifier.type == "Identifier" && identifier.name !== "global" && identifier.name !== "undefined" && this.processedIdentifiers.indexOf(identifier) === -1 ) {   // If the identifiers is not "global" or "undefined", and it has not been processed before (within variable declarations)
        this.wrapAst(scope.block, identifier, function (path) {
          var parentNode = path[path.length - 1];
          if ( parentNode && parentNode.type !== "MemberExpression" ) { // If it is not already a member expression
            return builders.memberExpression(builders.identifier("global"), identifier);
          }
          else {
            return identifier;
          }
        });
        // prepending global (the easy way)
        //identifier.name = "global." + identifier.name;
      }
    }
  }
}

/**
 * Return the source code of a function's ast
* @param ast
* @returns {*|{value}}
*/
Compiler.prototype.getFunctionSourceCode = function (ast) {
  return recast.prettyPrint(
    builders.program(
      [ast]
    )
  ).code;
}


/**
 * Exporting the Compiler!
 * @type {Compiler}
 */
module.exports = Compiler;
