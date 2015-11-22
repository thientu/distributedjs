var chai = require('chai');
var expect = chai.expect;
var VM = require('../VM');
var Interpreter = require('../Interpreter');

describe("Interpreter tests", function () {

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

  xit('Should be able to return a from a variable value', function () {
    Interpreter("var a = 1; a");
    expect(1).to.equal(1);
  });

  xit('', function () {
    // func.capture(function(){ return eval(this)})
    expect('').to.be.a('string');
  });
});
