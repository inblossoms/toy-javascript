import { scan } from "../LexParser.js";

const syntaxMap = {
    Program: [["StatementList", "EOF"]],
    StatementList: [["Statement"], ["StatementList", "Statement"]],
    Statement: [
      ["ExpressionStatement"],
      ["IfStatement"],
      ["VariableDeclaration"],
      ["FunctionDeclaration"],
    ],
    IfStatement: [
      ["if", "(", "Expression", ")", "Statement"],
      // ["else", "Statement"],
      // ["else if", "(", "Expression", ")", "Statement"],
    ],
    VariableDeclaration: [
      // ["var", "Identifier", "=", "Expression", ";", "Statement"]
      ["var", "Identifier", ";"],
      ["let", "Identifier", ";"],
      ["const", "Identifier", ";"],
    ],
    FunctionDeclaration: [
      ["function", "Identifier", "(", ")", "{", "StatementList", "}"],
    ],
    ExpressionStatement: [["Expression", ";"]],
    Expression: [["AdditiveExpression"]],
    AdditiveExpression: [
      ["MultiplicativeExpression"],
      ["AdditiveExpression", "+", "MultiplicativeExpression"],
      ["AdditiveExpression", "-", "MultiplicativeExpression"],
    ],
    MultiplicativeExpression: [
      ["PrimaryExpression"],
      ["MultiplicativeExpression", "*", "PrimaryExpression"],
      ["MultiplicativeExpression", "/", "PrimaryExpression"],
    ],
    PrimaryExpression: [["(", "Expression", ")"], ["Literal"], ["Identifier"]],
    Literal: [
      ["NumericLiteral"] /*Number类型默认用于表示双精度浮点数*/,
      ["StringLiteral"] /*JavaScript中的String类型使用UTF-16编码*/,
      ["BooleanLiteral"],
      ["NullLiteral"],
      ["RegularExpression"],
      [
        "ObjectLiteral",
      ] /*Javascript property 对行为和状态并没有一个明确的区分*/,
      ["ArrayLiteral"],
    ],
    ObjectLiteral: [
      ["{", "}"],
      ["{", "PropertyList", "}"],
    ],
    PropertyList: [
      ["Property"],
      ["Property", ",", "PropertyList"],
    ],
    Property: [
      ["StringLiteral", ":", "AdditiveExpression"],
      ["Identifier", ":", "AdditiveExpression"],
      //   ["Identifier", ":", "AssignmentExpression"],
      //   ["Identifier", ":", "AssignmentExpression", ","],
      //   ["Identifier", ":", "AssignmentExpression", ",", "PropertyList"],
    ],
  },
  hash = {};

// 状态机
function closure(state) {
  hash[JSON.stringify(state)] = state; // 在数据污染之前备份数据
  const queue = [];

  for (let symbol in state) {
    if (symbol.match(/^\$/)) return; // 将 $reduceState 排除, 不做为普通的状态进行迁移
    queue.push(symbol); // 广度优先
  }
  // 提取每一个 symbol，根据 syntax 规则去进行展开 此时只处理了两层
  while (queue.length) {
    const symbol = queue.shift();
    // console.log(symbol);

    if (syntaxMap[symbol]) {
      for (let rule of syntaxMap[symbol]) {
        if (!state[rule[0]]) queue.push(rule[0]);
        let current = state;
        for (const part of rule) {
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
        // 在术语中用 reduce 来代指合并，reduce 有两个要素
        // 1. 将不定个 non-terminal-symbol 合并，所以需要回退状态
        // 2. 要 reduce 成一个什么样的 symbol
        current.$reduceType = symbol;
        current.$reduceLength = rule.length;
      }
    }
  }

  //
  for (const symbol in state) {
    if (symbol.match(/^\$/)) return;

    if (hash[JSON.stringify(state[symbol])]) {
      state[symbol] = hash[JSON.stringify(state[symbol])];
    } else {
      closure(state[symbol]);
    }
  }
}

// 如果把语法的分析过程看做一个状态迁移的过程 就是从 start 到 end 的过程
const end = {
  $isEnd: true,
};
const start = {
  Program: end,
};

closure(start);
// console.log(start);

function parse(source) {
  let stack = [start];
  let symbolStack = [];

  // 处理的是子元素
  function reduce() {
    let state = stack[stack.length - 1];
    // 生成新的 _symbol
    if (state.$reduceType) {
      let children = [];
      for (let i = 0; i < state.$reduceLength; i++) {
        stack.pop();
        children.push(symbolStack.pop());
      }

      // reduce to non-terminal-symbol and shift it
      return {
        type: state.$reduceType,
        children: children.reverse(),
      };
    } else {
      console.log(state);
      throw new Error("unexpected token");
    }
  }

  function shift(symbol) {
    let state = stack[stack.length - 1];
    if (symbol && symbol.type in state) {
      stack.push(state[symbol.type]); // 储存状态
      symbolStack.push(symbol);
    } else {
      // reduce to non-terminal-symbol
      // reduce 产生的新的 symbol 没有入栈，需要再次 shift
      shift(reduce());
      shift(symbol);
    }
  }

  for (let symbol /* terminal symbols */ of scan(source)) {
    shift(symbol);
    // console.log(symbol);
  }
  return reduce();
}

const evaluator = {
  Program: function (node) {
    return evaluate(node.children[0]);
  },
  StatementList: function (node) {
    switch (node.children.length) {
      case 1:
        return evaluate(node.children[0]);
      default:
        // StatementList: [["Statement"], ["StatementList", "Statement"]],
        // 第二种情况就全部执行一下
        evaluate(node.children[0]);
        return evaluate(node.children[1]);
    }
  },
  Statement: function (node) {
    return evaluate(node.children[0]);
  },
  VariableDeclaration: function (node) {
    // debugger;
    // log(node) 获取表达式声明体
    console.log(node.children[1].name);
  },
  ExpressionStatement: function (node) {
    return evaluate(node.children[0]);
  },
  Expression: function (node) {
    return evaluate(node.children[0]);
  },
  AdditiveExpression: function (node) {
    if (node.children.length === 1) return evaluate(node.children[0]);
    // else return evaluate(node.children[0]) + evaluate(node.children[2]);
  },
  MultiplicativeExpression: function (node) {
    if (node.children.length === 1) return evaluate(node.children[0]);
    // else return evaluate(node.children[0]) * evaluate(node.children[2]);
  },
  PrimaryExpression: function (node) {
    if (node.children.length === 1) return evaluate(node.children[0]);
  },
  Literal: function (node) {
    return evaluate(node.children[0]);
  },
  NumericLiteral: function (node) {
    let str = node.value,
      len = str.length,
      value = 0,
      // 进制
      n = 10;

    if (str.match(/^0b/)) {
      n = 2;
      len -= 2;
    } else if (str.match(/^0o/)) {
      n = 8;
      len -= 2;
    } else if (str.match(/^0x/)) {
      n = 16;
      len -= 2;
    }

    while (len--) {
      // 处理 16 进制
      let char = str.charCodeAt(str.length - len - 1);
      if (char >= "a".charCodeAt(0) && char <= "f".charCodeAt(0)) {
        char = char - "a".charCodeAt(0) + 10;
      } else if (char >= "A".charCodeAt(0) && char <= "F".charCodeAt(0)) {
        char = char - "A".charCodeAt(0) + 10;
      } else if (char >= "0".charCodeAt(0) && char <= "9".charCodeAt(0)) {
        char -= "0".charCodeAt(0);
      } else {
        throw new Error("Invalid or unexpected token");
      }

      // 将数字字符转换为其对应的数字值
      value = value * n + char;
    }

    console.log(value);
    return Number(node.value);
  },
  StringLiteral: function (node) {
    const result = [];
    console.log(node.value);

    for (let i = 1, len = node.value.length - 1; i < len; i++) {
      switch (node.value[i]) {
        case "\\":
          ++i;
          const char = node.value[i],
            escapeCharMap = {
              // 默认处理 BMP 的字符集（0000 - ffff : 一个 utf-16 的资源）
              n: String.fromCharCode(0x000a),
              r: String.fromCharCode(0x000d),
              t: String.fromCharCode(0x0009),
              b: String.fromCharCode(0x0008),
              f: String.fromCharCode(0x000c),
              v: String.fromCharCode(0x000b),
              0: String.fromCharCode(0x0000),
              "\\": String.fromCharCode(0x005c),
              "'": String.fromCharCode(0x0027),
              '"': String.fromCharCode(0x0022),
            };
          if (char in escapeCharMap) {
            result.push(escapeCharMap[char]);
          } else {
            result.push(char);
          }
          break;
        default:
          result.push(node.value[i]);
          break;
      }
    }
    console.log(result);

    return result.join("");
  },
  ObjectLiteral: function (node) {
    const len = node.children.length;
    if (len === 2) {
      console.log(node.children)
      return {};
    }
    if (len === 3) {
      const object = new Map(); // Js 的对象本质就是两个东西：prototype property
      this.PropertyList(node.children[1], object);
      return object;
    }
  },
  PropertyList: function (node, object) {
    if (node.children.length === 1) {
      this.Property(node.children[0], object);
    } else {
      this.PropertyList(node.children[0], object);
      this.Property(node.children[2], object);
    }
  },
  Property: function (node, object) {
    let name;
    if(node.children[0].type === "Identifier"){
      name = node.children[0].name;
    }
    else if(node.children[0].type === "StringLiteral"){
      name = evaluate(node.children[0])
    }
    object.set(name, {
      value:evaluate(node.children[2]),
      writeable: true,
      enumerable: true,
      configurable: true,
    })
  },
  BooleanLiteral: function (node) {},
  NullLiteral: function (node) {},
};

// 每一次去执行树中的某一个节点
function evaluate(node) {
  if (evaluator[node.type]) return evaluator[node.type](node);
}

/////////////////////////////
window.jsc = {
  evaluate,
  parse,
};

const source = `
	0b1011; 'a\\nb'; {
       a: 10
    };
`;
let lexicalTree = parse(source);
evaluate(lexicalTree);
