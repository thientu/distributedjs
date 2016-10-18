#!/usr/local/bin/node
var express = require('express');
var browserify = require('browserify-middleware');
var jsdump = require('jsDump');
var app = express();
var bodyParser = require('body-parser');
var VM = require("../../VM");
var Compiler = require("../../Compiler");
var isPromise = require('is-promise');

app.use('/scripts', browserify(__dirname + '/scripts'));
app.use(express.static('./'));
app.use(bodyParser.json());       // to support JSON-encoded bodies

var vm = new VM({});
var compiler = new Compiler();

function replacer(key, value) {
  if ( typeof value === "function" ) {
    return value.toString();
  }
  else if ( key === "result" ) {
    if ( typeof value === "undefined" ) {
      return "{{{undefined}}}"
    }
    else if ( typeof value === "number" && value.toString() === "NaN" ) {
      return "{{{NaN}}}";
    }
  }
  return value;
}

app.post('/', function (req, res) {
  var code = req.body.code;
  var result = '', error = '', compiled = '';
  try {
    compiled = compiler.compile(code);
    result = vm.eval(code);
  } catch ( err ) {
    error = err;
  }

  function sendResult(result) {
    console.log(compiled);
    res.send(JSON.stringify({
      compiled: compiled,
      result  : result,
      error   : null
    }, replacer));
  }

  function sendError(error) {
    res.send(JSON.stringify({
      compiled: compiled,
      result  : null,
      error   : error.message + '\n' + error.stack
    }, replacer));
  }

  // If it is a promise, wait for the result/error
  if ( isPromise(result) ) {
    result.then(sendResult, sendError);
  }
  // Otherwise, send the result/error directly
  else {
    if ( error ) {
      sendError(error);
    }
    else {
      sendResult(result);
    }
  }
});

var server = app.listen(process.env.PORT, function () {
  var host = server.address().address;
  var port = server.address().port;

  //console.log('Example app listening at http://%s:%s', host, port);
});


// Starting local Repl (for same object)
var repl = require("repl");
repl.start({
	prompt: "distributedjs> ",
	input: process.stdin,
	output: process.stdout,
	eval: function(cmd, context, filename, callback) {
		 (vm.eval(cmd)).then(function(result){
		   callback(null, result);
		 });
		 
	}
});