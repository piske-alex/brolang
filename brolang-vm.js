#!/usr/bin/env node

/**
 * BroLang Compiler + Virtual Machine v0.2.0
 *
 * A real compiler: Lexer → Parser → AST → Bytecode Compiler → Stack-based VM
 * No transpilation. No JavaScript eval. Pure bytecode execution.
 *
 * NFA. DYOR.
 */

// ═══════════════════════════════════════════
//  PART 1: LEXER — tokenizes BroLang source
// ═══════════════════════════════════════════

const TokenType = {
  // Literals
  NUMBER: 'NUMBER',
  STRING: 'STRING',

  // Identifiers
  IDENT: 'IDENT',

  // Keywords
  GM: 'GM', GN: 'GN',
  SER: 'SER', HODL: 'HODL',
  IS: 'IS',
  BASED: 'BASED', GG: 'GG',
  PAPER_HANDS: 'PAPER_HANDS',
  WAGMI: 'WAGMI', NGMI: 'NGMI', FR: 'FR',
  TO_THE_MOON: 'TO_THE_MOON',
  TOUCH_GRASS: 'TOUCH_GRASS',
  SHILL: 'SHILL',
  RUG: 'RUG',
  FEW: 'FEW', COPE: 'COPE',
  PROBABLY_NOTHING: 'PROBABLY_NOTHING',
  APE_IN: 'APE_IN',
  APE_OUT: 'APE_OUT',
  APE_INTO: 'APE_INTO',
  STOP: 'STOP',
  NFA: 'NFA',

  // Operators
  PLUS: 'PLUS', MINUS: 'MINUS',
  TIMES: 'TIMES', DIVIDED_BY: 'DIVIDED_BY',
  MOD: 'MOD',
  EQUALS: 'EQUALS',
  GREATER_THAN: 'GREATER_THAN', LESS_THAN: 'LESS_THAN',
  GTE: 'GTE', LTE: 'LTE',
  AND: 'AND', OR: 'OR', NOT: 'NOT',

  // Punctuation
  LPAREN: 'LPAREN', RPAREN: 'RPAREN',
  LBRACKET: 'LBRACKET', RBRACKET: 'RBRACKET',
  COMMA: 'COMMA', DOT: 'DOT',

  // Special
  NEWLINE: 'NEWLINE',
  EOF: 'EOF',
};

const KEYWORDS = {
  'gm': TokenType.GM, 'gn': TokenType.GN,
  'ser': TokenType.SER, 'hodl': TokenType.HODL,
  'is': TokenType.IS,
  'based': TokenType.BASED, 'gg': TokenType.GG,
  'paper_hands': TokenType.PAPER_HANDS,
  'wagmi': TokenType.WAGMI, 'ngmi': TokenType.NGMI, 'fr': TokenType.FR,
  'to_the_moon': TokenType.TO_THE_MOON,
  'touch_grass': TokenType.TOUCH_GRASS,
  'shill': TokenType.SHILL,
  'rug': TokenType.RUG,
  'few': TokenType.FEW, 'cope': TokenType.COPE,
  'probably_nothing': TokenType.PROBABLY_NOTHING,
  'ape_in': TokenType.APE_IN,
  'ape_out': TokenType.APE_OUT,
  'ape_into': TokenType.APE_INTO,
  'stop': TokenType.STOP,
  'nfa': TokenType.NFA,
  'plus': TokenType.PLUS, 'minus': TokenType.MINUS,
  'times': TokenType.TIMES, 'divided_by': TokenType.DIVIDED_BY,
  'mod': TokenType.MOD,
  'equals': TokenType.EQUALS,
  'greater_than': TokenType.GREATER_THAN, 'less_than': TokenType.LESS_THAN,
  'gte': TokenType.GTE, 'lte': TokenType.LTE,
  'and': TokenType.AND, 'or': TokenType.OR, 'not': TokenType.NOT,
};

// Multi-word keywords — checked before single-word tokenization
const MULTI_WORD_KEYWORDS = [
  'paper_hands', 'to_the_moon', 'touch_grass',
  'probably_nothing', 'ape_in',
  'divided_by', 'greater_than', 'less_than',
];

class Token {
  constructor(type, value, line) {
    this.type = type;
    this.value = value;
    this.line = line;
  }
}

function lex(source) {
  const tokens = [];
  const lines = source.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    let line = lines[lineNum];
    let pos = 0;

    // Skip leading whitespace
    while (pos < line.length && (line[pos] === ' ' || line[pos] === '\t')) pos++;

    // Skip empty lines
    if (pos >= line.length) {
      tokens.push(new Token(TokenType.NEWLINE, '\\n', lineNum + 1));
      continue;
    }

    // Comment line (nfa ...)
    const restOfLine = line.substring(pos);
    if (restOfLine.startsWith('nfa ') || restOfLine === 'nfa' ||
        restOfLine.toUpperCase().startsWith('NFA ') || restOfLine.toUpperCase() === 'NFA') {
      tokens.push(new Token(TokenType.NFA, restOfLine, lineNum + 1));
      tokens.push(new Token(TokenType.NEWLINE, '\\n', lineNum + 1));
      continue;
    }

    // COBOL-style decorative lines (skip as comments)
    const upper = restOfLine.toUpperCase().trim();
    if (upper.endsWith('DIVISION.') || upper.endsWith('SECTION.') ||
        upper.startsWith('PROGRAM-ID.') || upper.startsWith('VIBES.')) {
      tokens.push(new Token(TokenType.NFA, restOfLine, lineNum + 1));
      tokens.push(new Token(TokenType.NEWLINE, '\\n', lineNum + 1));
      continue;
    }

    while (pos < line.length) {
      // Skip whitespace
      if (line[pos] === ' ' || line[pos] === '\t') { pos++; continue; }

      // String literal
      if (line[pos] === '"') {
        let str = '';
        pos++; // skip opening quote
        while (pos < line.length && line[pos] !== '"') {
          str += line[pos];
          pos++;
        }
        pos++; // skip closing quote
        tokens.push(new Token(TokenType.STRING, str, lineNum + 1));
        continue;
      }

      // Number
      if (/[0-9]/.test(line[pos]) || (line[pos] === '-' && pos + 1 < line.length && /[0-9]/.test(line[pos + 1]))) {
        let num = '';
        if (line[pos] === '-') { num += '-'; pos++; }
        while (pos < line.length && /[0-9.]/.test(line[pos])) {
          num += line[pos];
          pos++;
        }
        tokens.push(new Token(TokenType.NUMBER, parseFloat(num), lineNum + 1));
        continue;
      }

      // Punctuation
      if (line[pos] === '(') { tokens.push(new Token(TokenType.LPAREN, '(', lineNum + 1)); pos++; continue; }
      if (line[pos] === ')') { tokens.push(new Token(TokenType.RPAREN, ')', lineNum + 1)); pos++; continue; }
      if (line[pos] === '[') { tokens.push(new Token(TokenType.LBRACKET, '[', lineNum + 1)); pos++; continue; }
      if (line[pos] === ']') { tokens.push(new Token(TokenType.RBRACKET, ']', lineNum + 1)); pos++; continue; }
      if (line[pos] === ',') { tokens.push(new Token(TokenType.COMMA, ',', lineNum + 1)); pos++; continue; }
      if (line[pos] === '.') { tokens.push(new Token(TokenType.DOT, '.', lineNum + 1)); pos++; continue; }

      // Identifier or keyword
      if (/[a-zA-Z_]/.test(line[pos])) {
        let word = '';
        while (pos < line.length && /[a-zA-Z0-9_]/.test(line[pos])) {
          word += line[pos];
          pos++;
        }

        // Case-insensitive keyword lookup (WAGMI = wagmi = Wagmi)
        const lower = word.toLowerCase();
        if (KEYWORDS[lower]) {
          tokens.push(new Token(KEYWORDS[lower], lower, lineNum + 1));
        } else {
          tokens.push(new Token(TokenType.IDENT, word, lineNum + 1));
        }

        // Skip optional trailing period (COBOL style: fr. gg. STOP RUG.)
        if (pos < line.length && line[pos] === '.') {
          // Only skip if period is at end of line or before whitespace (not Math.floor)
          const nextChar = pos + 1 < line.length ? line[pos + 1] : '\n';
          if (nextChar === ' ' || nextChar === '\t' || nextChar === '\n' || pos + 1 >= line.length) {
            pos++; // skip the period
          }
        }
        continue;
      }

      // Unknown character — skip
      pos++;
    }

    tokens.push(new Token(TokenType.NEWLINE, '\\n', lineNum + 1));
  }

  tokens.push(new Token(TokenType.EOF, null, lines.length));
  return tokens;
}


// ═══════════════════════════════════════════
//  PART 2: PARSER — builds an AST
// ═══════════════════════════════════════════

// AST Node types
const N = {
  PROGRAM: 'Program',
  NUM_LIT: 'NumLit',
  STR_LIT: 'StrLit',
  BOOL_LIT: 'BoolLit',
  NULL_LIT: 'NullLit',
  IDENT: 'Ident',
  BINOP: 'BinOp',
  UNARYOP: 'UnaryOp',
  CALL: 'Call',
  MEMBER: 'Member',
  ARRAY_LIT: 'ArrayLit',
  VAR_DECL: 'VarDecl',
  CONST_DECL: 'ConstDecl',
  ASSIGN: 'Assign',
  FUNC_DECL: 'FuncDecl',
  RETURN: 'Return',
  IF: 'If',
  WHILE: 'While',
  BREAK: 'Break',
  PRINT: 'Print',
  THROW: 'Throw',
  PUSH: 'Push',
  IMPORT: 'Import',
  EXPR_STMT: 'ExprStmt',
};

class Parser {
  constructor(tokens) {
    this.tokens = tokens.filter(t => t.type !== TokenType.NFA); // strip comments
    this.pos = 0;
  }

  peek() { return this.tokens[this.pos]; }
  advance() { return this.tokens[this.pos++]; }

  expect(type) {
    const tok = this.advance();
    if (tok.type !== type) {
      throw new Error(`Line ${tok.line}: expected ${type}, got ${tok.type} (${tok.value})`);
    }
    return tok;
  }

  skipNewlines() {
    while (this.peek().type === TokenType.NEWLINE) this.advance();
  }

  match(type) {
    if (this.peek().type === type) { this.advance(); return true; }
    return false;
  }

  parse() {
    this.skipNewlines();
    this.match(TokenType.GM); // optional — COBOL divisions replace gm
    this.skipNewlines();

    const body = [];
    while (this.peek().type !== TokenType.GN &&
           this.peek().type !== TokenType.STOP &&
           this.peek().type !== TokenType.EOF) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
      this.skipNewlines();
    }

    // Accept gn, STOP RUG, or EOF
    if (this.peek().type === TokenType.GN) this.advance();
    else if (this.peek().type === TokenType.STOP) {
      this.advance(); // STOP
      if (this.peek().type === TokenType.RUG) this.advance(); // RUG (optional)
    }
    return { type: N.PROGRAM, body };
  }

  parseStatement() {
    this.skipNewlines();
    const tok = this.peek();

    switch (tok.type) {
      case TokenType.SER: return this.parseVarDecl();
      case TokenType.HODL: return this.parseConstDecl();
      case TokenType.BASED: return this.parseFuncDecl();
      case TokenType.PAPER_HANDS: return this.parseReturn();
      case TokenType.WAGMI: return this.parseIf();
      case TokenType.TO_THE_MOON: return this.parseWhile();
      case TokenType.TOUCH_GRASS: this.advance(); return { type: N.BREAK };
      case TokenType.SHILL: return this.parsePrint();
      case TokenType.RUG: return this.parseThrow();
      case TokenType.APE_IN: return this.parsePush();
      case TokenType.APE_INTO: return this.parseImport();
      case TokenType.IDENT: return this.parseIdentStatement();
      default:
        this.advance(); // skip unknown
        return null;
    }
  }

  // ser x is expr
  parseVarDecl() {
    this.expect(TokenType.SER);
    const name = this.expect(TokenType.IDENT).value;
    this.expect(TokenType.IS);
    const value = this.parseExpr();
    return { type: N.VAR_DECL, name, value };
  }

  // hodl X is expr
  parseConstDecl() {
    this.expect(TokenType.HODL);
    const name = this.expect(TokenType.IDENT).value;
    this.expect(TokenType.IS);
    const value = this.parseExpr();
    return { type: N.CONST_DECL, name, value };
  }

  // based name(a, b, c) ape_in ... ape_out  OR  based name(a, b, c) ... gg
  parseFuncDecl() {
    this.expect(TokenType.BASED);
    const name = this.expect(TokenType.IDENT).value;
    this.expect(TokenType.LPAREN);
    const params = [];
    if (this.peek().type !== TokenType.RPAREN) {
      params.push(this.expect(TokenType.IDENT).value);
      while (this.match(TokenType.COMMA)) {
        params.push(this.expect(TokenType.IDENT).value);
      }
    }
    this.expect(TokenType.RPAREN);
    this.match(TokenType.APE_IN); // optional ape_in
    this.skipNewlines();

    const body = [];
    while (this.peek().type !== TokenType.GG && this.peek().type !== TokenType.APE_OUT) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
      this.skipNewlines();
    }
    this.advance(); // consume gg or ape_out
    return { type: N.FUNC_DECL, name, params, body };
  }

  parseReturn() {
    this.expect(TokenType.PAPER_HANDS);
    const value = this.parseExpr();
    return { type: N.RETURN, value };
  }

  // wagmi expr ape_in ... ape_out ngmi ape_in ... ape_out fr.
  // OR: wagmi expr ... ngmi ... fr
  parseIf() {
    this.expect(TokenType.WAGMI);
    const condition = this.parseExpr();
    this.match(TokenType.APE_IN); // optional ape_in
    this.skipNewlines();

    const consequent = [];
    while (this.peek().type !== TokenType.NGMI &&
           this.peek().type !== TokenType.FR &&
           this.peek().type !== TokenType.APE_OUT) {
      const stmt = this.parseStatement();
      if (stmt) consequent.push(stmt);
      this.skipNewlines();
    }

    // Consume ape_out if present
    const hadApeOut = this.match(TokenType.APE_OUT);

    let alternate = [];
    if (this.match(TokenType.NGMI)) {
      this.match(TokenType.APE_IN); // optional ape_in
      this.skipNewlines();
      while (this.peek().type !== TokenType.FR &&
             this.peek().type !== TokenType.APE_OUT) {
        const stmt = this.parseStatement();
        if (stmt) alternate.push(stmt);
        this.skipNewlines();
      }
      this.match(TokenType.APE_OUT); // optional ape_out
    }
    this.match(TokenType.FR); // optional fr (required in old syntax, optional with ape_in/ape_out)
    return { type: N.IF, condition, consequent, alternate };
  }

  // to_the_moon expr ape_in ... ape_out  OR  to_the_moon expr ... gg
  parseWhile() {
    this.expect(TokenType.TO_THE_MOON);
    const condition = this.parseExpr();
    this.match(TokenType.APE_IN); // optional ape_in
    this.skipNewlines();

    const body = [];
    while (this.peek().type !== TokenType.GG && this.peek().type !== TokenType.APE_OUT) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
      this.skipNewlines();
    }
    this.advance(); // consume gg or ape_out
    return { type: N.WHILE, condition, body };
  }

  parsePrint() {
    this.expect(TokenType.SHILL);
    const value = this.parseExpr();
    return { type: N.PRINT, value };
  }

  parseThrow() {
    this.expect(TokenType.RUG);
    const value = this.parseExpr();
    return { type: N.THROW, value };
  }

  parsePush() {
    this.expect(TokenType.APE_IN);
    const array = this.expect(TokenType.IDENT).value;
    const value = this.parseExpr();
    return { type: N.PUSH, array, value };
  }

  parseImport() {
    this.expect(TokenType.APE_INTO);
    const module = this.expect(TokenType.IDENT).value;
    return { type: N.IMPORT, module };
  }

  // ident is expr   OR   ident(args)   OR   just ident as expression
  parseIdentStatement() {
    const name = this.expect(TokenType.IDENT).value;

    // Assignment: name is expr
    if (this.peek().type === TokenType.IS) {
      this.advance();
      const value = this.parseExpr();
      return { type: N.ASSIGN, name, value };
    }

    // Function call or expression statement — put the ident back and parse as expr
    this.pos--;
    const expr = this.parseExpr();
    return { type: N.EXPR_STMT, expr };
  }

  // ── Expression parsing (precedence climbing) ──

  parseExpr() {
    return this.parseOr();
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.peek().type === TokenType.OR) {
      this.advance();
      const right = this.parseAnd();
      left = { type: N.BINOP, op: '||', left, right };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseEquality();
    while (this.peek().type === TokenType.AND) {
      this.advance();
      const right = this.parseEquality();
      left = { type: N.BINOP, op: '&&', left, right };
    }
    return left;
  }

  parseEquality() {
    let left = this.parseComparison();
    while (this.peek().type === TokenType.EQUALS) {
      this.advance();
      const right = this.parseComparison();
      left = { type: N.BINOP, op: '==', left, right };
    }
    return left;
  }

  parseComparison() {
    let left = this.parseAddSub();
    const compOps = {
      [TokenType.GREATER_THAN]: '>',
      [TokenType.LESS_THAN]: '<',
      [TokenType.GTE]: '>=',
      [TokenType.LTE]: '<=',
    };
    while (compOps[this.peek().type]) {
      const op = compOps[this.advance().type];
      const right = this.parseAddSub();
      left = { type: N.BINOP, op, left, right };
    }
    return left;
  }

  parseAddSub() {
    let left = this.parseMulDiv();
    while (this.peek().type === TokenType.PLUS || this.peek().type === TokenType.MINUS) {
      const op = this.advance().type === TokenType.PLUS ? '+' : '-';
      const right = this.parseMulDiv();
      left = { type: N.BINOP, op, left, right };
    }
    return left;
  }

  parseMulDiv() {
    let left = this.parseUnary();
    while (this.peek().type === TokenType.TIMES ||
           this.peek().type === TokenType.DIVIDED_BY ||
           this.peek().type === TokenType.MOD) {
      const op = this.advance().type === TokenType.TIMES ? '*' :
                 this.tokens[this.pos - 1].type === TokenType.DIVIDED_BY ? '/' : '%';
      const right = this.parseUnary();
      left = { type: N.BINOP, op, left, right };
    }
    return left;
  }

  parseUnary() {
    if (this.peek().type === TokenType.NOT) {
      this.advance();
      const operand = this.parseUnary();
      return { type: N.UNARYOP, op: '!', operand };
    }
    if (this.peek().type === TokenType.MINUS) {
      this.advance();
      const operand = this.parseUnary();
      return { type: N.UNARYOP, op: '-', operand };
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let node = this.parsePrimary();

    while (true) {
      // Function call
      if (this.peek().type === TokenType.LPAREN) {
        this.advance();
        const args = [];
        if (this.peek().type !== TokenType.RPAREN) {
          args.push(this.parseExpr());
          while (this.match(TokenType.COMMA)) {
            args.push(this.parseExpr());
          }
        }
        this.expect(TokenType.RPAREN);
        node = { type: N.CALL, callee: node, args };
      }
      // Member access
      else if (this.peek().type === TokenType.DOT) {
        this.advance();
        const prop = this.expect(TokenType.IDENT).value;
        node = { type: N.MEMBER, object: node, property: prop };
      }
      else break;
    }

    return node;
  }

  parsePrimary() {
    const tok = this.peek();

    if (tok.type === TokenType.NUMBER) {
      this.advance();
      return { type: N.NUM_LIT, value: tok.value };
    }

    if (tok.type === TokenType.STRING) {
      this.advance();
      return { type: N.STR_LIT, value: tok.value };
    }

    if (tok.type === TokenType.FEW) {
      this.advance();
      return { type: N.BOOL_LIT, value: true };
    }

    if (tok.type === TokenType.COPE) {
      this.advance();
      return { type: N.BOOL_LIT, value: false };
    }

    if (tok.type === TokenType.PROBABLY_NOTHING) {
      this.advance();
      return { type: N.NULL_LIT };
    }

    if (tok.type === TokenType.IDENT) {
      this.advance();
      return { type: N.IDENT, name: tok.value };
    }

    if (tok.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpr();
      this.expect(TokenType.RPAREN);
      return expr;
    }

    if (tok.type === TokenType.LBRACKET) {
      this.advance();
      const elements = [];
      if (this.peek().type !== TokenType.RBRACKET) {
        elements.push(this.parseExpr());
        while (this.match(TokenType.COMMA)) {
          elements.push(this.parseExpr());
        }
      }
      this.expect(TokenType.RBRACKET);
      return { type: N.ARRAY_LIT, elements };
    }

    throw new Error(`Line ${tok.line}: unexpected token ${tok.type} (${tok.value})`);
  }
}


// ═══════════════════════════════════════════
//  PART 3: BYTECODE COMPILER
// ═══════════════════════════════════════════

const Op = {
  // Stack ops
  CONST:      0x01,  // push constant
  POP:        0x02,  // discard top
  DUP:        0x03,  // duplicate top

  // Arithmetic
  ADD:        0x10,
  SUB:        0x11,
  MUL:        0x12,
  DIV:        0x13,
  MOD:        0x14,
  NEG:        0x15,

  // Comparison
  EQ:         0x20,
  GT:         0x21,
  LT:         0x22,
  GTE:        0x23,
  LTE:        0x24,

  // Logic
  NOT:        0x28,
  AND:        0x29,
  OR:         0x2A,

  // String
  CONCAT:     0x30,

  // Variables
  LOAD:       0x40,  // load variable by name
  STORE:      0x41,  // store variable by name
  LOAD_LOCAL: 0x42,  // load local variable by slot
  STORE_LOCAL:0x43,  // store local variable by slot

  // Control flow
  JMP:        0x50,  // unconditional jump
  JMP_FALSE:  0x51,  // jump if top is falsy
  JMP_TRUE:   0x52,  // jump if top is truthy

  // Functions
  CALL:       0x60,  // call function (arg count on stack)
  RETURN:     0x61,  // return from function
  CALL_BUILTIN: 0x62, // call a built-in function

  // IO
  PRINT:      0x70,

  // Special
  ARRAY:      0x80,  // create array from N items on stack
  INDEX:      0x81,  // array/object index access
  MEMBER:     0x82,  // member access (for built-in methods)
  PUSH_ARR:   0x83,  // push value onto array

  HALT:       0xFF,
};

const OP_NAMES = {};
for (const [name, code] of Object.entries(Op)) OP_NAMES[code] = name;

class Chunk {
  constructor(name) {
    this.name = name;
    this.code = [];       // bytecode
    this.constants = [];  // constant pool
    this.lines = [];      // source line for each byte (for errors)
  }

  emit(op, line) {
    this.code.push(op);
    this.lines.push(line || 0);
    return this.code.length - 1;
  }

  emitConstant(value, line) {
    const idx = this.addConstant(value);
    this.emit(Op.CONST, line);
    this.emit(idx, line);
  }

  addConstant(value) {
    // Reuse existing constant if same value and type
    for (let i = 0; i < this.constants.length; i++) {
      if (this.constants[i] === value) return i;
    }
    this.constants.push(value);
    return this.constants.length - 1;
  }

  // Patch a jump instruction's target
  patchJump(offset) {
    this.code[offset + 1] = this.code.length;
  }
}

class Compiler {
  constructor() {
    this.functions = new Map(); // name -> Chunk
    this.mainChunk = new Chunk('<main>');
    this.currentChunk = this.mainChunk;
    this.scopeDepth = 0;
    this.locals = [];  // { name, depth }
    this.imports = [];  // module names from APE_INTO
  }

  compile(ast) {
    // Collect imports
    for (const node of ast.body) {
      if (node.type === N.IMPORT) this.imports.push(node.module);
    }

    // First pass: collect function declarations
    for (const node of ast.body) {
      if (node.type === N.FUNC_DECL) {
        this.compileFunction(node);
      }
    }

    // Second pass: compile top-level statements
    this.currentChunk = this.mainChunk;
    for (const node of ast.body) {
      if (node.type !== N.FUNC_DECL && node.type !== N.IMPORT) {
        this.compileNode(node);
      }
    }
    this.currentChunk.emit(Op.HALT, 0);

    return {
      main: this.mainChunk,
      functions: this.functions,
      imports: this.imports,
    };
  }

  compileFunction(node) {
    const chunk = new Chunk(node.name);
    const prevChunk = this.currentChunk;
    const prevLocals = this.locals;
    this.currentChunk = chunk;
    this.locals = [];

    // Parameters become local variables
    for (const param of node.params) {
      this.locals.push({ name: param, depth: 0 });
    }

    // Compile body
    for (const stmt of node.body) {
      this.compileNode(stmt);
    }

    // Implicit return null if no explicit return
    const lastOp = chunk.code[chunk.code.length - 1];
    if (lastOp !== Op.RETURN) {
      chunk.emitConstant(null, 0);
      chunk.emit(Op.RETURN, 0);
    }

    this.functions.set(node.name, { chunk, params: node.params });
    this.currentChunk = prevChunk;
    this.locals = prevLocals;
  }

  compileNode(node) {
    switch (node.type) {
      case N.VAR_DECL:
      case N.CONST_DECL:
        this.compileExpr(node.value);
        this.currentChunk.emit(Op.STORE, 0);
        this.currentChunk.emit(this.currentChunk.addConstant(node.name), 0);
        break;

      case N.ASSIGN:
        this.compileExpr(node.value);
        this.currentChunk.emit(Op.STORE, 0);
        this.currentChunk.emit(this.currentChunk.addConstant(node.name), 0);
        break;

      case N.PRINT:
        this.compileExpr(node.value);
        this.currentChunk.emit(Op.PRINT, 0);
        break;

      case N.RETURN:
        this.compileExpr(node.value);
        this.currentChunk.emit(Op.RETURN, 0);
        break;

      case N.IF: {
        this.compileExpr(node.condition);
        const jumpFalse = this.currentChunk.code.length;
        this.currentChunk.emit(Op.JMP_FALSE, 0);
        this.currentChunk.emit(0, 0); // placeholder

        for (const stmt of node.consequent) this.compileNode(stmt);

        if (node.alternate.length > 0) {
          const jumpEnd = this.currentChunk.code.length;
          this.currentChunk.emit(Op.JMP, 0);
          this.currentChunk.emit(0, 0); // placeholder

          this.currentChunk.code[jumpFalse + 1] = this.currentChunk.code.length;

          for (const stmt of node.alternate) this.compileNode(stmt);

          this.currentChunk.code[jumpEnd + 1] = this.currentChunk.code.length;
        } else {
          this.currentChunk.code[jumpFalse + 1] = this.currentChunk.code.length;
        }
        break;
      }

      case N.WHILE: {
        const loopStart = this.currentChunk.code.length;
        this.compileExpr(node.condition);
        const jumpFalse = this.currentChunk.code.length;
        this.currentChunk.emit(Op.JMP_FALSE, 0);
        this.currentChunk.emit(0, 0); // placeholder

        for (const stmt of node.body) this.compileNode(stmt);

        this.currentChunk.emit(Op.JMP, 0);
        this.currentChunk.emit(loopStart, 0);

        this.currentChunk.code[jumpFalse + 1] = this.currentChunk.code.length;
        break;
      }

      case N.THROW:
        this.compileExpr(node.value);
        // We'll use a special constant to signal throw
        this.currentChunk.emit(Op.CALL_BUILTIN, 0);
        this.currentChunk.emit(this.currentChunk.addConstant('__throw'), 0);
        break;

      case N.PUSH:
        this.currentChunk.emit(Op.LOAD, 0);
        this.currentChunk.emit(this.currentChunk.addConstant(node.array), 0);
        this.compileExpr(node.value);
        this.currentChunk.emit(Op.PUSH_ARR, 0);
        break;

      case N.EXPR_STMT:
        this.compileExpr(node.expr);
        this.currentChunk.emit(Op.POP, 0);
        break;

      case N.BREAK:
        // Simplified — in a real compiler we'd track loop context
        this.currentChunk.emit(Op.JMP, 0);
        this.currentChunk.emit(0, 0); // needs patching — simplified
        break;
    }
  }

  compileExpr(node) {
    switch (node.type) {
      case N.NUM_LIT:
        this.currentChunk.emitConstant(node.value, 0);
        break;

      case N.STR_LIT:
        this.currentChunk.emitConstant(node.value, 0);
        break;

      case N.BOOL_LIT:
        this.currentChunk.emitConstant(node.value, 0);
        break;

      case N.NULL_LIT:
        this.currentChunk.emitConstant(null, 0);
        break;

      case N.IDENT:
        // Check if it's a local (function param)
        const localIdx = this.locals.findIndex(l => l.name === node.name);
        if (localIdx !== -1) {
          this.currentChunk.emit(Op.LOAD_LOCAL, 0);
          this.currentChunk.emit(localIdx, 0);
        } else {
          this.currentChunk.emit(Op.LOAD, 0);
          this.currentChunk.emit(this.currentChunk.addConstant(node.name), 0);
        }
        break;

      case N.BINOP: {
        this.compileExpr(node.left);
        this.compileExpr(node.right);
        const opMap = {
          '+': Op.ADD, '-': Op.SUB, '*': Op.MUL, '/': Op.DIV, '%': Op.MOD,
          '==': Op.EQ, '>': Op.GT, '<': Op.LT, '>=': Op.GTE, '<=': Op.LTE,
          '&&': Op.AND, '||': Op.OR,
        };
        this.currentChunk.emit(opMap[node.op], 0);
        break;
      }

      case N.UNARYOP:
        this.compileExpr(node.operand);
        if (node.op === '!') this.currentChunk.emit(Op.NOT, 0);
        if (node.op === '-') this.currentChunk.emit(Op.NEG, 0);
        break;

      case N.CALL: {
        // Check for built-in functions accessed via member (e.g., Math.floor)
        if (node.callee.type === N.MEMBER) {
          // Compile args
          for (const arg of node.args) this.compileExpr(arg);
          // Encode as builtin call: "Object.method"
          const builtinName = this.getMemberPath(node.callee);
          this.currentChunk.emit(Op.CALL_BUILTIN, 0);
          this.currentChunk.emit(this.currentChunk.addConstant(builtinName), 0);
          this.currentChunk.emit(node.args.length, 0);
          break;
        }

        // Regular function call
        for (const arg of node.args) this.compileExpr(arg);
        this.currentChunk.emitConstant(node.callee.name, 0);
        this.currentChunk.emit(Op.CALL, 0);
        this.currentChunk.emit(node.args.length, 0);
        break;
      }

      case N.MEMBER: {
        // Method call without args — treat as property access
        this.compileExpr(node.object);
        this.currentChunk.emitConstant(node.property, 0);
        this.currentChunk.emit(Op.MEMBER, 0);
        break;
      }

      case N.ARRAY_LIT:
        for (const el of node.elements) this.compileExpr(el);
        this.currentChunk.emit(Op.ARRAY, 0);
        this.currentChunk.emit(node.elements.length, 0);
        break;
    }
  }

  getMemberPath(node) {
    if (node.type === N.MEMBER) {
      const obj = node.object.type === N.MEMBER
        ? this.getMemberPath(node.object)
        : node.object.name;
      return `${obj}.${node.property}`;
    }
    return node.name;
  }
}


// ═══════════════════════════════════════════
//  PART 3.5: STANDARD LIBRARY MODULES
// ═══════════════════════════════════════════

// Each module maps function names to implementations.
// Implementations receive (vm, args) and return a value.
// Functions that need async (sleep, hflush) return { async: true, fn }

const STDLIB = {
  degen_math: {
    random:    (vm) => Math.random(),
    pi:        (vm) => Math.PI,
    e:         (vm) => Math.E,
    floor:     (vm, args) => Math.floor(args[0]),
    ceil:      (vm, args) => Math.ceil(args[0]),
    round:     (vm, args) => Math.round(args[0]),
    sqrt:      (vm, args) => Math.sqrt(args[0]),
    abs:       (vm, args) => Math.abs(args[0]),
    min:       (vm, args) => Math.min(...args),
    max:       (vm, args) => Math.max(...args),
    pow:       (vm, args) => Math.pow(args[0], args[1]),
    log:       (vm, args) => Math.log(args[0]),
    sin:       (vm, args) => Math.sin(args[0]),
    cos:       (vm, args) => Math.cos(args[0]),
    tan:       (vm, args) => Math.tan(args[0]),
    atan2:     (vm, args) => Math.atan2(args[0], args[1]),
  },

  degen_string: {
    char_at:     (vm, args) => typeof args[0] === 'string' ? (args[0][args[1]] || ' ') : ' ',
    str_len:     (vm, args) => typeof args[0] === 'string' ? args[0].length : 0,
    substr:      (vm, args) => String(args[0]).substring(args[1] | 0, args[2] !== undefined ? args[2] | 0 : undefined),
    upper:       (vm, args) => String(args[0]).toUpperCase(),
    lower:       (vm, args) => String(args[0]).toLowerCase(),
    trim:        (vm, args) => String(args[0]).trim(),
    contains:    (vm, args) => String(args[0]).includes(String(args[1])) ? 1 : 0,
    starts_with: (vm, args) => String(args[0]).startsWith(String(args[1])) ? 1 : 0,
    ends_with:   (vm, args) => String(args[0]).endsWith(String(args[1])) ? 1 : 0,
    replace:     (vm, args) => String(args[0]).replace(String(args[1]), String(args[2])),
    split:       (vm, args) => String(args[0]).split(String(args[1])),
    join:        (vm, args) => Array.isArray(args[0]) ? args[0].join(String(args[1] || '')) : String(args[0]),
    to_number:   (vm, args) => Number(args[0]) || 0,
    to_string:   (vm, args) => String(args[0]),
    repeat:      (vm, args) => String(args[0]).repeat(args[1] | 0),
  },

  degen_array: {
    arr_new:      (vm) => [],
    arr_len:      (vm, args) => Array.isArray(args[0]) ? args[0].length : 0,
    arr_get:      (vm, args) => Array.isArray(args[0]) ? args[0][args[1] | 0] : null,
    arr_set:      (vm, args) => { if (Array.isArray(args[0])) args[0][args[1] | 0] = args[2]; return args[2]; },
    arr_push:     (vm, args) => { if (Array.isArray(args[0])) args[0].push(args[1]); return args[0] ? args[0].length : 0; },
    arr_pop:      (vm, args) => Array.isArray(args[0]) ? args[0].pop() : null,
    arr_reverse:  (vm, args) => Array.isArray(args[0]) ? args[0].reverse() : args[0],
    arr_slice:    (vm, args) => Array.isArray(args[0]) ? args[0].slice(args[1] | 0, args[2] !== undefined ? args[2] | 0 : undefined) : [],
    arr_contains: (vm, args) => Array.isArray(args[0]) && args[0].includes(args[1]) ? 1 : 0,
    arr_index_of: (vm, args) => Array.isArray(args[0]) ? args[0].indexOf(args[1]) : -1,
    arr_sort:     (vm, args) => Array.isArray(args[0]) ? args[0].sort((a, b) => a - b) : args[0],
  },

  degen_time: {
    now:   (vm) => Date.now(),
    sleep: { async: true, fn: (vm, args) => {
      const ms = args[0] | 0;
      const end = Date.now() + ms;
      while (Date.now() < end) {} // busy wait for terminal
      return null;
    }},
  },

  degen_gfx: {
    screen: (vm, args) => {
      vm.screenWidth = args[0]; vm.screenHeight = args[1];
      vm.screenBuffer = Array.from({ length: args[1] }, () =>
        Array.from({ length: args[0] }, () => ({ ch: ' ', color: 0 }))
      );
      return null;
    },
    draw: (vm, args) => {
      if (vm.screenBuffer) {
        const x = args[0] | 0, y = args[1] | 0;
        if (x >= 0 && x < vm.screenWidth && y >= 0 && y < vm.screenHeight) {
          vm.screenBuffer[y][x] = { ch: String(args[2] || ' ')[0] || ' ', color: (args.length > 3 ? args[3] : 0) | 0 };
        }
      }
      return null;
    },
    flush: (vm) => {
      if (!vm.screenBuffer) return null;
      const ANSI = ['\x1b[0m','\x1b[90m','\x1b[31m','\x1b[91m','\x1b[33m','\x1b[32m','\x1b[34m','\x1b[37m','\x1b[97m','\x1b[35m','\x1b[41m','\x1b[33;2m','\x1b[36m','\x1b[32;2m'];
      process.stdout.write('\x1b[H\x1b[?25l');
      for (const row of vm.screenBuffer) {
        let line = '', curColor = -1;
        for (const cell of row) {
          const c = typeof cell === 'object' ? cell : { ch: cell, color: 0 };
          if (c.color !== curColor) { line += ANSI[c.color] || ANSI[0]; curColor = c.color; }
          line += c.ch;
        }
        line += '\x1b[0m\n';
        process.stdout.write(line);
      }
      return null;
    },
    hires: (vm, args) => {
      vm.hiresWidth = args[0] | 0; vm.hiresHeight = args[1] | 0;
      vm.hiresBuffer = new Uint8Array(vm.hiresWidth * vm.hiresHeight * 3);
      return null;
    },
    pixel: (vm, args) => {
      if (!vm.hiresBuffer) return null;
      const [x, y, r, g, b] = args; const xi = x | 0, yi = y | 0;
      if (xi >= 0 && xi < vm.hiresWidth && yi >= 0 && yi < vm.hiresHeight) {
        const idx = (yi * vm.hiresWidth + xi) * 3;
        vm.hiresBuffer[idx] = r | 0; vm.hiresBuffer[idx + 1] = g | 0; vm.hiresBuffer[idx + 2] = b | 0;
      }
      return null;
    },
    vline: (vm, args) => {
      if (!vm.hiresBuffer) return null;
      const [x, y1, y2, r, g, b] = args;
      const xi = x | 0, ri = r | 0, gi = g | 0, bi = b | 0, w = vm.hiresWidth, h = vm.hiresHeight;
      if (xi < 0 || xi >= w) return null;
      const s = Math.max(0, y1 | 0), e = Math.min(h, y2 | 0);
      for (let y = s; y < e; y++) { const idx = (y * w + xi) * 3; vm.hiresBuffer[idx] = ri; vm.hiresBuffer[idx + 1] = gi; vm.hiresBuffer[idx + 2] = bi; }
      return null;
    },
    rect: (vm, args) => {
      if (!vm.hiresBuffer) return null;
      const [rx, ry, rw, rh, r, g, b] = args;
      const ri = r | 0, gi = g | 0, bi = b | 0, sw = vm.hiresWidth, sh = vm.hiresHeight;
      const x0 = Math.max(0, rx | 0), y0 = Math.max(0, ry | 0), x1 = Math.min(sw, (rx + rw) | 0), y1 = Math.min(sh, (ry + rh) | 0);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const idx = (y * sw + x) * 3; vm.hiresBuffer[idx] = ri; vm.hiresBuffer[idx + 1] = gi; vm.hiresBuffer[idx + 2] = bi; }
      return null;
    },
    hflush: (vm) => {
      if (!vm.hiresBuffer) return null;
      const w = vm.hiresWidth, h = vm.hiresHeight, buf = vm.hiresBuffer;
      let out = '\x1b[H\x1b[?25l';
      for (let y = 0; y < h; y += 2) {
        let prevFg = -1, prevBg = -1;
        for (let x = 0; x < w; x++) {
          const ti = (y * w + x) * 3, bi = (Math.min(y + 1, h - 1) * w + x) * 3;
          const tr = buf[ti], tg = buf[ti + 1], tb = buf[ti + 2];
          const br = buf[bi], bg = buf[bi + 1], bb = buf[bi + 2];
          const fgKey = (tr << 16) | (tg << 8) | tb, bgKey = (br << 16) | (bg << 8) | bb;
          if (fgKey !== prevFg) { out += `\x1b[38;2;${tr};${tg};${tb}m`; prevFg = fgKey; }
          if (bgKey !== prevBg) { out += `\x1b[48;2;${br};${bg};${bb}m`; prevBg = bgKey; }
          out += '\u2580';
        }
        out += '\x1b[0m\n';
      }
      process.stdout.write(out);
      return null;
    },
    clear_screen: (vm) => { process.stdout.write('\x1b[2J\x1b[H\x1b[?25l'); return null; },
  },

  degen_game: {
    game_init: (vm) => {
      vm.maxSteps = Infinity; vm.gameMode = false;
      if (process.stdin.isTTY) {
        try {
          require('child_process').execSync('stty -icanon -echo min 0 time 0', { stdio: 'inherit' });
          vm.gameMode = true;
        } catch(e) {}
        const cleanup = () => { process.stdout.write('\x1b[?25h\x1b[0m'); try { require('child_process').execSync('stty sane', { stdio: 'inherit' }); } catch(e) {} };
        process.on('exit', cleanup);
        process.on('SIGINT', () => { cleanup(); process.exit(0); });
      }
      return null;
    },
    key: (vm) => {
      if (!vm.gameMode) return '';
      const buf = Buffer.alloc(32);
      try {
        const n = require('fs').readSync(0, buf, 0, 32);
        if (n > 0) {
          for (let i = 0; i < n; i++) if (buf[i] === 3) { process.stdout.write('\x1b[?25h\x1b[0m\x1b[2J\x1b[H'); try { require('child_process').execSync('stty sane', { stdio: 'inherit' }); } catch(e) {} process.exit(0); }
          const str = buf.toString('utf8', 0, n);
          if (str.includes('\x1b[A')) return 'up'; if (str.includes('\x1b[B')) return 'down';
          if (str.includes('\x1b[C')) return 'right'; if (str.includes('\x1b[D')) return 'left';
          if (str[0] === ' ') return 'space'; if (str[0] === '\x1b') return 'esc';
          if (str[0] === '\r' || str[0] === '\n') return 'enter';
          return str[0].toLowerCase();
        }
      } catch(e) {}
      return '';
    },
    key_flush: (vm) => {
      if (!vm.gameMode) return null;
      try { require('fs').readSync(0, Buffer.alloc(256), 0, 256); } catch(e) {}
      return null;
    },
    zbuf_init:  (vm, args) => { vm.zbuf = new Float64Array(args[0] | 0); return null; },
    zbuf_set:   (vm, args) => { if (vm.zbuf) vm.zbuf[args[0] | 0] = args[1]; return null; },
    zbuf_get:   (vm, args) => vm.zbuf ? vm.zbuf[args[0] | 0] || 999 : 999,
    enemies_init:  (vm) => { vm.enemies = []; return null; },
    enemies_clear: (vm) => { vm.enemies = []; return null; },
    enemy_add:     (vm, args) => { vm.enemies.push({ x: args[0], y: args[1], hp: args[2], hurtTimer: 0 }); return vm.enemies.length - 1; },
    enemy_count:   (vm) => vm.enemies ? vm.enemies.length : 0,
    enemy_x:       (vm, args) => vm.enemies[args[0] | 0].x,
    enemy_y:       (vm, args) => vm.enemies[args[0] | 0].y,
    enemy_hp:      (vm, args) => vm.enemies[args[0] | 0].hp,
    enemy_alive:   (vm, args) => vm.enemies[args[0] | 0].hp > 0 ? 1 : 0,
    enemy_set_pos: (vm, args) => { const e = vm.enemies[args[0] | 0]; e.x = args[1]; e.y = args[2]; return null; },
    enemy_hurt:    (vm, args) => { const e = vm.enemies[args[0] | 0]; if (e.hp > 0) { e.hp = Math.max(0, e.hp - (args[1] | 0)); e.hurtTimer = 4; } return e.hp; },
    enemy_flash:   (vm, args) => { const e = vm.enemies[args[0] | 0]; if (e.hurtTimer > 0) { e.hurtTimer--; return 1; } return 0; },
  },
};


// ═══════════════════════════════════════════
//  PART 4: VIRTUAL MACHINE — executes bytecode
// ═══════════════════════════════════════════

class CallFrame {
  constructor(chunk, locals, returnAddr) {
    this.chunk = chunk;
    this.ip = 0;
    this.locals = locals;       // parameter values
    this.returnAddr = returnAddr; // { chunk, ip } to resume after return
  }
}

class VM {
  constructor(program) {
    this.mainChunk = program.main;
    this.functions = program.functions;
    this.stack = [];
    this.globals = new Map();
    this.callStack = [];
    this.currentFrame = new CallFrame(this.mainChunk, [], null);
    this.output = [];
    this.maxSteps = 50_000_000; // prevent infinite loops

    // Screen buffer (for games — character mode)
    this.screenWidth = 0;
    this.screenHeight = 0;
    this.screenBuffer = null;

    // Hi-res pixel buffer (half-block rendering, 24-bit color)
    this.hiresWidth = 0;
    this.hiresHeight = 0;
    this.hiresBuffer = null; // Uint8Array, RGB triplets

    // Game input
    this.keyBuffer = null; // null = not initialized

    // Game state (depth buffer + enemies)
    this.zbuf = null;
    this.enemies = null;

    // Module system
    this.nativeFns = new Map();
    const imports = program.imports || [];
    if (imports.length > 0) {
      // Load only imported modules
      for (const mod of imports) {
        if (!STDLIB[mod]) throw new Error(`rugged: unknown module '${mod}'. Available: ${Object.keys(STDLIB).join(', ')}`);
        for (const [name, impl] of Object.entries(STDLIB[mod])) {
          this.nativeFns.set(name, impl);
        }
      }
    } else {
      // Legacy mode: load everything for backwards compatibility
      for (const mod of Object.values(STDLIB)) {
        for (const [name, impl] of Object.entries(mod)) {
          this.nativeFns.set(name, impl);
        }
      }
    }
  }

  run() {
    let steps = 0;

    while (steps++ < this.maxSteps) {
      const frame = this.currentFrame;
      const chunk = frame.chunk;

      if (frame.ip >= chunk.code.length) {
        // End of chunk — return from function or halt
        if (this.callStack.length > 0) {
          this.currentFrame = this.callStack.pop();
          this.stack.push(null); // implicit null return
          continue;
        }
        break;
      }

      const op = chunk.code[frame.ip++];

      switch (op) {
        case Op.CONST: {
          const idx = chunk.code[frame.ip++];
          this.stack.push(chunk.constants[idx]);
          break;
        }

        case Op.POP:
          this.stack.pop();
          break;

        case Op.DUP:
          this.stack.push(this.stack[this.stack.length - 1]);
          break;

        // Arithmetic
        case Op.ADD: {
          const b = this.stack.pop(), a = this.stack.pop();
          this.stack.push(a + b);
          break;
        }
        case Op.SUB: {
          const b = this.stack.pop(), a = this.stack.pop();
          this.stack.push(a - b);
          break;
        }
        case Op.MUL: {
          const b = this.stack.pop(), a = this.stack.pop();
          this.stack.push(a * b);
          break;
        }
        case Op.DIV: {
          const b = this.stack.pop(), a = this.stack.pop();
          this.stack.push(a / b);
          break;
        }
        case Op.MOD: {
          const b = this.stack.pop(), a = this.stack.pop();
          this.stack.push(a % b);
          break;
        }
        case Op.NEG: {
          this.stack.push(-this.stack.pop());
          break;
        }

        // Comparison
        case Op.EQ: {
          const b = this.stack.pop(), a = this.stack.pop();
          this.stack.push(a === b);
          break;
        }
        case Op.GT: {
          const b = this.stack.pop(), a = this.stack.pop();
          this.stack.push(a > b);
          break;
        }
        case Op.LT: {
          const b = this.stack.pop(), a = this.stack.pop();
          this.stack.push(a < b);
          break;
        }
        case Op.GTE: {
          const b = this.stack.pop(), a = this.stack.pop();
          this.stack.push(a >= b);
          break;
        }
        case Op.LTE: {
          const b = this.stack.pop(), a = this.stack.pop();
          this.stack.push(a <= b);
          break;
        }

        // Logic
        case Op.NOT:
          this.stack.push(!this.stack.pop());
          break;
        case Op.AND: {
          const b = this.stack.pop(), a = this.stack.pop();
          this.stack.push(a && b);
          break;
        }
        case Op.OR: {
          const b = this.stack.pop(), a = this.stack.pop();
          this.stack.push(a || b);
          break;
        }

        // Variables
        case Op.LOAD: {
          const nameIdx = chunk.code[frame.ip++];
          const name = chunk.constants[nameIdx];
          if (!this.globals.has(name)) {
            throw new Error(`rugged: undefined variable '${name}'`);
          }
          this.stack.push(this.globals.get(name));
          break;
        }
        case Op.STORE: {
          const nameIdx = chunk.code[frame.ip++];
          const name = chunk.constants[nameIdx];
          const value = this.stack.pop();
          this.globals.set(name, value);
          break;
        }
        case Op.LOAD_LOCAL: {
          const slot = chunk.code[frame.ip++];
          this.stack.push(frame.locals[slot]);
          break;
        }
        case Op.STORE_LOCAL: {
          const slot = chunk.code[frame.ip++];
          frame.locals[slot] = this.stack.pop();
          break;
        }

        // Control flow
        case Op.JMP: {
          frame.ip = chunk.code[frame.ip];
          break;
        }
        case Op.JMP_FALSE: {
          const target = chunk.code[frame.ip++];
          if (!this.stack.pop()) frame.ip = target;
          break;
        }
        case Op.JMP_TRUE: {
          const target = chunk.code[frame.ip++];
          if (this.stack.pop()) frame.ip = target;
          break;
        }

        // Function calls
        case Op.CALL: {
          const argCount = chunk.code[frame.ip++];
          const funcName = this.stack.pop();
          const func = this.functions.get(funcName);

          if (!func) {
            // Fall back to native functions
            const args = [];
            for (let i = 0; i < argCount; i++) args.unshift(this.stack.pop());
            const result = this.callNative(funcName, args);
            this.stack.push(result);
            break;
          }

          const args = [];
          for (let i = 0; i < argCount; i++) args.unshift(this.stack.pop());

          // Save current frame
          this.callStack.push(this.currentFrame);

          // Create new frame
          this.currentFrame = new CallFrame(
            func.chunk,
            args,
            { chunk: frame.chunk, ip: frame.ip }
          );
          break;
        }

        case Op.CALL_BUILTIN: {
          const nameIdx = chunk.code[frame.ip++];
          const name = chunk.constants[nameIdx];

          if (name === '__throw') {
            const msg = this.stack.pop();
            throw new Error(typeof msg === 'string' ? msg : String(msg));
          }

          const argCount = chunk.code[frame.ip++];
          const args = [];
          for (let i = 0; i < argCount; i++) args.unshift(this.stack.pop());

          const result = this.callBuiltin(name, args);
          this.stack.push(result);
          break;
        }

        case Op.RETURN: {
          const returnValue = this.stack.pop();

          if (this.callStack.length === 0) {
            // Return from main — halt
            return this.output;
          }

          // Restore caller frame
          this.currentFrame = this.callStack.pop();
          this.stack.push(returnValue);
          break;
        }

        // IO
        case Op.PRINT: {
          const value = this.stack.pop();
          const str = this.formatValue(value);
          this.output.push(str);
          console.log(str);
          break;
        }

        // Arrays
        case Op.ARRAY: {
          const count = chunk.code[frame.ip++];
          const arr = [];
          for (let i = 0; i < count; i++) arr.unshift(this.stack.pop());
          this.stack.push(arr);
          break;
        }

        case Op.PUSH_ARR: {
          const value = this.stack.pop();
          const arr = this.stack.pop();
          arr.push(value);
          break;
        }

        case Op.MEMBER: {
          const prop = this.stack.pop();
          const obj = this.stack.pop();
          if (Array.isArray(obj) && typeof prop === 'number') {
            this.stack.push(obj[prop]);
          } else if (typeof obj === 'object' && obj !== null) {
            this.stack.push(obj[prop]);
          } else {
            this.stack.push(undefined);
          }
          break;
        }

        case Op.HALT:
          return this.output;

        default:
          throw new Error(`rugged: unknown opcode 0x${op.toString(16)}`);
      }
    }

    if (steps >= this.maxSteps) {
      if (this.screenBuffer || this.hiresBuffer) process.stdout.write('\x1b[?25h');
      throw new Error('rugged: infinite loop detected (50M step limit). touch_grass ser.');
    }

    if (this.screenBuffer || this.hiresBuffer) process.stdout.write('\x1b[?25h');
    return this.output;
  }

  callBuiltin(name, args) {
    switch (name) {
      case 'Math.floor':   return Math.floor(args[0]);
      case 'Math.ceil':    return Math.ceil(args[0]);
      case 'Math.sqrt':    return Math.sqrt(args[0]);
      case 'Math.abs':     return Math.abs(args[0]);
      case 'Math.min':     return Math.min(...args);
      case 'Math.max':     return Math.max(...args);
      case 'Math.pow':     return Math.pow(args[0], args[1]);
      case 'Math.round':   return Math.round(args[0]);
      case 'Math.log':     return Math.log(args[0]);
      case 'Math.sin':     return Math.sin(args[0]);
      case 'Math.cos':     return Math.cos(args[0]);
      case 'Math.tan':     return Math.tan(args[0]);
      case 'Math.atan2':   return Math.atan2(args[0], args[1]);

      // toFixed — called on a number from the stack, but we handle it as builtin
      default: {
        // Handle instance methods like "price.toFixed"
        const dotIdx = name.lastIndexOf('.');
        if (dotIdx !== -1) {
          const method = name.substring(dotIdx + 1);
          // The object should be the first argument for member calls
          // But our compiler puts it as a builtin name... let's handle common patterns
          if (method === 'toFixed') {
            return args[0].toFixed(args[1] || 0);
          }
          if (method === 'toString') {
            return args[0].toString();
          }
          if (method === 'length') {
            return args[0].length;
          }
        }
        throw new Error(`rugged: unknown builtin '${name}'`);
      }
    }
  }

  callNative(name, args) {
    const fn = this.nativeFns.get(name);
    if (fn) {
      // Handle async-flagged functions (like sleep)
      if (fn.async) return fn.fn(this, args);
      return fn(this, args);
    }

    // Legacy fallback for anything not in modules
    switch (name) {
      case 'char_at':
        return typeof args[0] === 'string' ? (args[0][args[1]] || ' ') : ' ';
      case 'str_len':
        return typeof args[0] === 'string' ? args[0].length : 0;

      // Screen buffer
      case 'screen':
        this.screenWidth = args[0];
        this.screenHeight = args[1];
        this.screenBuffer = Array.from({ length: args[1] }, () =>
          Array.from({ length: args[0] }, () => ({ ch: ' ', color: 0 }))
        );
        return null;
      case 'draw':
        // draw(x, y, char) or draw(x, y, char, colorCode)
        if (this.screenBuffer) {
          const x = args[0] | 0, y = args[1] | 0;
          if (x >= 0 && x < this.screenWidth && y >= 0 && y < this.screenHeight) {
            this.screenBuffer[y][x] = {
              ch: String(args[2] || ' ')[0] || ' ',
              color: (args.length > 3 ? args[3] : 0) | 0,
            };
          }
        }
        return null;
      case 'flush': {
        if (!this.screenBuffer) return null;
        // Color palette:
        //  0=reset  1=dark_gray  2=red  3=bright_red  4=yellow
        //  5=green  6=blue  7=white  8=bright_white  9=magenta
        // 10=dark_red_bg  11=brown  12=cyan  13=dark_green
        const ANSI = [
          '\x1b[0m',      // 0: reset
          '\x1b[90m',     // 1: dark gray
          '\x1b[31m',     // 2: red
          '\x1b[91m',     // 3: bright red
          '\x1b[33m',     // 4: yellow
          '\x1b[32m',     // 5: green
          '\x1b[34m',     // 6: blue
          '\x1b[37m',     // 7: white
          '\x1b[97m',     // 8: bright white
          '\x1b[35m',     // 9: magenta
          '\x1b[41m',     // 10: red background
          '\x1b[33;2m',   // 11: dim yellow/brown
          '\x1b[36m',     // 12: cyan
          '\x1b[32;2m',   // 13: dim green
        ];
        process.stdout.write('\x1b[H\x1b[?25l');
        for (const row of this.screenBuffer) {
          let line = '';
          let curColor = -1;
          for (const cell of row) {
            const c = typeof cell === 'object' ? cell : { ch: cell, color: 0 };
            if (c.color !== curColor) {
              line += ANSI[c.color] || ANSI[0];
              curColor = c.color;
            }
            line += c.ch;
          }
          line += '\x1b[0m\n';
          process.stdout.write(line);
        }
        return null;
      }
      case 'clear_screen':
        process.stdout.write('\x1b[2J\x1b[H\x1b[?25l');
        return null;

      // Hi-res pixel buffer (half-block rendering)
      case 'hires': {
        this.hiresWidth = args[0] | 0;
        this.hiresHeight = args[1] | 0;
        this.hiresBuffer = new Uint8Array(this.hiresWidth * this.hiresHeight * 3);
        return null;
      }
      case 'pixel': {
        const [x, y, r, g, b] = args;
        const xi = x | 0, yi = y | 0;
        const w = this.hiresWidth, h = this.hiresHeight;
        if (xi >= 0 && xi < w && yi >= 0 && yi < h) {
          const idx = (yi * w + xi) * 3;
          this.hiresBuffer[idx] = r | 0;
          this.hiresBuffer[idx + 1] = g | 0;
          this.hiresBuffer[idx + 2] = b | 0;
        }
        return null;
      }
      case 'vline': {
        // vline(x, y1, y2, r, g, b) — fast vertical line fill
        const [x, y1, y2, r, g, b] = args;
        const xi = x | 0, ri = r | 0, gi = g | 0, bi = b | 0;
        const w = this.hiresWidth, h = this.hiresHeight;
        if (xi < 0 || xi >= w) return null;
        const startY = Math.max(0, y1 | 0);
        const endY = Math.min(h, y2 | 0);
        for (let y = startY; y < endY; y++) {
          const idx = (y * w + xi) * 3;
          this.hiresBuffer[idx] = ri;
          this.hiresBuffer[idx + 1] = gi;
          this.hiresBuffer[idx + 2] = bi;
        }
        return null;
      }
      case 'rect': {
        // rect(x, y, w, h, r, g, b) — filled rectangle
        const [rx, ry, rw, rh, r, g, b] = args;
        const ri = r | 0, gi = g | 0, bi = b | 0;
        const sw = this.hiresWidth, sh = this.hiresHeight;
        const x0 = Math.max(0, rx | 0), y0 = Math.max(0, ry | 0);
        const x1 = Math.min(sw, (rx + rw) | 0), y1 = Math.min(sh, (ry + rh) | 0);
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const idx = (y * sw + x) * 3;
            this.hiresBuffer[idx] = ri;
            this.hiresBuffer[idx + 1] = gi;
            this.hiresBuffer[idx + 2] = bi;
          }
        }
        return null;
      }
      case 'hflush': {
        // Render pixel buffer using ▀ half-blocks with 24-bit ANSI color
        // Top pixel = foreground color, bottom pixel = background color
        if (!this.hiresBuffer) return null;
        const w = this.hiresWidth, h = this.hiresHeight;
        const buf = this.hiresBuffer;
        let out = '\x1b[H\x1b[?25l';
        for (let y = 0; y < h; y += 2) {
          let prevFg = -1, prevBg = -1;
          for (let x = 0; x < w; x++) {
            const ti = (y * w + x) * 3;
            const bi = (Math.min(y + 1, h - 1) * w + x) * 3;
            const tr = buf[ti], tg = buf[ti + 1], tb = buf[ti + 2];
            const br = buf[bi], bg = buf[bi + 1], bb = buf[bi + 2];
            const fgKey = (tr << 16) | (tg << 8) | tb;
            const bgKey = (br << 16) | (bg << 8) | bb;
            if (fgKey !== prevFg) {
              out += `\x1b[38;2;${tr};${tg};${tb}m`;
              prevFg = fgKey;
            }
            if (bgKey !== prevBg) {
              out += `\x1b[48;2;${br};${bg};${bb}m`;
              prevBg = bgKey;
            }
            out += '\u2580'; // ▀ upper half block
          }
          out += '\x1b[0m\n';
        }
        process.stdout.write(out);
        return null;
      }

      // Game input — synchronous non-blocking stdin via stty + readSync
      case 'game_init': {
        this.maxSteps = Infinity; // no step limit in game mode
        this.gameMode = false;
        if (process.stdin.isTTY) {
          try {
            // -icanon: disable line buffering (not `raw` which kills output processing)
            // -echo: don't print keys. min 0 time 0: non-blocking reads
            require('child_process').execSync(
              'stty -icanon -echo min 0 time 0', { stdio: 'inherit' }
            );
            this.gameMode = true;
          } catch(e) {}

          const self = this;
          const cleanup = () => {
            process.stdout.write('\x1b[?25h\x1b[0m');
            try {
              require('child_process').execSync('stty sane', { stdio: 'inherit' });
            } catch(e) {}
          };
          process.on('exit', cleanup);
          process.on('SIGINT', () => { cleanup(); process.exit(0); });
        }
        return null;
      }
      case 'key': {
        // Synchronous non-blocking read from stdin fd 0
        if (!this.gameMode) return '';
        const buf = Buffer.alloc(32);
        try {
          const n = require('fs').readSync(0, buf, 0, 32);
          if (n > 0) {
            // Check for Ctrl+C
            for (let i = 0; i < n; i++) {
              if (buf[i] === 3) {
                process.stdout.write('\x1b[?25h\x1b[0m\x1b[2J\x1b[H');
                try { require('child_process').execSync('stty sane', { stdio: 'inherit' }); } catch(e) {}
                process.exit(0);
              }
            }
            const str = buf.toString('utf8', 0, n);
            if (str.includes('\x1b[A')) return 'up';
            if (str.includes('\x1b[B')) return 'down';
            if (str.includes('\x1b[C')) return 'right';
            if (str.includes('\x1b[D')) return 'left';
            if (str[0] === ' ') return 'space';
            if (str[0] === '\x1b') return 'esc';
            if (str[0] === '\r' || str[0] === '\n') return 'enter';
            return str[0].toLowerCase();
          }
        } catch(e) {
          // EAGAIN: no data available — expected
        }
        return '';
      }
      case 'key_flush': {
        // Drain any buffered input
        if (!this.gameMode) return null;
        const buf = Buffer.alloc(256);
        try { require('fs').readSync(0, buf, 0, 256); } catch(e) {}
        return null;
      }
      case 'now':
        return Date.now();

      // Depth buffer (for sprite occlusion)
      case 'zbuf_init':
        this.zbuf = new Float64Array(args[0] | 0);
        return null;
      case 'zbuf_set':
        if (this.zbuf) this.zbuf[args[0] | 0] = args[1];
        return null;
      case 'zbuf_get':
        return this.zbuf ? this.zbuf[args[0] | 0] || 999 : 999;

      // Enemies
      case 'enemies_init':
        this.enemies = [];
        return null;
      case 'enemy_add':
        this.enemies.push({ x: args[0], y: args[1], hp: args[2], hurtTimer: 0 });
        return this.enemies.length - 1;
      case 'enemy_count':
        return this.enemies ? this.enemies.length : 0;
      case 'enemy_x':
        return this.enemies[args[0] | 0].x;
      case 'enemy_y':
        return this.enemies[args[0] | 0].y;
      case 'enemy_hp':
        return this.enemies[args[0] | 0].hp;
      case 'enemy_alive':
        return this.enemies[args[0] | 0].hp > 0 ? 1 : 0;
      case 'enemy_set_pos': {
        const en = this.enemies[args[0] | 0];
        en.x = args[1]; en.y = args[2];
        return null;
      }
      case 'enemy_hurt': {
        const en = this.enemies[args[0] | 0];
        if (en.hp > 0) {
          en.hp = Math.max(0, en.hp - (args[1] | 0));
          en.hurtTimer = 4;
        }
        return en.hp;
      }
      case 'enemies_clear':
        this.enemies = [];
        return null;
      case 'enemy_flash': {
        const en = this.enemies[args[0] | 0];
        if (en.hurtTimer > 0) { en.hurtTimer--; return 1; }
        return 0;
      }

      // Timing
      case 'sleep': {
        const end = Date.now() + (args[0] | 0);
        while (Date.now() < end) {} // busy wait — it's a game, ser
        return null;
      }

      default:
        throw new Error(`rugged: unknown native function '${name}'`);
    }
  }

  formatValue(value) {
    if (value === null || value === undefined) return 'probably_nothing';
    if (Array.isArray(value)) return '[' + value.map(v => this.formatValue(v)).join(', ') + ']';
    return String(value);
  }
}


// ═══════════════════════════════════════════
//  PART 5: DISASSEMBLER — for --dump flag
// ═══════════════════════════════════════════

function disassemble(program) {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     BROLANG BYTECODE DISASSEMBLY         ║');
  console.log('╚══════════════════════════════════════════╝');

  // Disassemble functions first
  for (const [name, func] of program.functions) {
    console.log(`\n── based ${name}(${func.params.join(', ')}) ──`);
    disassembleChunk(func.chunk);
  }

  console.log('\n── <main> ──');
  disassembleChunk(program.main);
}

function disassembleChunk(chunk) {
  console.log(`  Constants: [${chunk.constants.map((c, i) => `${i}:${JSON.stringify(c)}`).join(', ')}]`);
  console.log('  Code:');

  let i = 0;
  while (i < chunk.code.length) {
    const op = chunk.code[i];
    const name = OP_NAMES[op] || `UNKNOWN(0x${op.toString(16)})`;
    let line = `    ${String(i).padStart(4, '0')}  ${name.padEnd(14)}`;

    // Opcodes with operands
    if ([Op.CONST, Op.LOAD, Op.STORE, Op.LOAD_LOCAL, Op.STORE_LOCAL].includes(op)) {
      const operand = chunk.code[i + 1];
      const val = [Op.LOAD_LOCAL, Op.STORE_LOCAL].includes(op)
        ? `slot[${operand}]`
        : JSON.stringify(chunk.constants[operand]);
      line += ` ${operand} (${val})`;
      i += 2;
    } else if ([Op.JMP, Op.JMP_FALSE, Op.JMP_TRUE].includes(op)) {
      line += ` -> ${chunk.code[i + 1]}`;
      i += 2;
    } else if (op === Op.CALL || op === Op.ARRAY) {
      line += ` (${chunk.code[i + 1]} args)`;
      i += 2;
    } else if (op === Op.CALL_BUILTIN) {
      const nameIdx = chunk.code[i + 1];
      const builtinName = chunk.constants[nameIdx];
      if (builtinName === '__throw') {
        line += ` ${builtinName}`;
        i += 2;
      } else {
        const argc = chunk.code[i + 2];
        line += ` ${builtinName} (${argc} args)`;
        i += 3;
      }
    } else {
      i++;
    }

    console.log(line);
  }
}


// ═══════════════════════════════════════════
//  CLI
// ═══════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const file = process.argv[2];
const flag = process.argv[3];

if (!file) {
  console.log('');
  console.log('  BroLang VM v0.2.0 — Compiled Crypto-Native Language');
  console.log('  ====================================================');
  console.log('');
  console.log('  Usage:');
  console.log('    node brolang-vm.js <file.bro>           Compile & run');
  console.log('    node brolang-vm.js <file.bro> --dump     Show bytecode');
  console.log('    node brolang-vm.js <file.bro> --ast      Show AST');
  console.log('');
  console.log('  NFA. DYOR.');
  console.log('');
  process.exit(0);
}

const filePath = path.resolve(file);
if (!fs.existsSync(filePath)) {
  console.error(`rug pull: file not found — ${file}`);
  process.exit(1);
}

const source = fs.readFileSync(filePath, 'utf-8');

try {
  // Lex
  const tokens = lex(source);

  if (flag === '--tokens') {
    tokens.filter(t => t.type !== TokenType.NEWLINE).forEach(t =>
      console.log(`  ${t.type.padEnd(16)} ${JSON.stringify(t.value)}`));
    process.exit(0);
  }

  // Parse
  const parser = new Parser(tokens);
  const ast = parser.parse();

  if (flag === '--ast') {
    console.log(JSON.stringify(ast, null, 2));
    process.exit(0);
  }

  // Compile
  const compiler = new Compiler();
  const program = compiler.compile(ast);

  if (flag === '--dump') {
    disassemble(program);
    process.exit(0);
  }

  // Execute
  const vm = new VM(program);
  vm.run();

} catch (err) {
  console.error(`\n  rugged: ${err.message}\n`);
  if (flag === '--debug') console.error(err.stack);
  process.exit(1);
}
