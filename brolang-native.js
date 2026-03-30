#!/usr/bin/env node

/**
 * BroLang Native Compiler v0.1.0
 *
 * Compiles BroLang directly to x86-64 machine code.
 * Emits a standalone Linux ELF binary. No C. No linker. No runtime.
 * Just raw bytes.
 *
 * Usage:
 *   node brolang-native.js program.bro         # produces program.elf
 *   node brolang-native.js program.bro -o out   # custom output name
 *   chmod +x program.elf && ./program.elf
 *
 * NFA. DYOR.
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
//  Import the shared frontend (lexer/parser)
//  from brolang-vm.js by extracting the classes
// ═══════════════════════════════════════════

// We reuse the lexer and parser from the VM.
const vmSrc = fs.readFileSync(path.join(__dirname, 'brolang-vm.js'), 'utf-8');

// Extract the frontend (lexer + parser + AST types) up to the stdlib
const frontendEnd = vmSrc.indexOf('// ═══════════════════════════════════════════\n//  PART 3.5');
const frontendSrc = vmSrc.substring(0, frontendEnd);

// Load into an isolated scope via Function constructor
// Strip the shebang and comments that break new Function()
const cleanSrc = frontendSrc.replace(/^#!.*\n/, '').replace(/^\/\*\*[\s\S]*?\*\/\n/, '');
const frontendFn = new Function(cleanSrc + '\nreturn { TokenType, KEYWORDS, Token, lex, N, Parser };');
const { TokenType, KEYWORDS, Token, lex, N, Parser } = frontendFn();


// ═══════════════════════════════════════════
//  x86-64 CODE EMITTER
// ═══════════════════════════════════════════

class X86Emitter {
  constructor() {
    this.code = [];       // machine code bytes
    this.data = [];       // data section bytes
    this.dataLabels = {}; // name -> offset in data section
    this.patches = [];    // { codeOffset, type, label }
  }

  // ── Emit raw bytes ──
  emit(...bytes) {
    for (const b of bytes) this.code.push(b & 0xFF);
  }

  emitLE32(val) {
    this.emit(val & 0xFF, (val >> 8) & 0xFF, (val >> 16) & 0xFF, (val >> 24) & 0xFF);
  }

  emitLE64(val) {
    // For 64-bit, handle as two 32-bit parts
    const lo = val & 0xFFFFFFFF;
    const hi = Math.floor(val / 0x100000000) & 0xFFFFFFFF;
    this.emitLE32(lo);
    this.emitLE32(hi);
  }

  pos() { return this.code.length; }

  // ── Data section ──
  addString(str) {
    const key = 'str_' + this.data.length;
    const offset = this.data.length;
    for (let i = 0; i < str.length; i++) {
      this.data.push(str.charCodeAt(i));
    }
    this.data.push(0x0A); // newline
    this.dataLabels[key] = { offset, length: str.length + 1 };
    return key;
  }

  addRawString(str) {
    const key = 'raw_' + this.data.length;
    const offset = this.data.length;
    for (let i = 0; i < str.length; i++) {
      this.data.push(str.charCodeAt(i));
    }
    this.data.push(0); // null terminator
    this.dataLabels[key] = { offset, length: str.length };
    return key;
  }

  // ── x86-64 instructions ──

  // mov rax, imm64
  movRAX(imm) {
    this.emit(0x48, 0xB8);
    this.emitLE64(imm);
  }

  // mov rdi, imm64
  movRDI(imm) {
    this.emit(0x48, 0xBF);
    this.emitLE64(imm);
  }

  // mov rsi, imm64
  movRSI(imm) {
    this.emit(0x48, 0xBE);
    this.emitLE64(imm);
  }

  // mov rdx, imm64
  movRDX(imm) {
    this.emit(0x48, 0xBA);
    this.emitLE64(imm);
  }

  // mov rdi, imm32 (zero-extended)
  movRDI32(imm) {
    this.emit(0xBF);
    this.emitLE32(imm);
  }

  // mov rax, imm32 (zero-extended)
  movRAX32(imm) {
    this.emit(0xB8);
    this.emitLE32(imm);
  }

  // mov rdx, imm32
  movRDX32(imm) {
    this.emit(0xBA);
    this.emitLE32(imm);
  }

  // syscall
  syscall() {
    this.emit(0x0F, 0x05);
  }

  // push rax
  pushRAX() { this.emit(0x50); }
  // pop rax
  popRAX() { this.emit(0x58); }
  // push rdi
  pushRDI() { this.emit(0x57); }
  // pop rdi
  popRDI() { this.emit(0x5F); }
  // push rsi
  pushRSI() { this.emit(0x56); }
  // pop rsi
  popRSI() { this.emit(0x5E); }
  // push rbx
  pushRBX() { this.emit(0x53); }
  // pop rbx
  popRBX() { this.emit(0x5B); }

  // add rax, rbx
  addRAX_RBX() { this.emit(0x48, 0x01, 0xD8); }
  // sub rax, rbx (rax = rax - rbx)
  subRAX_RBX() { this.emit(0x48, 0x29, 0xD8); }
  // imul rax, rbx
  imulRAX_RBX() { this.emit(0x48, 0x0F, 0xAF, 0xC3); }

  // cqo (sign extend rax into rdx:rax for division)
  cqo() { this.emit(0x48, 0x99); }
  // idiv rbx (rax = rdx:rax / rbx, rdx = remainder)
  idivRBX() { this.emit(0x48, 0xF7, 0xFB); }

  // cmp rax, rbx
  cmpRAX_RBX() { this.emit(0x48, 0x39, 0xD8); }

  // xor rax, rax
  xorRAX() { this.emit(0x48, 0x31, 0xC0); }

  // je rel32 — returns patch offset
  je() {
    this.emit(0x0F, 0x84);
    const patchOff = this.pos();
    this.emitLE32(0);
    return patchOff;
  }

  // jne rel32
  jne() {
    this.emit(0x0F, 0x85);
    const patchOff = this.pos();
    this.emitLE32(0);
    return patchOff;
  }

  // jl rel32 (signed less than)
  jl() {
    this.emit(0x0F, 0x8C);
    const patchOff = this.pos();
    this.emitLE32(0);
    return patchOff;
  }

  // jg rel32 (signed greater than)
  jg() {
    this.emit(0x0F, 0x8F);
    const patchOff = this.pos();
    this.emitLE32(0);
    return patchOff;
  }

  // jle rel32
  jle() {
    this.emit(0x0F, 0x8E);
    const patchOff = this.pos();
    this.emitLE32(0);
    return patchOff;
  }

  // jge rel32
  jge() {
    this.emit(0x0F, 0x8D);
    const patchOff = this.pos();
    this.emitLE32(0);
    return patchOff;
  }

  // jmp rel32
  jmp() {
    this.emit(0xE9);
    const patchOff = this.pos();
    this.emitLE32(0);
    return patchOff;
  }

  // Patch a relative jump
  patchJump(patchOff) {
    const target = this.pos();
    const rel = target - (patchOff + 4); // relative to after the 4-byte offset
    this.code[patchOff] = rel & 0xFF;
    this.code[patchOff + 1] = (rel >> 8) & 0xFF;
    this.code[patchOff + 2] = (rel >> 16) & 0xFF;
    this.code[patchOff + 3] = (rel >> 24) & 0xFF;
  }

  // ── Syscall helpers ──

  // sys_write(fd, buf, len)
  sysWrite(fd, strLabel) {
    // Will be patched with actual data address after layout
    this.movRAX32(1);          // sys_write
    this.movRDI32(fd);         // fd
    // mov rsi, addr (to be patched)
    this.emit(0x48, 0xBE);
    const patchOff = this.pos();
    this.emitLE64(0);
    this.patches.push({ codeOffset: patchOff, label: strLabel, type: 'addr' });
    // mov rdx, len
    this.movRDX32(this.dataLabels[strLabel].length);
    this.syscall();
  }

  // sys_exit(code)
  sysExit(code) {
    this.movRAX32(60);         // sys_exit
    this.movRDI32(code);       // exit code
    this.syscall();
  }
}


// ═══════════════════════════════════════════
//  NATIVE COMPILER — AST → x86-64
// ═══════════════════════════════════════════

class NativeCompiler {
  constructor() {
    this.asm = new X86Emitter();
    this.globals = {};      // name -> data label
    this.intGlobals = {};   // name -> index in BSS (integer globals)
    this.bssCount = 0;
  }

  compile(ast) {
    // First pass: collect all string constants and shill calls
    // For this initial version, we support:
    // - hodl/ser with string/number literals
    // - shill with string expressions (concatenation via pre-computing)
    // - wagmi/ngmi/fr
    // - to_the_moon/gg
    // - basic arithmetic on integers

    // Compile the program
    for (const node of ast.body) {
      if (node.type === 'Import') continue; // skip APE_INTO for native
      this.compileNode(node);
    }

    // Exit cleanly
    this.asm.sysExit(0);

    return this.buildELF();
  }

  compileNode(node) {
    switch (node.type) {
      case 'ConstDecl':
      case 'VarDecl': {
        if (node.value.type === 'StrLit') {
          const label = this.asm.addString(node.value.value);
          this.globals[node.name] = { type: 'string', label };
        } else if (node.value.type === 'NumLit') {
          this.globals[node.name] = { type: 'number', value: node.value.value };
        }
        break;
      }

      case 'Print': {
        this.compilePrint(node.value);
        break;
      }

      case 'If': {
        // Compile condition into rax
        this.compileExpr(node.condition);
        // rax has result; test if truthy
        this.asm.pushRAX();
        this.asm.popRAX();
        // cmp rax, 0
        this.asm.emit(0x48, 0x83, 0xF8, 0x00); // cmp rax, 0
        const jumpFalse = this.asm.je(); // jump to else/end if false

        // Compile consequent
        for (const s of node.consequent) this.compileNode(s);

        if (node.alternate.length > 0) {
          const jumpEnd = this.asm.jmp();
          this.asm.patchJump(jumpFalse);
          for (const s of node.alternate) this.compileNode(s);
          this.asm.patchJump(jumpEnd);
        } else {
          this.asm.patchJump(jumpFalse);
        }
        break;
      }

      case 'While': {
        const loopStart = this.asm.pos();
        this.compileExpr(node.condition);
        this.asm.emit(0x48, 0x83, 0xF8, 0x00); // cmp rax, 0
        const jumpEnd = this.asm.je();

        for (const s of node.body) this.compileNode(s);

        // Jump back to loop start
        const backJump = this.asm.jmp();
        // Patch the back jump
        const rel = loopStart - (this.asm.pos());
        this.asm.code[backJump] = rel & 0xFF;
        this.asm.code[backJump + 1] = (rel >> 8) & 0xFF;
        this.asm.code[backJump + 2] = (rel >> 16) & 0xFF;
        this.asm.code[backJump + 3] = (rel >> 24) & 0xFF;

        this.asm.patchJump(jumpEnd);
        break;
      }

      case 'Assign': {
        if (node.value.type === 'NumLit') {
          this.globals[node.name] = { type: 'number', value: node.value.value };
        } else if (node.value.type === 'BinOp') {
          // Evaluate and store
          this.compileExpr(node.value);
          // Store rax value — for simplicity, update the globals record
          this.globals[node.name] = { type: 'register', value: 'rax' };
        }
        break;
      }

      case 'FuncDecl':
        // Functions not supported in native v0.1 — skip
        break;

      default:
        break;
    }
  }

  compilePrint(expr) {
    if (expr.type === 'StrLit') {
      const label = this.asm.addString(expr.value);
      this.asm.sysWrite(1, label);
    } else if (expr.type === 'Ident') {
      const g = this.globals[expr.name];
      if (g && g.type === 'string') {
        this.asm.sysWrite(1, g.label);
      } else if (g && g.type === 'number') {
        // Convert number to string and print
        const label = this.asm.addString(String(g.value));
        this.asm.sysWrite(1, label);
      }
    } else if (expr.type === 'BinOp' && expr.op === '+') {
      // String concatenation — flatten and print each part
      this.compilePrintConcat(expr);
    } else if (expr.type === 'NumLit') {
      const label = this.asm.addString(String(expr.value));
      this.asm.sysWrite(1, label);
    }
  }

  compilePrintConcat(node) {
    // Flatten a + b + c into parts and print each
    const parts = this.flattenConcat(node);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let label;
      if (part.type === 'StrLit') {
        if (i === parts.length - 1) {
          label = this.asm.addString(part.value); // last part gets newline
        } else {
          label = this.asm.addRawString(part.value);
          // Print raw (no newline)
          this.asm.movRAX32(1);
          this.asm.movRDI32(1);
          this.asm.emit(0x48, 0xBE);
          const patchOff = this.asm.pos();
          this.asm.emitLE64(0);
          this.asm.patches.push({ codeOffset: patchOff, label, type: 'addr' });
          this.asm.movRDX32(this.asm.dataLabels[label].length);
          this.asm.syscall();
          continue;
        }
      } else if (part.type === 'NumLit') {
        if (i === parts.length - 1) {
          label = this.asm.addString(String(part.value));
        } else {
          label = this.asm.addRawString(String(part.value));
          this.asm.movRAX32(1);
          this.asm.movRDI32(1);
          this.asm.emit(0x48, 0xBE);
          const patchOff = this.asm.pos();
          this.asm.emitLE64(0);
          this.asm.patches.push({ codeOffset: patchOff, label, type: 'addr' });
          this.asm.movRDX32(this.asm.dataLabels[label].length);
          this.asm.syscall();
          continue;
        }
      } else if (part.type === 'Ident') {
        const g = this.globals[part.name];
        if (g && g.type === 'string') { label = g.label; }
        else if (g && g.type === 'number') {
          if (i === parts.length - 1) {
            label = this.asm.addString(String(g.value));
          } else {
            label = this.asm.addRawString(String(g.value));
            this.asm.movRAX32(1);
            this.asm.movRDI32(1);
            this.asm.emit(0x48, 0xBE);
            const patchOff = this.asm.pos();
            this.asm.emitLE64(0);
            this.asm.patches.push({ codeOffset: patchOff, label, type: 'addr' });
            this.asm.movRDX32(this.asm.dataLabels[label].length);
            this.asm.syscall();
            continue;
          }
        } else {
          continue;
        }
      } else {
        continue;
      }
      if (label) this.asm.sysWrite(1, label);
    }
  }

  flattenConcat(node) {
    if (node.type === 'BinOp' && node.op === '+') {
      return [...this.flattenConcat(node.left), ...this.flattenConcat(node.right)];
    }
    return [node];
  }

  compileExpr(node) {
    // Evaluate expression, result in rax
    switch (node.type) {
      case 'NumLit':
        this.asm.movRAX(node.value | 0);
        break;

      case 'BoolLit':
        this.asm.movRAX(node.value ? 1 : 0);
        break;

      case 'Ident': {
        const g = this.globals[node.name];
        if (g && g.type === 'number') {
          this.asm.movRAX(g.value | 0);
        } else {
          this.asm.movRAX(0);
        }
        break;
      }

      case 'BinOp': {
        // Evaluate left into rax, push, evaluate right into rax, pop rbx
        this.compileExpr(node.left);
        this.asm.pushRAX();
        this.compileExpr(node.right);
        // rax = right, stack top = left
        // Move right to rbx, pop left to rax
        this.asm.emit(0x48, 0x89, 0xC3); // mov rbx, rax
        this.asm.popRAX();                 // rax = left

        switch (node.op) {
          case '+': this.asm.addRAX_RBX(); break;
          case '-': this.asm.subRAX_RBX(); break;
          case '*': this.asm.imulRAX_RBX(); break;
          case '/': this.asm.cqo(); this.asm.idivRBX(); break;
          case '%': this.asm.cqo(); this.asm.idivRBX(); this.asm.emit(0x48, 0x89, 0xD0); break; // mov rax, rdx
          case '==':
            this.asm.cmpRAX_RBX();
            this.asm.xorRAX();
            this.asm.emit(0x0F, 0x94, 0xC0); // sete al
            break;
          case '>':
            this.asm.cmpRAX_RBX();
            this.asm.xorRAX();
            this.asm.emit(0x0F, 0x9F, 0xC0); // setg al
            break;
          case '<':
            this.asm.cmpRAX_RBX();
            this.asm.xorRAX();
            this.asm.emit(0x0F, 0x9C, 0xC0); // setl al
            break;
          case '>=':
            this.asm.cmpRAX_RBX();
            this.asm.xorRAX();
            this.asm.emit(0x0F, 0x9D, 0xC0); // setge al
            break;
          case '<=':
            this.asm.cmpRAX_RBX();
            this.asm.xorRAX();
            this.asm.emit(0x0F, 0x9E, 0xC0); // setle al
            break;
          case '&&':
            // rax && rbx: both non-zero
            this.asm.emit(0x48, 0x83, 0xF8, 0x00); // cmp rax, 0
            this.asm.xorRAX();
            this.asm.emit(0x0F, 0x95, 0xC0);       // setne al
            this.asm.emit(0x48, 0x83, 0xFB, 0x00); // cmp rbx, 0
            this.asm.pushRAX();
            this.asm.xorRAX();
            this.asm.emit(0x0F, 0x95, 0xC0);       // setne al
            this.asm.popRBX();
            this.asm.emit(0x48, 0x21, 0xD8);       // and rax, rbx
            break;
          case '||':
            this.asm.emit(0x48, 0x09, 0xD8);       // or rax, rbx
            this.asm.emit(0x48, 0x83, 0xF8, 0x00); // cmp rax, 0
            this.asm.xorRAX();
            this.asm.emit(0x0F, 0x95, 0xC0);       // setne al
            break;
        }
        break;
      }

      case 'UnaryOp':
        this.compileExpr(node.operand);
        if (node.op === '-') {
          this.asm.emit(0x48, 0xF7, 0xD8); // neg rax
        } else if (node.op === '!') {
          this.asm.emit(0x48, 0x83, 0xF8, 0x00); // cmp rax, 0
          this.asm.xorRAX();
          this.asm.emit(0x0F, 0x94, 0xC0); // sete al
        }
        break;

      default:
        this.asm.movRAX(0);
    }
  }

  // ═══════════════════════════════════════════
  //  ELF BINARY BUILDER
  // ═══════════════════════════════════════════

  buildELF() {
    const codeBytes = Buffer.from(this.asm.code);
    const dataBytes = Buffer.from(this.asm.data);

    // Simple ELF layout: single LOAD segment containing everything
    // ELF header (64) + 1 program header (56) = 120 bytes of headers
    // Then code, then data (16-byte aligned)
    // All mapped as RWX in one segment (simple, works)

    const ELF_HEADER_SIZE = 64;
    const PHDR_SIZE = 56;
    const HEADERS_SIZE = ELF_HEADER_SIZE + PHDR_SIZE;

    const BASE_ADDR = 0x400000;
    const CODE_OFFSET = HEADERS_SIZE;
    const CODE_VADDR = BASE_ADDR + CODE_OFFSET;
    const CODE_SIZE = codeBytes.length;

    const DATA_OFFSET = ((CODE_OFFSET + CODE_SIZE) + 15) & ~15;
    const DATA_VADDR = BASE_ADDR + DATA_OFFSET;
    const DATA_SIZE = dataBytes.length;
    const TOTAL_SIZE = DATA_OFFSET + DATA_SIZE;

    // Patch data address references in code
    for (const patch of this.asm.patches) {
      if (patch.type === 'addr') {
        const labelInfo = this.asm.dataLabels[patch.label];
        const addr = DATA_VADDR + labelInfo.offset;
        const off = patch.codeOffset;
        codeBytes[off + 0] = addr & 0xFF;
        codeBytes[off + 1] = (addr >> 8) & 0xFF;
        codeBytes[off + 2] = (addr >> 16) & 0xFF;
        codeBytes[off + 3] = (addr >> 24) & 0xFF;
        codeBytes[off + 4] = 0;
        codeBytes[off + 5] = 0;
        codeBytes[off + 6] = 0;
        codeBytes[off + 7] = 0;
      }
    }

    const elf = Buffer.alloc(TOTAL_SIZE, 0);

    // ── ELF Header ──
    elf[0] = 0x7F; elf[1] = 0x45; elf[2] = 0x4C; elf[3] = 0x46;
    elf[4] = 2; elf[5] = 1; elf[6] = 1; elf[7] = 0;
    elf.writeUInt16LE(2, 16);              // ET_EXEC
    elf.writeUInt16LE(0x3E, 18);           // EM_X86_64
    elf.writeUInt32LE(1, 20);              // version
    elf.writeBigUInt64LE(BigInt(CODE_VADDR), 24);  // entry point
    elf.writeBigUInt64LE(BigInt(ELF_HEADER_SIZE), 32); // phoff
    elf.writeBigUInt64LE(0n, 40);          // shoff
    elf.writeUInt32LE(0, 48);              // flags
    elf.writeUInt16LE(ELF_HEADER_SIZE, 52);// ehsize
    elf.writeUInt16LE(PHDR_SIZE, 54);      // phentsize
    elf.writeUInt16LE(1, 56);              // phnum
    elf.writeUInt16LE(0, 58);              // shentsize
    elf.writeUInt16LE(0, 60);              // shnum
    elf.writeUInt16LE(0, 62);              // shstrndx

    // ── Program Header: single LOAD (RWX) ──
    let pos = ELF_HEADER_SIZE;
    elf.writeUInt32LE(1, pos);             // PT_LOAD
    elf.writeUInt32LE(7, pos + 4);         // PF_R | PF_W | PF_X
    elf.writeBigUInt64LE(0n, pos + 8);     // offset
    elf.writeBigUInt64LE(BigInt(BASE_ADDR), pos + 16); // vaddr
    elf.writeBigUInt64LE(BigInt(BASE_ADDR), pos + 24); // paddr
    elf.writeBigUInt64LE(BigInt(TOTAL_SIZE), pos + 32); // filesz
    elf.writeBigUInt64LE(BigInt(TOTAL_SIZE), pos + 40); // memsz
    elf.writeBigUInt64LE(BigInt(0x200000), pos + 48);  // align (2MB for compat)

    // ── Code ──
    codeBytes.copy(elf, CODE_OFFSET);

    // ── Data ──
    Buffer.from(dataBytes).copy(elf, DATA_OFFSET);

    return elf;
  }
}


// ═══════════════════════════════════════════
//  CLI
// ═══════════════════════════════════════════

const file = process.argv[2];
const outputFlag = process.argv.indexOf('-o');
let outputFile;

if (!file) {
  console.log('');
  console.log('  BroLang Native Compiler v0.1.0');
  console.log('  ================================');
  console.log('  Compiles BroLang → x86-64 → ELF binary');
  console.log('');
  console.log('  Usage:');
  console.log('    node brolang-native.js <file.bro>           Compile to ELF');
  console.log('    node brolang-native.js <file.bro> -o name   Custom output');
  console.log('');
  console.log('  Then:');
  console.log('    chmod +x output.elf && ./output.elf');
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

if (outputFlag !== -1 && process.argv[outputFlag + 1]) {
  outputFile = process.argv[outputFlag + 1];
} else {
  outputFile = path.basename(file, '.bro') + '.elf';
}

const source = fs.readFileSync(filePath, 'utf-8');

try {
  // Frontend: lex + parse
  const tokens = lex(source);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  // Backend: compile to x86-64
  const compiler = new NativeCompiler();
  const elfBinary = compiler.compile(ast);

  // Write ELF
  fs.writeFileSync(outputFile, elfBinary);
  fs.chmodSync(outputFile, 0o755);

  const codeSize = compiler.asm.code.length;
  const dataSize = compiler.asm.data.length;
  console.log(`  compiled: ${file}`);
  console.log(`  output:   ${outputFile}`);
  console.log(`  code:     ${codeSize} bytes (${codeSize} bytes of x86-64)`);
  console.log(`  data:     ${dataSize} bytes`);
  console.log(`  total:    ${elfBinary.length} bytes`);
  console.log(`  arch:     x86-64 / Linux ELF`);
  console.log(`  runtime:  none (raw syscalls)`);
  console.log('');
  console.log(`  Run: ./${outputFile}`);

} catch (err) {
  console.error(`\n  rugged: ${err.message}\n`);
  if (process.argv.includes('--debug')) console.error(err.stack);
  process.exit(1);
}
