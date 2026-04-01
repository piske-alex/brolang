#!/usr/bin/env node

/**
 * BroLang Live Generation Benchmark
 *
 * Actually calls Claude API to generate code, then compiles it.
 * Measures real pass@1 rate across languages.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node benchmark-live.js
 *   ANTHROPIC_API_KEY=sk-... node benchmark-live.js --runs 5
 *   ANTHROPIC_API_KEY=sk-... node benchmark-live.js --model claude-sonnet-4-20250514
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('  Set ANTHROPIC_API_KEY env var');
  process.exit(1);
}

const RUNS = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--runs') || '3');
const MODEL = process.argv.find((_, i, a) => a[i - 1] === '--model') || 'claude-sonnet-4-20250514';

// ═══════════════════════════════════════════
//  TASK DEFINITIONS
// ═══════════════════════════════════════════

const tasks = [
  {
    id: 'T1',
    name: 'Hello World',
    prompt: 'Write a program that prints "gm ser" to stdout.',
  },
  {
    id: 'T2',
    name: 'Variables & Math',
    prompt: 'Write a program that declares variables a=10 and b=3, then prints their sum, product, and quotient on separate lines.',
  },
  {
    id: 'T3',
    name: 'Conditional',
    prompt: 'Write a program that declares x=42, then prints "big" if x is greater than 50, otherwise prints "small".',
  },
  {
    id: 'T4',
    name: 'While Loop',
    prompt: 'Write a program that uses a while loop to print numbers 0 through 4, one per line.',
  },
  {
    id: 'T5',
    name: 'Function',
    prompt: 'Write a program that defines a function called "double" that takes one parameter and returns it multiplied by 2. Then print the result of calling double(21).',
  },
  {
    id: 'T6',
    name: 'Recursive Function',
    prompt: 'Write a program that defines a recursive factorial function, then prints factorial(10).',
  },
  {
    id: 'T7',
    name: 'Nested Conditionals',
    prompt: 'Write a program that classifies a number n=15: print "large" if n>100, "medium" if n>10, otherwise "small". Use nested if/else.',
  },
  {
    id: 'T8',
    name: 'Accumulator',
    prompt: 'Write a program that computes the sum of integers from 1 to 100 using a while loop, then prints "sum = " followed by the result.',
  },
  {
    id: 'T9',
    name: 'FizzBuzz',
    prompt: 'Write FizzBuzz for numbers 1 to 20. Print "FizzBuzz" if divisible by 15, "Fizz" if by 3, "Buzz" if by 5, otherwise the number.',
  },
  {
    id: 'T10',
    name: 'DeFi Fee Calc',
    prompt: 'Write a program that defines a function get_amount_out(amount_in, reserve_in, reserve_out) that calculates a constant-product AMM swap output with a 0.3% fee (30 basis points out of 10000). Print the result of swapping 1000 with reserves of 50000 and 75000.',
  },
];

// ═══════════════════════════════════════════
//  LANGUAGE SPECS (system prompts)
// ═══════════════════════════════════════════

const langSpecs = {
  brolang: `You are writing BroLang code. Here is the complete language spec:

A program starts with "gm" and ends with "gn".
Variables: "ser x is 5" (mutable), "hodl PI is 3.14" (constant).
Functions: "based name(params) ... gg"
If/else: "wagmi condition ... ngmi ... fr"
While loop: "to_the_moon condition ... gg"
Print: "shill value" or "shill \\"text\\" plus var"
Return: "paper_hands value"
Arithmetic operators: plus (+), minus (-), times (*), divided_by (/), mod (%)
Comparison: equals (===), greater_than (>), less_than (<), gte (>=), lte (<=)
Logic: and (&&), or (||), not (!)
Assignment: "ser x is expr" to declare, "x is expr" to reassign
Boolean: few (true), cope (false)

Example:
gm
based add(a, b)
  paper_hands a plus b
gg
ser result is add(3, 4)
shill "result = " plus result
gn

Output ONLY the code. No explanation. No markdown fences.`,

  javascript: `You are writing JavaScript code. Output ONLY the code. No explanation. No markdown fences.`,

  python: `You are writing Python code. Output ONLY the code. No explanation. No markdown fences.`,

  rust: `You are writing Rust code with a main() function. Output ONLY the code. No explanation. No markdown fences.`,

  solidity: `You are writing Solidity 0.8+ code as a single contract with a public function. Output ONLY the code. No explanation. No markdown fences.`,
};

// ═══════════════════════════════════════════
//  VALIDATORS (compile/parse each language)
// ═══════════════════════════════════════════

// Load BroLang compiler
let broLex, broParser;
try {
  const vmSrc = fs.readFileSync(path.join(__dirname, 'brolang-vm.js'), 'utf-8');
  const end = vmSrc.indexOf('// ═══════════════════════════════════════════\n//  PART 3.5');
  const clean = vmSrc.substring(0, end).replace(/^#!.*\n/, '').replace(/^\/\*\*[\s\S]*?\*\/\n/, '');
  const fn = new Function(clean + '\nreturn { lex, Parser };');
  const r = fn();
  broLex = r.lex;
  broParser = r.Parser;
} catch (e) {
  console.error('  Failed to load BroLang compiler:', e.message);
  process.exit(1);
}

function validateBrolang(code) {
  try {
    const tokens = broLex(code);
    const parser = new broParser(tokens);
    parser.parse();
    return { valid: true };
  } catch (e) {
    return { valid: false, error: classifyError(e.message, 'brolang') };
  }
}

function validateJavascript(code) {
  try {
    new Function(code);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: classifyError(e.message, 'javascript') };
  }
}

function validatePython(code) {
  try {
    const { execSync } = require('child_process');
    const tmp = '/tmp/brolang_bench_py.py';
    fs.writeFileSync(tmp, code);
    execSync(`python3 -c "import ast,sys; ast.parse(open('${tmp}').read())"`, { timeout: 5000, stdio: 'pipe' });
    return { valid: true };
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : e.message;
    return { valid: false, error: classifyError(stderr, 'python') };
  }
}

function validateRust(code) {
  try {
    const { execSync } = require('child_process');
    const tmp = '/tmp/brolang_bench_rust.rs';
    fs.writeFileSync(tmp, code);
    execSync(`rustc --edition 2021 ${tmp} -o /tmp/brolang_bench_rust_out 2>&1`, { timeout: 15000 });
    return { valid: true };
  } catch (e) {
    const out = e.stdout ? e.stdout.toString() : '';
    const err = e.stderr ? e.stderr.toString() : '';
    return { valid: false, error: classifyError(out + err || e.message, 'rust') };
  }
}

function validateSolidity(code) {
  // Check if solc is available, otherwise just syntax-check for basic structure
  try {
    const { execSync } = require('child_process');
    const tmp = '/tmp/brolang_bench_sol.sol';
    fs.writeFileSync(tmp, code);
    execSync(`solc --bin ${tmp} 2>&1`, { timeout: 10000, stdio: 'pipe' });
    return { valid: true };
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : (e.stdout ? e.stdout.toString() : e.message);
    // If solc not found, do basic structure check
    if (stderr.includes('not found') || stderr.includes('ENOENT')) {
      // Basic Solidity syntax check
      if (code.includes('contract') && code.includes('function') && code.includes('{') && code.includes('}')) {
        return { valid: true, note: 'solc not available, basic structure check only' };
      }
      return { valid: false, error: 'missing_contract_structure' };
    }
    return { valid: false, error: classifyError(stderr, 'solidity') };
  }
}

const validators = {
  brolang: validateBrolang,
  javascript: validateJavascript,
  python: validatePython,
  rust: validateRust,
  solidity: validateSolidity,
};

// ═══════════════════════════════════════════
//  ERROR CLASSIFICATION
// ═══════════════════════════════════════════

function classifyError(msg, lang) {
  const m = msg.toLowerCase();
  if (m.includes('indent') || m.includes('unexpected indent') || m.includes('tabulation')) return 'indentation';
  if (m.includes('semicolon') || m.includes('expected `;`') || m.includes("expected ';'")) return 'missing_semicolon';
  if (m.includes('unexpected end') || m.includes('expected }') || m.includes('unclosed') || m.includes('expected `}`')) return 'missing_closure';
  if (m.includes('type') || m.includes('mismatched') || m.includes('cannot find type') || m.includes('expected type')) return 'type_error';
  if (m.includes('not defined') || m.includes('undeclared') || m.includes('cannot find') || m.includes('not found in scope')) return 'undefined_reference';
  if (m.includes('borrow') || m.includes('lifetime') || m.includes('moved') || m.includes('cannot move')) return 'ownership_lifetime';
  if (m.includes('expected') || m.includes('unexpected token') || m.includes('syntax')) return 'syntax';
  if (m.includes('import') || m.includes('module')) return 'import';
  return 'other';
}

// ═══════════════════════════════════════════
//  CLAUDE API CALL
// ═══════════════════════════════════════════

async function callClaude(systemPrompt, userPrompt) {
  const https = require('https');
  const body = JSON.stringify({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.content && j.content[0]) {
            let text = j.content[0].text.trim();
            // Strip markdown fences if present
            text = text.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
            resolve({ text, input_tokens: j.usage?.input_tokens, output_tokens: j.usage?.output_tokens });
          } else {
            reject(new Error(j.error?.message || 'No content'));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ═══════════════════════════════════════════
//  MAIN BENCHMARK
// ═══════════════════════════════════════════

async function main() {
  const languages = ['brolang', 'javascript', 'python', 'rust', 'solidity'];

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  BroLang Live Generation Benchmark                              ║');
  console.log(`║  Model: ${MODEL.padEnd(54)}║`);
  console.log(`║  Tasks: ${tasks.length}, Runs per task: ${RUNS}, Languages: ${languages.length}${' '.repeat(27)}║`);
  console.log(`║  Total API calls: ${tasks.length * RUNS * languages.length}${' '.repeat(46)}║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Results storage
  const results = {};
  for (const lang of languages) {
    results[lang] = {
      pass: 0, fail: 0, total: 0,
      errors: {},
      input_tokens: 0, output_tokens: 0,
      per_task: {},
    };
  }

  const totalCalls = tasks.length * RUNS * languages.length;
  let completed = 0;

  for (const task of tasks) {
    process.stdout.write(`  ${task.id}: ${task.name.padEnd(20)}`);

    for (const lang of languages) {
      let taskPass = 0, taskFail = 0;

      for (let run = 0; run < RUNS; run++) {
        try {
          const response = await callClaude(langSpecs[lang], task.prompt);
          const code = response.text;
          const validation = validators[lang](code);

          results[lang].total++;
          results[lang].input_tokens += response.input_tokens || 0;
          results[lang].output_tokens += response.output_tokens || 0;

          if (validation.valid) {
            results[lang].pass++;
            taskPass++;
          } else {
            results[lang].fail++;
            taskFail++;
            const errType = validation.error;
            results[lang].errors[errType] = (results[lang].errors[errType] || 0) + 1;
          }
        } catch (e) {
          results[lang].total++;
          results[lang].fail++;
          taskFail++;
          results[lang].errors['api_error'] = (results[lang].errors['api_error'] || 0) + 1;
        }

        completed++;
        // Rate limit: small delay between calls
        await new Promise(r => setTimeout(r, 500));
      }

      results[lang].per_task[task.id] = { pass: taskPass, fail: taskFail };
      const marker = taskPass === RUNS ? '✓' : taskFail === RUNS ? '✗' : '~';
      process.stdout.write(` ${marker}`);
    }
    console.log('');
  }

  // ═══════════════════════════════════════════
  //  RESULTS
  // ═══════════════════════════════════════════

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  // Table 1: pass@1 rate
  console.log('Table 1: pass@1 Rate (compilable on first attempt)');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`${'Language'.padEnd(12)} ${'Pass'.padStart(6)} ${'Fail'.padStart(6)} ${'Total'.padStart(6)} ${'pass@1'.padStart(8)}  Bar`);
  console.log('───────────────────────────────────────────────────────────────');

  for (const lang of languages) {
    const r = results[lang];
    const rate = r.total > 0 ? (r.pass / r.total * 100).toFixed(1) : '0.0';
    const bar = '█'.repeat(Math.round(r.pass / r.total * 30));
    console.log(`${lang.padEnd(12)} ${String(r.pass).padStart(6)} ${String(r.fail).padStart(6)} ${String(r.total).padStart(6)} ${(rate + '%').padStart(8)}  ${bar}`);
  }
  console.log('');

  // Table 2: Error distribution
  console.log('Table 2: Error Distribution');
  console.log('───────────────────────────────────────────────────────────────');
  const allErrorTypes = new Set();
  for (const lang of languages) {
    for (const e of Object.keys(results[lang].errors)) allErrorTypes.add(e);
  }
  if (allErrorTypes.size > 0) {
    console.log(`${'Error Type'.padEnd(22)} ${languages.map(l => l.substring(0, 5).padStart(7)).join('')}`);
    console.log('───────────────────────────────────────────────────────────────');
    for (const errType of allErrorTypes) {
      let row = errType.padEnd(22);
      for (const lang of languages) {
        const count = results[lang].errors[errType] || 0;
        row += (count > 0 ? String(count) : '·').padStart(7);
      }
      console.log(row);
    }
  } else {
    console.log('  No errors! All generations compiled successfully.');
  }
  console.log('');

  // Table 3: Per-task breakdown
  console.log('Table 3: Per-Task pass@1');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`${'Task'.padEnd(7)} ${'Name'.padEnd(20)} ${languages.map(l => l.substring(0, 5).padStart(7)).join('')}`);
  console.log('───────────────────────────────────────────────────────────────');
  for (const task of tasks) {
    let row = task.id.padEnd(7) + task.name.substring(0, 20).padEnd(20);
    for (const lang of languages) {
      const pt = results[lang].per_task[task.id];
      const rate = pt ? `${pt.pass}/${pt.pass + pt.fail}` : '?';
      row += rate.padStart(7);
    }
    console.log(row);
  }
  console.log('');

  // Table 4: Token usage
  console.log('Table 4: API Token Usage');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`${'Language'.padEnd(12)} ${'Input Tokens'.padStart(14)} ${'Output Tokens'.padStart(15)} ${'Total'.padStart(10)}`);
  console.log('───────────────────────────────────────────────────────────────');
  for (const lang of languages) {
    const r = results[lang];
    console.log(`${lang.padEnd(12)} ${String(r.input_tokens).padStart(14)} ${String(r.output_tokens).padStart(15)} ${String(r.input_tokens + r.output_tokens).padStart(10)}`);
  }
  console.log('');

  // Save JSON
  const jsonOut = {
    metadata: {
      model: MODEL,
      runs_per_task: RUNS,
      tasks: tasks.length,
      languages: languages,
      timestamp: new Date().toISOString(),
    },
    results,
  };
  fs.writeFileSync('benchmark-live-results.json', JSON.stringify(jsonOut, null, 2));
  console.log('Full results: benchmark-live-results.json');
  console.log('');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
