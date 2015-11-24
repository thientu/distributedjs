/**
 * Based on https://github.com/aaditmshah/codemirror-repl
 */

var CodeMirrorREPL = require("./codemirror-repl");
var jsdump = require("jsDump");

function isCode(code) {
  try {
    Function("return " + code);
    return true;
  } catch ( error ) {
    return false;
  }
}

function formatResult(result) {
  if ( result === null ) {
    var type = "Null";
  }
  if ( result === void 0 ) {
    var type = "Undefined";
  }
  else {
    var type = Object.prototype.toString.call(result).slice(8, -1);
  }
  switch ( type ) {
    case "Undefined":
      return "undefined";
    case "Null":
      return "null";
    case "Array":
    case "Object":
      return jsdump.parse(result);
    case "Number":
    case "Boolean":
    case "Function":
      return result.toString();
    case "String":
      if ( specialRegex.test(result) ) {
        return specialRegex.exec(result)[1];
      }
      else if ( !isCode(result) || result == "" ) {
        return '"' + result.replace('\\', '\\\\').replace('\0', '\\0').replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t').replace('\v', '\\v').replace('"', '\\"') + '"';
      }
    default:
      return result;
  }
}
var specialRegex = /^{{{(\w+)}}}$/
var functionRegex = /^function\s*([\w$]*)\s*\(([\w\s,$]*)\)\s*\{([\w\W\s\S]*)\}$/
var http = new XMLHttpRequest();
function evaluate(code) {
  var promise = new Promise(function (resolve, reject) {
    http.onreadystatechange = function () {
      // do a thing, possibly async, then…
      if ( http.readyState == 4 && http.status == 200 ) {
        if ( http.responseText ) {
          var response = JSON.parse(http.responseText, function (k, v) {
            if ( functionRegex.test(v) ) {
              return (new Function("return (" + v + ")"))();
            }
            return v;
          });
          if ( response.error ) {
            reject(response.error);
          }
          else {
            console.log(formatResult(response.compiled || ""));
            resolve(formatResult(response.result));
          }
        }
      }
    }
  });
  http.open("POST", location.href);
  http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
  http.send(JSON.stringify({ code: code }));
  return promise;
}

window.addEventListener("DOMContentLoaded", function () {
  var repl = new CodeMirrorREPL("repl");
  repl.eval = evaluate;
  repl.print("/* DistributedJS REPL  */");
}, false);
