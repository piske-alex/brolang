#!/usr/bin/env node

/**
 * BroLang Transpiler v0.1.0
 *
 * Transpiles BroLang (.bro files) to JavaScript and executes them.
 * The world's first crypto-native programming language. NFA. DYOR.
 */

const fs = require('fs');
const path = require('path');

function transpile(source) {
  const lines = source.split('\n');
  const output = [];
  let inProgram = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();
    const indent = line.match(/^(\s*)/)[1];

    // Skip empty lines
    if (!trimmed) {
      output.push('');
      continue;
    }

    // Comments
    if (trimmed.startsWith('nfa ')) {
      output.push(`${indent}// ${trimmed.slice(4)}`);
      continue;
    }

    // Program start/end
    if (trimmed === 'gm') {
      output.push(`// ========== gm ser ==========`);
      output.push(`// transpiled from BroLang — NFA, DYOR`);
      output.push('');
      inProgram = true;
      continue;
    }
    if (trimmed === 'gn') {
      output.push('');
      output.push(`// ========== gn ser ==========`);
      inProgram = false;
      continue;
    }

    if (!inProgram) continue;

    // Function definition: based name(args)
    const funcMatch = trimmed.match(/^based\s+(\w+)\s*\(([^)]*)\)/);
    if (funcMatch) {
      output.push(`${indent}function ${funcMatch[1]}(${funcMatch[2]}) {`);
      continue;
    }

    // End block (function, loop)
    if (trimmed === 'gg') {
      output.push(`${indent}}`);
      continue;
    }

    // Return
    if (trimmed.startsWith('paper_hands ')) {
      const expr = transpileExpr(trimmed.slice(12));
      output.push(`${indent}return ${expr};`);
      continue;
    }

    // If
    const ifMatch = trimmed.match(/^wagmi\s+(.+)/);
    if (ifMatch) {
      const condition = transpileExpr(ifMatch[1]);
      output.push(`${indent}if (${condition}) {`);
      continue;
    }

    // Else
    if (trimmed === 'ngmi') {
      output.push(`${indent}} else {`);
      continue;
    }

    // End if
    if (trimmed === 'fr') {
      output.push(`${indent}}`);
      continue;
    }

    // While loop: to_the_moon condition
    const whileMatch = trimmed.match(/^to_the_moon\s+(.+)/);
    if (whileMatch) {
      const condition = transpileExpr(whileMatch[1]);
      output.push(`${indent}while (${condition}) {`);
      continue;
    }

    // Break
    if (trimmed === 'touch_grass') {
      output.push(`${indent}break;`);
      continue;
    }

    // Print
    if (trimmed.startsWith('shill ')) {
      const expr = transpileExpr(trimmed.slice(6));
      output.push(`${indent}console.log(${expr});`);
      continue;
    }

    // Throw
    if (trimmed.startsWith('rug ')) {
      const expr = transpileExpr(trimmed.slice(4));
      output.push(`${indent}throw new Error(${expr});`);
      continue;
    }

    // Constant: hodl NAME is expr
    const constMatch = trimmed.match(/^hodl\s+(\w+)\s+is\s+(.+)/);
    if (constMatch) {
      const expr = transpileExpr(constMatch[2]);
      output.push(`${indent}const ${constMatch[1]} = ${expr};`);
      continue;
    }

    // Variable declaration/assignment: ser name is expr
    const letMatch = trimmed.match(/^ser\s+(\w+)\s+is\s+(.+)/);
    if (letMatch) {
      const expr = transpileExpr(letMatch[2]);
      output.push(`${indent}let ${letMatch[1]} = ${expr};`);
      continue;
    }

    // Reassignment: name is expr
    const assignMatch = trimmed.match(/^(\w+)\s+is\s+(.+)/);
    if (assignMatch) {
      const expr = transpileExpr(assignMatch[2]);
      output.push(`${indent}${assignMatch[1]} = ${expr};`);
      continue;
    }

    // Array push: ape_in array value
    const pushMatch = trimmed.match(/^ape_in\s+(\w+)\s+(.+)/);
    if (pushMatch) {
      const expr = transpileExpr(pushMatch[2]);
      output.push(`${indent}${pushMatch[1]}.push(${expr});`);
      continue;
    }

    // Fallback: try to transpile as expression statement
    output.push(`${indent}${transpileExpr(trimmed)};`);
  }

  return output.join('\n');
}

function transpileExpr(expr) {
  // Handle parenthesized sub-expressions first
  expr = expr.replace(/\(([^()]+)\)/g, (_, inner) => `(${transpileInnerExpr(inner)})`);
  return transpileInnerExpr(expr);
}

function transpileInnerExpr(expr) {
  // String literals — leave them alone (non-greedy so "a" plus "b" isn't matched as one string)
  if (expr.match(/^"[^"]*"$/) || expr.match(/^'[^']*'$/)) return expr;

  // Remove lfg keyword — it's just a vibe, the call syntax does the work
  expr = expr.replace(/\blfg\s+/g, '');

  // Replace keywords with operators (order matters — longer first)
  const replacements = [
    [/\bdivided_by\b/g, '/'],
    [/\bgreater_than\b/g, '>'],
    [/\bless_than\b/g, '<'],
    [/\bequals\b/g, '==='],
    [/\btimes\b/g, '*'],
    [/\bplus\b/g, '+'],
    [/\bminus\b/g, '-'],
    [/\bmod\b/g, '%'],
    [/\bgte\b/g, '>='],
    [/\blte\b/g, '<='],
    [/\band\b/g, '&&'],
    [/\bor\b/g, '||'],
    [/\bnot\b/g, '!'],
    [/\bprobably_nothing\b/g, 'null'],
    [/\bfew\b/g, 'true'],
    [/\bcope\b/g, 'false'],
  ];

  for (const [pattern, replacement] of replacements) {
    expr = expr.replace(pattern, replacement);
  }

  return expr.trim();
}

// ── CLI ──

const file = process.argv[2];
const flag = process.argv[3];

if (!file) {
  console.log('');
  console.log('  BroLang v0.1.0 — The Crypto-Native Programming Language');
  console.log('  =========================================================');
  console.log('');
  console.log('  Usage:');
  console.log('    node brolang.js <file.bro>           Run a .bro file');
  console.log('    node brolang.js <file.bro> --emit     Show transpiled JS');
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
const js = transpile(source);

if (flag === '--emit') {
  console.log(js);
} else {
  try {
    eval(js);
  } catch (err) {
    console.error(`\n  rugged: ${err.message}\n`);
    process.exit(1);
  }
}
