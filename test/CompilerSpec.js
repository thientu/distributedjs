var sinon = require('sinon');
var chai = require('chai');
var expect = chai.expect;
var recast = require('recast');
var Compiler = require('../Compiler');

function formatCode(code) {
  return removeWhiteSpace(recast.prettyPrint(recast.parse(code)).code)
}
function removeWhiteSpace(str) {
  return str.replace( /[\s\n\r]+/g, ' ' )
}

describe("Compiler Environment setup", function () {

  it('It should rewrite global variable declarations to act on the global object', function () {
    // var a = 1; --> global.a = 1;
    var compiler = new Compiler();
    var code = formatCode(compiler.compile("var a = {}, b; var c, d = 1; f"));
    expect(code).to.contain(formatCode("global.a = {}, global.b = undefined, global.c = undefined," +
                                                        " global.d = 1;"));
  });

  it('It should rewrite global function declarations to act on the global object', function () {
    // function a() {} --> global.a = function a(){}
    var compiler = new Compiler();
    var code = formatCode(compiler.compile("function f(){}"));
    var content = formatCode("global.f = f;");
    expect(code).to.contain(content);
  });

  it('It should rewrite global accesses to point to the global object', function () {
    // Object.create() -->  global.Object.create()
    var compiler = new Compiler();
    var code2 = formatCode(compiler.compile("var x = y;"));
    var content2 = formatCode("global.x = global.y");
    expect(code2).to.contain(content2);
    var compiler = new Compiler();
    var code = formatCode(compiler.compile("Object.create()"));
    var content = formatCode("global.Object.create()");
    expect(code).to.contain(content);
    var code1 = formatCode(compiler.compile("function hello(){ return Array.prototype = hello }"));
    var content1 = ("global.Array.prototype = global.hello");
    expect(code1).to.contain(content1);
   
  });

  it('It should capture an eval function for functions that create closures', function () {
    // function() { var a; return function(){ return a } } -->
    // function() { global.capture(function(){ return eval(arguments[0])}, {a:a}); var a; return function(){ return a } }
    var compiler = new Compiler();
    var code = formatCode(compiler.compile("function x() { var a; return function(){ return a } }"));
    var content = formatCode("capture(x, function(){ return eval(arguments[0])}, {a:a}, this)");
    expect(code).to.contain(content);
  });

  it('It should intercept native calls to "eval"', function () {
    // func.capture(function(){ return eval(this)})
    var compiler = new Compiler();
    var code = formatCode(compiler.compile("function x() { eval('global.a') }"));
    var content = formatCode('global.eval("global.a")');
    expect(code).to.contain(content);
  });

  it('It should link unnamed closures', function () {
    // function () { return function () {}; }  -->
    // function () { return link(function() {}) }
    var compiler = new Compiler();
    var code = formatCode(compiler.compile("function x() { return function(){}; }"));
    var content = "link(function";
    expect(code).to.contain(content);
  });

  it('It should link global function declarations', function () {
    // function x() {} ->> function x(){} link(x);
    var compiler = new Compiler();
    var code = formatCode(compiler.compile("function x() {  }"));
    var content = formatCode("link(x)");
    expect(code).to.contain(content);
  });

  it('It should link global function expressions', function () {
    // var x = function () {} ->> function (){} link(x);
    var compiler = new Compiler();
    var code = formatCode(compiler.compile("var x = function () {  }"));
    var content = "x = link(function";
    expect(code).to.contain(content);
  });
});




