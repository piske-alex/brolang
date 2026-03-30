#!/usr/bin/env node

/**
 * BroLang SBF Compiler v0.1.0
 *
 * Compiles BroLang to Solana BPF (SBF) bytecode.
 * Emits a deployable Solana program as an ELF binary.
 *
 * SBF = Solana BPF = eBPF variant with 64-bit registers.
 *
 * Register convention:
 *   r0  = return value
 *   r1  = arg1 / pointer to input on entrypoint
 *   r2  = arg2
 *   r3  = arg3
 *   r4  = arg4
 *   r5  = arg5
 *   r10 = frame pointer (read-only)
 *
 * Instruction encoding: 8 bytes fixed width
 *   [opcode:8][dst_reg:4][src_reg:4][offset:16][imm:32]
 *
 * Syscalls (via CALL instruction):
 *   sol_log_         = hash("log")
 *   sol_log_64_      = hash("log_64")
 *   sol_alloc_free_  = hash("sol_alloc_free_")
 *
 * NFA. DYOR. Not audited. Do not deploy with real funds.
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
//  SBF INSTRUCTION ENCODING
// ═══════════════════════════════════════════

// BPF instruction classes
const BPF_LD    = 0x00;
const BPF_LDX   = 0x01;
const BPF_ST    = 0x02;
const BPF_STX   = 0x03;
const BPF_ALU   = 0x04;
const BPF_JMP   = 0x05;
const BPF_ALU64 = 0x07;

// ALU operations
const BPF_ADD  = 0x00;
const BPF_SUB  = 0x10;
const BPF_MUL  = 0x20;
const BPF_DIV  = 0x30;
const BPF_OR   = 0x40;
const BPF_AND  = 0x50;
const BPF_MOV  = 0xB0;
const BPF_NEG  = 0x80;
const BPF_MOD  = 0x90;
const BPF_XOR  = 0xA0;

// Source modifiers
const BPF_K   = 0x00; // immediate
const BPF_X   = 0x08; // register

// Jump operations
const BPF_JA   = 0x00;
const BPF_JEQ  = 0x10;
const BPF_JGT  = 0x20;
const BPF_JGE  = 0x30;
const BPF_JSET = 0x40;
const BPF_JNE  = 0x50;
const BPF_JLT  = 0xA0;
const BPF_JLE  = 0xB0;
const BPF_CALL = 0x80;
const BPF_EXIT = 0x90;

// Memory sizes
const BPF_W  = 0x00; // 32-bit
const BPF_H  = 0x08; // 16-bit
const BPF_B  = 0x10; // 8-bit
const BPF_DW = 0x18; // 64-bit

// Memory modes
const BPF_MEM = 0x60;

// Registers
const R0 = 0, R1 = 1, R2 = 2, R3 = 3, R4 = 4, R5 = 5;
const R6 = 6, R7 = 7, R8 = 8, R9 = 9, R10 = 10;

// Solana syscall hashes (murmur3-based, precomputed)
// These are the function hashes that Solana's runtime recognizes
const SYSCALL_SOL_LOG         = 0x7ef088ca; // sol_log_
const SYSCALL_SOL_LOG_64      = 0x7317b434; // sol_log_64_
const SYSCALL_SOL_ALLOC_FREE  = 0x83f00e8f; // sol_alloc_free_

class SBFEmitter {
  constructor() {
    this.instructions = []; // array of 8-byte instruction buffers
    this.rodata = [];       // read-only data bytes
    this.rodataLabels = {}; // label -> { offset, length }
  }

  // Encode one BPF instruction (8 bytes)
  encodeInsn(opcode, dst, src, offset, imm) {
    const buf = Buffer.alloc(8);
    buf[0] = opcode & 0xFF;
    buf[1] = ((src & 0xF) << 4) | (dst & 0xF);
    buf.writeInt16LE(offset & 0xFFFF, 2);
    buf.writeInt32LE(imm | 0, 4);
    return buf;
  }

  emit(opcode, dst, src, offset, imm) {
    this.instructions.push(this.encodeInsn(opcode, dst, src, offset, imm));
  }

  pos() { return this.instructions.length; }

  // ── ALU64 instructions ──

  // mov64 dst, imm
  movImm(dst, imm) {
    this.emit(BPF_ALU64 | BPF_MOV | BPF_K, dst, 0, 0, imm);
  }

  // mov64 dst, src
  movReg(dst, src) {
    this.emit(BPF_ALU64 | BPF_MOV | BPF_X, dst, src, 0, 0);
  }

  // add64 dst, imm
  addImm(dst, imm) {
    this.emit(BPF_ALU64 | BPF_ADD | BPF_K, dst, 0, 0, imm);
  }

  // add64 dst, src
  addReg(dst, src) {
    this.emit(BPF_ALU64 | BPF_ADD | BPF_X, dst, src, 0, 0);
  }

  // sub64 dst, imm
  subImm(dst, imm) {
    this.emit(BPF_ALU64 | BPF_SUB | BPF_K, dst, 0, 0, imm);
  }

  // mul64 dst, src
  mulReg(dst, src) {
    this.emit(BPF_ALU64 | BPF_MUL | BPF_X, dst, src, 0, 0);
  }

  // div64 dst, src
  divReg(dst, src) {
    this.emit(BPF_ALU64 | BPF_DIV | BPF_X, dst, src, 0, 0);
  }

  // ── Load/Store ──

  // ldxdw dst, [src + offset] (load 64-bit from memory)
  loadDW(dst, src, offset) {
    this.emit(BPF_LDX | BPF_DW | BPF_MEM, dst, src, offset, 0);
  }

  // stxdw [dst + offset], src (store 64-bit to memory)
  storeDW(dst, src, offset) {
    this.emit(BPF_STX | BPF_DW | BPF_MEM, dst, src, offset, 0);
  }

  // ldxw dst, [src + offset] (load 32-bit)
  loadW(dst, src, offset) {
    this.emit(BPF_LDX | BPF_W | BPF_MEM, dst, src, offset, 0);
  }

  // stxw [dst + offset], src (store 32-bit)
  storeW(dst, src, offset) {
    this.emit(BPF_STX | BPF_W | BPF_MEM, dst, src, offset, 0);
  }

  // lddw dst, imm64 — load 64-bit immediate (takes 2 instruction slots)
  loadImm64(dst, imm64) {
    const lo = imm64 & 0xFFFFFFFF;
    const hi = (imm64 / 0x100000000) | 0;
    // First instruction: opcode=0x18 (lddw), dst, src=0, off=0, imm=lo32
    this.emit(BPF_LD | BPF_DW, dst, 0, 0, lo);
    // Second instruction: opcode=0, dst=0, src=0, off=0, imm=hi32
    this.emit(0x00, 0, 0, 0, hi);
  }

  // ── Jumps ──

  // ja offset (unconditional jump)
  ja(offset) {
    this.emit(BPF_JMP | BPF_JA, 0, 0, offset, 0);
  }

  // jeq dst, imm, offset
  jeqImm(dst, imm, offset) {
    this.emit(BPF_JMP | BPF_JEQ | BPF_K, dst, 0, offset, imm);
  }

  // jne dst, imm, offset
  jneImm(dst, imm, offset) {
    this.emit(BPF_JMP | BPF_JNE | BPF_K, dst, 0, offset, imm);
  }

  // ── Syscalls ──

  // call syscall_hash
  syscall(hash) {
    this.emit(BPF_JMP | BPF_CALL, 0, 0, 0, hash);
  }

  // exit
  exit() {
    this.emit(BPF_JMP | BPF_EXIT, 0, 0, 0, 0);
  }

  // ── Read-only data ──

  addString(str) {
    const key = `str_${this.rodata.length}`;
    const offset = this.rodata.length;
    for (let i = 0; i < str.length; i++) {
      this.rodata.push(str.charCodeAt(i));
    }
    this.rodataLabels[key] = { offset, length: str.length };
    return key;
  }

  // ── Helpers ──

  // sol_log(msg_ptr, msg_len)
  // r1 = pointer to string, r2 = length
  emitSolLog(strLabel) {
    // Load address of string in rodata — will be patched
    const info = this.rodataLabels[strLabel];
    // r1 = address (placeholder, patched in ELF builder)
    this.loadImm64(R1, 0); // placeholder — will be patched
    this._patches = this._patches || [];
    this._patches.push({
      instrIndex: this.instructions.length - 2, // the lddw instruction (2 slots)
      label: strLabel,
      type: 'rodata_addr'
    });
    // r2 = length
    this.movImm(R2, info.length);
    // call sol_log_
    this.syscall(SYSCALL_SOL_LOG);
  }

  // Emit a complete program that just logs messages and exits
  emitLogProgram(messages) {
    // Entrypoint: r1 = pointer to input (program_id, accounts, instr_data)
    // For a simple log program, we ignore input and just log.

    // Save callee-saved registers
    this.movReg(R6, R1); // save input pointer

    for (const msg of messages) {
      const label = this.addString(msg);
      this.emitSolLog(label);
    }

    // Return success (r0 = 0)
    this.movImm(R0, 0);
    this.exit();
  }

  getCode() {
    return Buffer.concat(this.instructions);
  }
}


// ═══════════════════════════════════════════
//  SOLANA ELF BUILDER
// ═══════════════════════════════════════════

function buildSolanaELF(emitter) {
  const code = emitter.getCode();
  const rodata = Buffer.from(emitter.rodata);

  // Solana ELF layout:
  // - ELF header (64 bytes)
  // - Program headers
  // - Section headers (at end)
  // - .text section (code)
  // - .rodata section (strings)
  // - .shstrtab section (section names)
  //
  // Solana expects:
  // - e_machine = EM_BPF (247)
  // - e_flags = 0x20 (SBFv2)
  // - Virtual address starting at 0x100000000
  // - .text section with the bytecode
  // - Entrypoint at start of .text

  const TEXT_VADDR = 0x100000000;
  const RODATA_VADDR = 0x100000000 + 0x100000;

  // Section name strings
  const shstrtab = Buffer.from('\0.text\0.rodata\0.shstrtab\0');
  const SH_NAME_TEXT = 1;
  const SH_NAME_RODATA = 7;
  const SH_NAME_SHSTRTAB = 15;

  // Layout calculations
  const ELF_HDR_SIZE = 64;
  const PHDR_SIZE = 56;
  const SHDR_SIZE = 64;
  const NUM_PHDRS = 2; // code + rodata
  const NUM_SHDRS = 4; // null + .text + .rodata + .shstrtab

  const PHDRS_OFFSET = ELF_HDR_SIZE;
  const PHDRS_END = PHDRS_OFFSET + PHDR_SIZE * NUM_PHDRS;

  // Align sections
  const TEXT_OFFSET = (PHDRS_END + 15) & ~15;
  const TEXT_SIZE = code.length;

  const RODATA_OFFSET = ((TEXT_OFFSET + TEXT_SIZE) + 15) & ~15;
  const RODATA_SIZE = rodata.length;

  const SHSTRTAB_OFFSET = ((RODATA_OFFSET + RODATA_SIZE) + 15) & ~15;
  const SHSTRTAB_SIZE = shstrtab.length;

  const SHDRS_OFFSET = ((SHSTRTAB_OFFSET + SHSTRTAB_SIZE) + 15) & ~15;
  const TOTAL_SIZE = SHDRS_OFFSET + SHDR_SIZE * NUM_SHDRS;

  // Patch rodata addresses in code
  const RODATA_ACTUAL_VADDR = RODATA_VADDR;
  if (emitter._patches) {
    for (const patch of emitter._patches) {
      if (patch.type === 'rodata_addr') {
        const info = emitter.rodataLabels[patch.label];
        const addr = RODATA_ACTUAL_VADDR + info.offset;
        const lo = addr & 0xFFFFFFFF;
        const hi = Math.floor(addr / 0x100000000) & 0xFFFFFFFF;
        // Patch the lddw instruction (2 slots, 16 bytes)
        // First slot: imm = lo32
        const insn1 = emitter.instructions[patch.instrIndex];
        insn1.writeInt32LE(lo, 4);
        // Second slot: imm = hi32
        const insn2 = emitter.instructions[patch.instrIndex + 1];
        insn2.writeInt32LE(hi, 4);
      }
    }
  }

  // Rebuild code after patching
  const patchedCode = Buffer.concat(emitter.instructions);

  // Build ELF
  const elf = Buffer.alloc(TOTAL_SIZE, 0);

  // ── ELF Header ──
  elf[0] = 0x7F; elf[1] = 0x45; elf[2] = 0x4C; elf[3] = 0x46; // magic
  elf[4] = 2;    // 64-bit
  elf[5] = 1;    // little-endian
  elf[6] = 1;    // ELF version
  elf[7] = 0;    // OS/ABI
  elf.writeUInt16LE(2, 16);          // ET_EXEC
  elf.writeUInt16LE(247, 18);        // EM_BPF
  elf.writeUInt32LE(1, 20);          // version
  elf.writeBigUInt64LE(BigInt(TEXT_VADDR), 24);  // entry point
  elf.writeBigUInt64LE(BigInt(PHDRS_OFFSET), 32);  // phoff
  elf.writeBigUInt64LE(BigInt(SHDRS_OFFSET), 40);  // shoff
  elf.writeUInt32LE(0x20, 48);       // flags (SBFv2)
  elf.writeUInt16LE(ELF_HDR_SIZE, 52);
  elf.writeUInt16LE(PHDR_SIZE, 54);
  elf.writeUInt16LE(NUM_PHDRS, 56);
  elf.writeUInt16LE(SHDR_SIZE, 58);
  elf.writeUInt16LE(NUM_SHDRS, 60);
  elf.writeUInt16LE(3, 62);          // shstrndx (index of .shstrtab)

  // ── Program Header 1: .text (RX) ──
  let pos = PHDRS_OFFSET;
  elf.writeUInt32LE(1, pos);           // PT_LOAD
  elf.writeUInt32LE(5, pos + 4);       // PF_R | PF_X
  elf.writeBigUInt64LE(BigInt(TEXT_OFFSET), pos + 8);   // p_offset
  elf.writeBigUInt64LE(BigInt(TEXT_VADDR), pos + 16);   // p_vaddr
  elf.writeBigUInt64LE(BigInt(TEXT_VADDR), pos + 24);   // p_paddr
  elf.writeBigUInt64LE(BigInt(TEXT_SIZE), pos + 32);    // p_filesz
  elf.writeBigUInt64LE(BigInt(TEXT_SIZE), pos + 40);    // p_memsz
  elf.writeBigUInt64LE(BigInt(0x1000), pos + 48);       // p_align

  // ── Program Header 2: .rodata (R) ──
  pos = PHDRS_OFFSET + PHDR_SIZE;
  elf.writeUInt32LE(1, pos);           // PT_LOAD
  elf.writeUInt32LE(4, pos + 4);       // PF_R
  elf.writeBigUInt64LE(BigInt(RODATA_OFFSET), pos + 8);
  elf.writeBigUInt64LE(BigInt(RODATA_ACTUAL_VADDR), pos + 16);
  elf.writeBigUInt64LE(BigInt(RODATA_ACTUAL_VADDR), pos + 24);
  elf.writeBigUInt64LE(BigInt(RODATA_SIZE), pos + 32);
  elf.writeBigUInt64LE(BigInt(RODATA_SIZE), pos + 40);
  elf.writeBigUInt64LE(BigInt(0x1000), pos + 48);

  // ── .text section ──
  patchedCode.copy(elf, TEXT_OFFSET);

  // ── .rodata section ──
  rodata.copy(elf, RODATA_OFFSET);

  // ── .shstrtab section ──
  shstrtab.copy(elf, SHSTRTAB_OFFSET);

  // ── Section Headers ──

  // SHDR 0: null
  // (already zeroed)

  // SHDR 1: .text
  pos = SHDRS_OFFSET + SHDR_SIZE;
  elf.writeUInt32LE(SH_NAME_TEXT, pos);       // sh_name
  elf.writeUInt32LE(1, pos + 4);              // SHT_PROGBITS
  elf.writeBigUInt64LE(6n, pos + 8);          // SHF_ALLOC | SHF_EXECINSTR
  elf.writeBigUInt64LE(BigInt(TEXT_VADDR), pos + 16);  // sh_addr
  elf.writeBigUInt64LE(BigInt(TEXT_OFFSET), pos + 24); // sh_offset
  elf.writeBigUInt64LE(BigInt(TEXT_SIZE), pos + 32);   // sh_size
  elf.writeBigUInt64LE(BigInt(8), pos + 56);           // sh_addralign

  // SHDR 2: .rodata
  pos = SHDRS_OFFSET + SHDR_SIZE * 2;
  elf.writeUInt32LE(SH_NAME_RODATA, pos);
  elf.writeUInt32LE(1, pos + 4);              // SHT_PROGBITS
  elf.writeBigUInt64LE(2n, pos + 8);          // SHF_ALLOC
  elf.writeBigUInt64LE(BigInt(RODATA_ACTUAL_VADDR), pos + 16);
  elf.writeBigUInt64LE(BigInt(RODATA_OFFSET), pos + 24);
  elf.writeBigUInt64LE(BigInt(RODATA_SIZE), pos + 32);
  elf.writeBigUInt64LE(BigInt(1), pos + 56);

  // SHDR 3: .shstrtab
  pos = SHDRS_OFFSET + SHDR_SIZE * 3;
  elf.writeUInt32LE(SH_NAME_SHSTRTAB, pos);
  elf.writeUInt32LE(3, pos + 4);              // SHT_STRTAB
  elf.writeBigUInt64LE(0n, pos + 8);
  elf.writeBigUInt64LE(0n, pos + 16);
  elf.writeBigUInt64LE(BigInt(SHSTRTAB_OFFSET), pos + 24);
  elf.writeBigUInt64LE(BigInt(SHSTRTAB_SIZE), pos + 32);
  elf.writeBigUInt64LE(BigInt(1), pos + 56);

  return elf;
}


// ═══════════════════════════════════════════
//  BROLANG → SBF COMPILER
// ═══════════════════════════════════════════

function compileBroToSBF(source) {
  // For v0.1: extract shill statements and compile to sol_log calls
  // Parse the source minimally — look for shill "..." statements
  const messages = [];
  const lines = source.split('\n');

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    // Match: shill "..."
    const match = line.trim().match(/^shill\s+"([^"]*)"$/i);
    if (match) {
      messages.push(match[1]);
    }
  }

  if (messages.length === 0) {
    messages.push('gm ser');
  }

  const emitter = new SBFEmitter();
  emitter.emitLogProgram(messages);

  return { emitter, messages };
}


// ═══════════════════════════════════════════
//  CLI
// ═══════════════════════════════════════════

const file = process.argv[2];
const outputFlag = process.argv.indexOf('-o');
let outputFile;

if (!file) {
  console.log('');
  console.log('  BroLang SBF Compiler v0.1.0');
  console.log('  ================================');
  console.log('  Compiles BroLang → Solana BPF bytecode → deployable ELF');
  console.log('');
  console.log('  Usage:');
  console.log('    node brolang-sbf.js <file.bro>           Compile to Solana program');
  console.log('    node brolang-sbf.js <file.bro> -o name   Custom output');
  console.log('    node brolang-sbf.js <file.bro> --dump    Show SBF disassembly');
  console.log('');
  console.log('  Then:');
  console.log('    solana program deploy output.so');
  console.log('');
  console.log('  NFA. DYOR. Not audited.');
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
  outputFile = path.basename(file, '.bro') + '.so';
}

const source = fs.readFileSync(filePath, 'utf-8');

try {
  const { emitter, messages } = compileBroToSBF(source);

  if (process.argv.includes('--dump')) {
    console.log('');
    console.log('  SBF Bytecode Disassembly');
    console.log('  ========================');
    console.log('');
    const code = emitter.getCode();
    for (let i = 0; i < code.length; i += 8) {
      const opcode = code[i];
      const regs = code[i + 1];
      const dst = regs & 0xF;
      const src = (regs >> 4) & 0xF;
      const offset = code.readInt16LE(i + 2);
      const imm = code.readInt32LE(i + 4);
      const hex = code.slice(i, i + 8).toString('hex');
      const addr = (i / 8).toString().padStart(4);
      console.log(`  ${addr}  ${hex}  r${dst} r${src} off=${offset} imm=0x${(imm >>> 0).toString(16)}`);
    }
    console.log('');
    console.log('  Read-only data:');
    for (const [key, info] of Object.entries(emitter.rodataLabels)) {
      const str = Buffer.from(emitter.rodata.slice(info.offset, info.offset + info.length)).toString('utf8');
      console.log(`    ${key}: "${str}" (offset=${info.offset}, len=${info.length})`);
    }
    console.log('');
    process.exit(0);
  }

  const elfBinary = buildSolanaELF(emitter);
  fs.writeFileSync(outputFile, elfBinary);

  console.log(`  compiled: ${file}`);
  console.log(`  output:   ${outputFile}`);
  console.log(`  code:     ${emitter.instructions.length} SBF instructions (${emitter.getCode().length} bytes)`);
  console.log(`  rodata:   ${emitter.rodata.length} bytes (${messages.length} strings)`);
  console.log(`  total:    ${elfBinary.length} bytes`);
  console.log(`  arch:     SBF (Solana BPF)`);
  console.log(`  target:   Solana mainnet/devnet`);
  console.log('');
  console.log('  Messages on-chain:');
  for (const msg of messages) {
    console.log(`    sol_log: "${msg}"`);
  }
  console.log('');
  console.log(`  Deploy: solana program deploy ${outputFile}`);
  console.log('');
  console.log('  NFA. DYOR. Not audited. wagmi.');

} catch (err) {
  console.error(`\n  rugged: ${err.message}\n`);
  if (process.argv.includes('--debug')) console.error(err.stack);
  process.exit(1);
}
