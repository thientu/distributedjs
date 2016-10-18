var chai = require('chai');
var expect = chai.expect;
var VM = require('../VM');
var Interpreter = require('../Interpreter');
var PromiseInterceptor = require('../PromiseInterceptor');

xdescribe("Interpreter tests", function () {

  it('All global variable accesses, should access the values on the global object provided', function (done) {
    var global = {value:1};
    var vm = new VM(global);
    vm.compiler.compile("value");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(global.value);
      done();
    });
  });

  it('Should be able to return a from a variable value', function (done) {
    var global = {value:1};
    var vm = new VM(global);
    vm.compiler.compile("var a = value; a");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(1);
      done();
    });
  });

  it('should be able to access properties on objects', function (done) {
    var global = {value:{a:1}};
    var vm = new VM(global);
    vm.compiler.compile("value.a");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(1);
      done();
    });
  });
  
  it('should be able to access properties on nested objects', function (done) {
    var global = {value:{a:{b:1}}};
    var vm = new VM(global);
    vm.compiler.compile("value.a.b");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(1);
      done();
    });
  });
  
  it('should be able to return the last value of an expression list', function (done) {
    var global = {value:{a:{b:1}}};
    var vm = new VM(global);
    vm.compiler.compile("value;value.a;value.a.b;value");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(global.value);
      done();
    });
  });
  
  it('should be able to return the last value of an expression list separated by coma', function (done) {
    var global = {value:{a:{b:1}}};
    var vm = new VM(global);
    vm.compiler.compile("value.a,value.a.b,value");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(global.value);
      done();
    });
  });
  
  it('should be able to set a global value', function (done) {
    var global = {};
    var vm = new VM(global);
    vm.compiler.compile("a = 1; a");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(1);
      done();
    });
  });
  
  it('should be able to increment a value', function (done) {
    var global = {a:1};
    var vm = new VM(global);
    vm.compiler.compile("a++; a");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(2);
      done();
    });
  });
  
  it('should be able to decrement a value', function (done) {
    var global = {a:1};
    var vm = new VM(global);
    vm.compiler.compile("a--; a");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(0);
      done();
    });
  });
  
  it('should be able to create an object', function (done) {
    var global = {};
    var vm = new VM(global);
    vm.compiler.compile("a={b:1,c:2};a");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value.b).to.equal(1);
      expect(value.c).to.equal(2);
      done();
    });
  });
  
  it('should be able to do a while loop', function (done) {
    var global = {a:10};
    var vm = new VM(global);
    vm.compiler.compile("i = 0; while (i<a) { i++; i }");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      //expect(value).to.equal(10);
      done();
    });
  });
  
  it('should be able to do a for loop', function (done) {
    var global = {a:10};
    var vm = new VM(global);
    vm.compiler.compile("for ( i = 0; i<a; i++ ) { i }");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      //expect(value).to.equal(10);
      done();
    });
  });
  
  it('should be able to do comparison operations', function (done) {
    var global = {a:10};
    var vm = new VM(global);
    vm.compiler.compile("a > 0");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(true);
      done();
    });
  });
  
  it('should be able to do complex operations', function (done) {
    var global = {a:10};
    var vm = new VM(global);
    vm.compiler.compile("a > 0 && false");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(false);
      done();
    });
  });
  
  
  it('should be able to do an if else construct', function (done) {
    var global = {a:10};
    var vm = new VM(global);
    vm.compiler.compile("if ( a > 0 ) {  b = true } else { b = false  }; b");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(true);
      done();
    });
  });
  
  it('should be able to do a method call', function (done) {
    var global = {f:{a:function(x){ return this.b+x },b:5}};
    var vm = new VM(global);
    vm.compiler.compile("global.f.a(5)");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(10);
      done();
    });
  });
  
  it('should be able to handle proxy promises', function (done) {
    var global = {p:new PromiseInterceptor(function(accept,reject){
      process.nextTick(function(){
        accept("WORLD");
      });
    })};
    var vm = new VM(global);
    vm.compiler.compile("'HELLO ' + p");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal("HELLO WORLD");
      done();
    });
  });
  
  
});

describe("development describe", function() {
  it('should be able to handle proxy promises - 2', function (done) {
    var global = {a:[1,2,3,4],p:new PromiseInterceptor(function(accept,reject){
      process.nextTick(function(){
        accept(3);
      });
    })};
    var vm = new VM(global);
    vm.compiler.compile("x=1;\n y=2;\nz=x + y, a[p];\n");
    var ast = vm.compiler.ast;
    var valuePromise = vm.interpreter.eval(ast.program);
    valuePromise.then(function(value){
      expect(value).to.equal(4);
      done();
    });
  });
});