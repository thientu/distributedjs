var sinon = require('sinon');
var chai = require('chai');
var expect = chai.expect;
//var Reflect = require('harmony-reflect');
var PromiseInterceptor = require('../PromiseInterceptor');

describe("Promise Interceptor", function () {
  

  it('It should intercept valueOf calls', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(function (){
          resolve(123456);
      });
    });
    var promise = PromiseInterceptor.getPromise(proxyPromise);
    PromiseInterceptor.capture(
      function evaluate() {
        var sum = proxyPromise + 1;
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        expect(promise).to.equal(interceptedPromise);
        interceptedPromise.then(function(value){
          expect(value).to.equal(123456);
          done();
        });
      }
    );
  });
  
  it('It should intercept toString calls', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(function (){
          resolve("Hello");
      });
    });
    var promise = PromiseInterceptor.getPromise(proxyPromise);
    PromiseInterceptor.capture(
      function evaluate() {
       var string = proxyPromise + " world ";
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        expect(promise).to.equal(interceptedPromise);
        interceptedPromise.then(function(value){
          expect(value).to.equal("Hello");
          done();
        });
      }
    );
  });

  it('It should intercept property access calls', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
       process.nextTick(resolve);
    });
    var promise = PromiseInterceptor.getPromise(proxyPromise);
    PromiseInterceptor.capture(
      function evaluate() {
        var value = proxyPromise.property
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        expect(promise).to.equal(interceptedPromise);
        interceptedPromise.then(function(value){
          done();
        });
      }
    );
  });

  it('It should intercept prototype of calls', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    var promise = PromiseInterceptor.getPromise(proxyPromise);
    PromiseInterceptor.capture(
      function evaluate() {
       var value = proxyPromise.__proto__;
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        expect(promise).to.equal(interceptedPromise);
        interceptedPromise.then(done);
      }
    );
  });

  it('It should intercept Object.getOwnPropertyDescriptor', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    var promise = PromiseInterceptor.getPromise(proxyPromise);
    PromiseInterceptor.capture(
      function evaluate() {
        Object.getOwnPropertyDescriptor(proxyPromise, 'property');
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        expect(promise).to.equal(interceptedPromise);
        interceptedPromise.then(function(){
          done();
        });
      }
    );
  });


  it('It should intercept getPrototypeOf', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    var promise = PromiseInterceptor.getPromise(proxyPromise);
    PromiseInterceptor.capture(
      function evaluate() {
        Object.getPrototypeOf(proxyPromise);
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        expect(promise).to.equal(interceptedPromise);
        interceptedPromise.then(function(){
          done();
        });
      }
    );
  });

  it('It should intercept defineProperty', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    var promise = PromiseInterceptor.getPromise(proxyPromise);
    PromiseInterceptor.capture(
      function evaluate() {
        Object.defineProperty(proxyPromise,'property', {value:1});
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        expect(promise).to.equal(interceptedPromise);
        interceptedPromise.then(function(){
          done();
        });
      }
    );
  });

  it('It should intercept deleteProperty', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    var promise = PromiseInterceptor.getPromise(proxyPromise);
    PromiseInterceptor.capture(
      function evaluate() {
        delete proxyPromise['property'];
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        expect(promise).to.equal(interceptedPromise);
        interceptedPromise.then(function(){
          done();
        });
      }
    );
  });
  
  it('It should intercept freeze', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        Object.freeze(proxyPromise);
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
  it('It should intercept seal', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        Object.seal(proxyPromise);
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
  it('It should intercept preventExtensions', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        Object.preventExtensions(proxyPromise);
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
  it('It should intercept isFrozen', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        Object.isFrozen(proxyPromise);
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
  it('It should intercept isSealed', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        Object.isSealed(proxyPromise);
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
  it('It should intercept isExtensible', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        Object.isExtensible(proxyPromise);
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
  it('It should intercept has', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        'property' in proxyPromise;
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
  it('It should intercept hasOwn', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        proxyPromise.hasOwnProperty('property');
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
  it('It should intercept get ', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        var value = proxyPromise.property;
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
  it('It should intercept set', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        proxyPromise.property = 1;
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
  it('It should intercept enumerate', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      setTimeout(resolve,1);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        for ( var i in proxyPromise) {}
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
  it('It should intercept keys', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        Object.keys(proxyPromise);
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
  it('It should intercept typeof', function () {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        console.log(typeof proxyPromise);
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          //done = false;
        });
      }
    );
  });
  
  it('It should intercept apply', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        proxyPromise();
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
  it('It should intercept construct', function (done) {
    var proxyPromise = new PromiseInterceptor(function (resolve, reject){
      process.nextTick(resolve);
    });
    PromiseInterceptor.capture(
      function evaluate() {
        new proxyPromise();
      },
      function intercept(interceptedPromise, executionStackPoints) { // This function allows the VM to intercept a proxy wrapped promise.
        interceptedPromise.then(function(){
          if (done) done();
          done = false;
        });
      }
    );
  });
  
});




