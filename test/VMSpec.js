var sinon = require('sinon');
var chai = require('chai');
var expect = chai.expect;
var VM = require('../VM');

describe("VM tests", function () {
  describe("Should create a basic, sandboxed environment", function () {

    it('All global variable accesses, should access the values on the global object provided', function () {
      var global = {value:1};
      var vm = new VM(global);
      var value = vm.eval("value");
      expect(value).to.equal(global.value);
    });

    it('All globals declarations and assignments, should not modify the global object provided', function () {
      var global = {};
      var vm = new VM(global);
      var value = vm.eval("value = 1");
      expect(vm.global.value).to.equal(value);
      expect(global.value).to.be.undefined;
    });

    it('It should intercept the calls to "eval"', function () {
      var global = {value:{}};
      var vm = new VM(global);
      var evalSpy = sinon.spy();
      vm.global.eval = evalSpy;
      var value = vm.eval("eval('global')");
      expect(evalSpy.called).to.be.true;
    });

    it('It should be able to get the scope of a closure', function () {
      // func.capture(function(){ return eval(this)})
      var vm = new VM({});
      vm.eval("function a() { var x = 1234; return function(){ return x; } }");
      var closure  = vm.eval("a();");
      var scope = vm.getScope(closure);
      var environment = scope.getEnvironment();
      expect(environment.x).to.equal(closure());
    });

    it('It should be able to set the scope of a closure', function () {
      // func.capture(function(){ return eval(this)})
      var vm = new VM({});
      vm.eval("function a() { var x = 1234; return function(){ return x; } }");
      var closure  = vm.eval("a();");
      var scope = vm.getScope(closure);
      scope.setEnvironment({x:25});
      expect(25).to.equal(closure());
    });


  });

});


