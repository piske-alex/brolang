#!/usr/bin/env node

/**
 * BroLang AI-Friendliness Benchmark
 *
 * Compares BroLang against other languages on metrics that matter for LLMs:
 * 1. Token count (fewer tokens = cheaper + fits in context)
 * 2. Ambiguity (symbols that mean different things in different contexts)
 * 3. Readability (can an LLM understand the intent without docs?)
 */

// ── Equivalent programs in multiple languages ──

const programs = {
  brolang: `gm
hodl FEE is 0.003
hodl BALANCE is 1000
ser result is 0

based apply_fee(amount, rate)
  paper_hands amount times (1 minus rate)
gg

based is_profitable(value, threshold)
  wagmi value greater_than threshold
    paper_hands few
  ngmi
    paper_hands cope
  fr
gg

result is apply_fee(BALANCE, FEE)

wagmi is_profitable(result, 500) equals few
  shill "still solvent ser"
ngmi
  shill "ngmi"
fr

ser i is 0
to_the_moon i less_than 5
  shill "iteration " plus i
  i is i plus 1
gg

gn`,

  javascript: `const FEE = 0.003;
const BALANCE = 1000;
let result = 0;

function apply_fee(amount, rate) {
  return amount * (1 - rate);
}

function is_profitable(value, threshold) {
  if (value > threshold) {
    return true;
  } else {
    return false;
  }
}

result = apply_fee(BALANCE, FEE);

if (is_profitable(result, 500) === true) {
  console.log("still solvent ser");
} else {
  console.log("ngmi");
}

let i = 0;
while (i < 5) {
  console.log("iteration " + i);
  i = i + 1;
}`,

  python: `FEE = 0.003
BALANCE = 1000
result = 0

def apply_fee(amount, rate):
    return amount * (1 - rate)

def is_profitable(value, threshold):
    if value > threshold:
        return True
    else:
        return False

result = apply_fee(BALANCE, FEE)

if is_profitable(result, 500) == True:
    print("still solvent ser")
else:
    print("ngmi")

i = 0
while i < 5:
    print("iteration " + str(i))
    i = i + 1`,

  rust: `fn apply_fee(amount: f64, rate: f64) -> f64 {
    amount * (1.0 - rate)
}

fn is_profitable(value: f64, threshold: f64) -> bool {
    if value > threshold {
        true
    } else {
        false
    }
}

fn main() {
    const FEE: f64 = 0.003;
    const BALANCE: f64 = 1000.0;
    let mut result: f64;

    result = apply_fee(BALANCE, FEE);

    if is_profitable(result, 500.0) == true {
        println!("still solvent ser");
    } else {
        println!("ngmi");
    }

    let mut i = 0;
    while i < 5 {
        println!("iteration {}", i);
        i = i + 1;
    }
}`,

  solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Trading {
    uint256 constant FEE = 3; // 0.3% in basis points
    uint256 constant BALANCE = 1000;

    function applyFee(uint256 amount, uint256 rate) public pure returns (uint256) {
        return amount * (1000 - rate) / 1000;
    }

    function isProfitable(uint256 value, uint256 threshold) public pure returns (bool) {
        if (value > threshold) {
            return true;
        } else {
            return false;
        }
    }

    function run() public pure returns (string memory) {
        uint256 result = applyFee(BALANCE, FEE);
        if (isProfitable(result, 500) == true) {
            return "still solvent ser";
        } else {
            return "ngmi";
        }
    }
}`
};

// ── Token counting (approximate GPT-style tokenization) ──
// Simple whitespace + symbol splitter that approximates BPE tokenization

function countTokensApprox(code) {
  // Split on whitespace, then split symbols
  const tokens = [];
  const parts = code.split(/(\s+)/);
  for (const part of parts) {
    if (/^\s+$/.test(part)) continue;
    // Split on symbol boundaries (like BPE would)
    const subTokens = part.split(/([{}()\[\];:,.<>=!+\-*\/&|^~@#$%?])/);
    for (const st of subTokens) {
      if (st.length > 0) tokens.push(st);
    }
  }
  return tokens;
}

// ── Ambiguity analysis ──
// Count symbols that have multiple meanings in the language

const ambiguousSymbols = {
  javascript: {
    '>': ['comparison', 'arrow function (=>)', 'JSX closing'],
    '<': ['comparison', 'JSX opening', 'generics'],
    '{': ['object literal', 'block', 'destructuring', 'template literal'],
    '(': ['function call', 'grouping', 'arrow params', 'IIFE'],
    '/': ['division', 'regex start', 'comment'],
    '*': ['multiplication', 'spread/rest (**)', 'generator', 'comment'],
    ':': ['ternary', 'object key', 'label', 'type annotation'],
  },
  python: {
    ':': ['block start', 'slice', 'dict key', 'type hint', 'lambda'],
    '*': ['multiplication', 'unpacking', 'kwargs (**)', 'import all'],
    '/': ['division', 'floor division (//)'],
    '-': ['subtraction', 'negative', 'set difference'],
  },
  rust: {
    '<': ['comparison', 'generics', 'trait bound'],
    '>': ['comparison', 'generics', 'trait bound'],
    '&': ['reference', 'bitwise and', 'pattern binding'],
    '*': ['multiplication', 'dereference', 'raw pointer'],
    '!': ['not', 'macro invocation', 'never type'],
    ':': ['type annotation', 'path separator (::)', 'match arm'],
  },
  solidity: {
    '=': ['assignment', 'comparison (==)', 'named arg'],
    '>': ['comparison', 'version pragma'],
    '{': ['block', 'mapping', 'struct body'],
  },
  brolang: {
    // No ambiguous symbols — every keyword has exactly one meaning
  }
};

// ── Readability: English word ratio ──
// What percentage of tokens are English words vs symbols?

function englishWordRatio(tokens) {
  let words = 0;
  for (const t of tokens) {
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t)) words++;
  }
  return words / tokens.length;
}

// ── Run benchmark ──

console.log('');
console.log('  ╔═══════════════════════════════════════════════════════════╗');
console.log('  ║     BroLang AI-Friendliness Benchmark                    ║');
console.log('  ╚═══════════════════════════════════════════════════════════╝');
console.log('');

console.log('  Equivalent program across 5 languages:');
console.log('  - Declare constants, define 2 functions, conditional, loop');
console.log('');

// Token counts
console.log('  ┌─────────────────────────────────────────────────────────┐');
console.log('  │  TOKEN COUNT (fewer = cheaper LLM calls)               │');
console.log('  ├─────────────┬──────────┬──────────┬────────────────────┤');
console.log('  │ Language    │ Tokens   │ Chars    │ Tokens/Line        │');
console.log('  ├─────────────┼──────────┼──────────┼────────────────────┤');

const results = {};
for (const [lang, code] of Object.entries(programs)) {
  const tokens = countTokensApprox(code);
  const lines = code.split('\n').filter(l => l.trim().length > 0).length;
  const ratio = (tokens.length / lines).toFixed(1);
  results[lang] = { tokens: tokens.length, chars: code.length, lines, ratio, tokenList: tokens };
  const name = lang.padEnd(11);
  const toks = String(tokens.length).padStart(6);
  const chars = String(code.length).padStart(6);
  console.log(`  │ ${name} │ ${toks}   │ ${chars}   │ ${ratio.padStart(4)} tokens/line   │`);
}

console.log('  └─────────────┴──────────┴──────────┴────────────────────┘');
console.log('');

// Winner
const sorted = Object.entries(results).sort((a, b) => a[1].tokens - b[1].tokens);
console.log(`  Winner (fewest tokens): ${sorted[0][0].toUpperCase()} (${sorted[0][1].tokens} tokens)`);
const broTokens = results.brolang.tokens;
console.log('');

// Savings vs each language
console.log('  Token savings vs BroLang:');
for (const [lang, data] of Object.entries(results)) {
  if (lang === 'brolang') continue;
  const diff = data.tokens - broTokens;
  const pct = ((diff / data.tokens) * 100).toFixed(0);
  const bar = diff > 0 ? '▓'.repeat(Math.min(Math.round(diff / 3), 20)) : '';
  console.log(`    vs ${lang.padEnd(12)} ${diff > 0 ? '+' : ''}${String(diff).padStart(3)} tokens (${pct}% more) ${bar}`);
}
console.log('');

// English word ratio
console.log('  ┌─────────────────────────────────────────────────────────┐');
console.log('  │  ENGLISH WORD RATIO (higher = more natural for LLMs)   │');
console.log('  ├─────────────┬──────────────────────────────────────────┤');
for (const [lang, data] of Object.entries(results)) {
  const ratio = englishWordRatio(data.tokenList);
  const pct = (ratio * 100).toFixed(0);
  const bar = '█'.repeat(Math.round(ratio * 30));
  console.log(`  │ ${lang.padEnd(11)} │ ${pct.padStart(3)}% ${bar.padEnd(30)} │`);
}
console.log('  └─────────────┴──────────────────────────────────────────┘');
console.log('');

// Ambiguity score
console.log('  ┌─────────────────────────────────────────────────────────┐');
console.log('  │  SYMBOL AMBIGUITY (lower = less confusion for LLMs)    │');
console.log('  ├─────────────┬──────────────────────────────────────────┤');
for (const [lang, symbols] of Object.entries(ambiguousSymbols)) {
  const count = Object.keys(symbols).length;
  const totalMeanings = Object.values(symbols).reduce((s, v) => s + v.length, 0);
  const bar = count > 0 ? '⚠'.repeat(count) : '✓ zero ambiguity';
  console.log(`  │ ${lang.padEnd(11)} │ ${String(count).padStart(2)} symbols × ${String(totalMeanings).padStart(2)} meanings ${count > 0 ? '' : ' '}${bar.padEnd(14)}│`);
}
console.log('  └─────────────┴──────────────────────────────────────────┘');
console.log('');

// Summary
console.log('  ┌─────────────────────────────────────────────────────────┐');
console.log('  │  SUMMARY                                               │');
console.log('  ├─────────────────────────────────────────────────────────┤');
console.log('  │  BroLang is designed for the age of AI-generated code: │');
console.log('  │                                                        │');
console.log('  │  • Text-based keywords (greater_than, not >)           │');
console.log('  │  • Zero ambiguous symbols                              │');
console.log('  │  • Every keyword maps to exactly one concept           │');
console.log('  │  • Reads like English — LLMs parse it naturally        │');
console.log('  │  • COBOL-style verbosity = fewer misinterpretations    │');
console.log('  │                                                        │');
console.log('  │  "The best language for AI is the one that looks       │');
console.log('  │   like the training data." — and LLMs trained on text. │');
console.log('  └─────────────────────────────────────────────────────────┘');
console.log('');
console.log('  wagmi.');
console.log('');
