var CodeMirror = require("./CodeMirror");
module.exports = CodeMirrorREPL;

function CodeMirrorREPL(textareaId, options) {
  var textarea = document.getElementById(textareaId);
  options = options || {};
  textarea.value = "";

  var keymap = {
    "Up"            : up,
    "Down"          : down,
    "Delete"        : del,
    "Ctrl-Z"        : undo,
    "Ctrl-R"        : clear,
    "Enter"         : enter,
    "Ctrl-A"        : select,
    "Ctrl-Delete"   : del,
    "Shift-Enter"   : enter,
    "Backspace"     : backspace,
    "Ctrl-Backspace": backspace
  };

  var options = {
    electricChars   : false,
    theme           : options.theme || "eclipse",
    mode            : options.mode || 'javascript',
    smartIndent     : false,
    lineWrapping    : true,
    extraKeys       : keymap,
    onChange        : change,
    onKeyEvent      : keyEvent,
    onCursorActivity: cursorActivity,
    indentUnit      : 4,
    undoDepth       : 1,
    gutter          : true,
    autofocus       : true
  };

  var mirror = CodeMirror.fromTextArea(textarea, options);

  var history = localStorage;//JSON.parse(localStorage.getItem("history") || "[]");
  var buffer = [];
  var repl = this;
  var user = true;
  var text = "";
  var line = 0;
  var ch = 0;
  var n = history.length;
  var shiftPressed = false;
  var prompt = options.prompt || "❯❯";
  var resultPrompt = options.resultPrompt || "❮❮";
  var errorPrompt = options.errorPrompt || "❗";

  repl.print = print;
  repl.setMode = setMode;
  repl.setTheme = setTheme;
  repl.commands = {
    clear       : clear,
    theme       : theme,
    clearHistory: clearHistory
  };

  mirror.setMarker(line, prompt);


  function theme(theme) {
    var prevTheme = mirror.getOption("theme");
    var stylesheet = document.querySelector("link[href*='" + prevTheme + "']");
    stylesheet.href = stylesheet.href.replace(prevTheme, theme);
    setTheme(theme);
  }

  function clear() {
    mirror.setValue("");
    mirror.clearHistory();
    line = 0;
    ch = 0;
    text = "";
    user = true;
  }

  function clearHistory() {
    history.clear();
    n = 0;
  }

  function keyEvent(mirror, e) {
    if ( e.keyCode == 91 || e.keyCode == 16 || e.keyCode == 18 || e.keyCode == 19 ) {
      return true;
    }
    else {
      user = true;
      var cursor = mirror.getCursor();
      if ( cursor.line < line ) {
        mirror.setCursor({ line: line, ch: cursor.ch });
      }
      return false;
    }
  }

  function cursorActivity() {
    if ( !mirror.getSelection() ) {
      var cursor = mirror.getCursor();
      mirror.setCursor({ line: line, ch: cursor.ch });
    }
  }

  function undo() {
    console.log("undo!");
  }

  function up() {
    switch ( n-- ) {
      case 0:
        n = 0;
        return;
      case history.length:
        text = mirror.getLine(line).slice(ch);
    }
    mirror.setLine(line, history["repl-history-"+n]);
  }

  function down() {
    switch ( n++ ) {
      case history.length:
        n--;
        return;
      case history.length - 1:
        mirror.setLine(line, text);
        return;
    }
    mirror.setLine(line, history["repl-history-"+n]);
  }

  function evaluate(code) {
    if ( code.indexOf(":") == 0 ) {
      var parts = code.substr(1).split(" ");
      var command = parts.shift()||'clear';
      if (!repl.commands[command]) {
        return printError("Incorrect REPL command '"+command+"'.");
      }
      repl.commands[command].apply(repl, parts);
      // resetting cursor position
      setTimeout(function () {
        user = false;
        mirror.setCursor({ line: 0, ch: 0 });
        mirror.setCursor({ line: line, ch: ch });
      }, 10);
      return;
    }
    var result;
    try {
      result = repl.eval(code);
      if ( result.then && result.then instanceof Function ) {
        result.then(function (res) {
          printResult(res);
        }).catch(function (err) {
          printError(err);
        });
      }
      else {
        printResult(result);
      }
    } catch ( err ) {
      printError(err.message + " \n" + err.stack);
    }
  }

  function enter() {
    var text = mirror.getLine(line);
    var input = text.slice(ch);
    user = false;
    //debugger;
    if ( text ) {
      ch = 0;
      buffer.push(input);
      n = history.length;
      history["repl-history-"+n++] = input;
      mirror.setLine(line++, text + '\n');
      var code = buffer.join('\n').replace(/\r/g, '\n');
      var balanced = repl.isBalanced(code);

      if ( balanced ) {
        evaluate(code);
        buffer.length = 0;
        mirror.setMarker(line, prompt);
      }
      else {
        if ( balanced === null ) {
          buffer.pop();
          code = buffer.join('\n').replace('\r', '\n');
          mirror.setMarker(line, repl.isBalanced(code) ? prompt : "..");
        }
        else {
          mirror.setMarker(line, "..");
        }
      }
      //localStorage.setItem("history", JSON.stringify(history));
    }

    setTimeout(function () {
      user = true;
    }, 0);
  }

  function select() {
    var length = mirror.getLine(line).slice(ch).length;
    mirror.setSelection({ line: line, ch: 0 }, { line: line, ch: length });
  }

  function backspace() {
    var selected = mirror.somethingSelected();
    var cursor = mirror.getCursor(true);
    var ln = cursor.line;
    var c = cursor.ch;

    if ( ln === line && c >= ch + (selected ? 0 : 1) ) {
      if ( !selected ) {
        mirror.setSelection({ line: ln, ch: c - 1 }, cursor);
      }
      mirror.replaceSelection("");
    }
  }

  function del() {
    var cursor = mirror.getCursor(true);
    var ln = cursor.line;
    var c = cursor.ch;

    if ( ln === line && c < mirror.getLine(ln).length && c >= ch ) {
      if ( !mirror.somethingSelected() ) {
        mirror.setSelection({ line: ln, ch: c + 1 }, cursor);
      }
      mirror.replaceSelection("");
    }
  }

  function change(mirror, changes) {
    var to = changes.to;
    var from = changes.from;
    var text = changes.text;
    var next = changes.next;
    var length = text.length;

    if ( user ) {
      if ( from.line < line || from.ch < ch ) {
        mirror.undo();
      }
      else if ( length-- > 1 ) {
        mirror.undo();

        var ln = mirror.getLine(line).slice(ch);
        text[0] = ln.slice(0, from.ch) + text[0];

        for ( var i = 0; i < length; i++ ) {
          mirror.setLine(line, text[i]);
          enter();
        }

        mirror.setLine(line, text[length] + ln.slice(to.ch));
      }
    }

    if ( next ) {
      change(mirror, next);
    }
  }

  function print(message, className, marker) {
    var mode = user;
    var ln = line;
    user = false;

    message = String(message);
    var text = mirror.getLine(line);
    message = message.replace(/\n/g, '\r') + '\n';

    if ( text ) {
      mirror.setMarker(line, marker || "");
      var cursor = mirror.getCursor().ch;
    }

    mirror.setLine(line++, message);
    if ( className ) {
      mirror.markText({ line: ln, ch: 0 }, { line: ln, ch: message.length }, className);
    }

    if ( text ) {
      mirror.setLine(line, text);
      mirror.setMarker(line, marker || prompt);
      mirror.setCursor({ line: line, ch: cursor });
    }
    if ( marker ) {
      mirror.setMarker(line - 1, marker);
    }

    setTimeout(function () {
      user = mode;
    }, 0);
  }

  function printResult(result) {
    print(result, "result", resultPrompt);
  }

  function printError(error) {
    print(error, "error", errorPrompt);
  }

  function setMode(mode) {
    mirror.setOption("mode", mode);
  }

  function setTheme(theme) {
    mirror.setOption("theme", theme);
  }
}

CodeMirrorREPL.prototype.isBalanced = function (code) {
  var length = code.length;
  var delimiter = '';
  var brackets = [];
  var matching = {
    ')': '(',
    ']': '[',
    '}': '{'
  };

  for ( var i = 0; i < length; i++ ) {
    var char = code.charAt(i);

    switch ( delimiter ) {
      case "'":
      case '"':
      case '/':
        switch ( char ) {
          case delimiter:
            delimiter = "";
            break;
          case "\\":
            i++;
        }

        break;
      case "//":
        if ( char === "\n" ) {
          delimiter = "";
        }
        break;
      case "/*":
        if ( char === "*" && code.charAt(++i) === "/" ) {
          delimiter = "";
        }
        break;
      default:
        switch ( char ) {
          case "'":
          case '"':
            delimiter = char;
            break;
          case "/":
            var lookahead = code.charAt(++i);
            delimiter = char;

            switch ( lookahead ) {
              case "/":
              case "*":
                delimiter += lookahead;
            }

            break;
          case "(":
          case "[":
          case "{":
            brackets.push(char);
            break;
          case ")":
          case "]":
          case "}":
            if ( !brackets.length || matching[char] !== brackets.pop() ) {
              this.print(new SyntaxError("Unexpected closing bracket: '" + char + "'"), "error");
              return null;
            }
        }
    }
  }

  return brackets.length ? false : true;
};

CodeMirrorREPL.prototype.eval = function (code) {
  if (!this.sandbox){
    this.sandbox = document.createElement("iframe");
    this.sandbox.style.display="none";
    document.body.appendChild(this.sandbox);
  }
  return this.sandbox.eval(code);
};
