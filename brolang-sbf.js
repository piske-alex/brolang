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

  // call syscall_hash — records relocation for the loader
  syscall(hash) {
    this._syscalls = this._syscalls || [];
    this._syscalls.push({ instrIndex: this.instructions.length, hash });
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
  // Matched against cargo-build-sbf reference output.
  // Key: EM_SBF=0x107, vaddr==file_offset, DT_FLAGS+DT_TEXTREL
  const code = Buffer.concat(emitter.instructions);
  const rodata = Buffer.from(emitter.rodata);
  const align8 = (v) => (v + 7) & ~7;

  // .dynstr
  const dynstr = Buffer.from('\0entrypoint\0');
  // .dynsym (2 entries x 24 bytes)
  const SYM_SZ = 24;
  const dynsym = Buffer.alloc(SYM_SZ * 2, 0);
  // .dynamic (7 entries x 16 bytes)
  const DYN_E = 16;
  const dynamic = Buffer.alloc(DYN_E * 7, 0);
  // .shstrtab
  const shstrtab = Buffer.from('\0.text\0.dynamic\0.dynsym\0.dynstr\0.shstrtab\0');
  const SN = {TEXT:1, DYNAMIC:7, DYNSYM:16, DYNSTR:24, SHSTRTAB:32};

  const EH=64, PH=56, SH=64, NP=3, NS=6;
  const PH_END = EH + PH*NP;
  const T_OFF = align8(PH_END);
  const T_SZ = code.length;
  const D_OFF = align8(T_OFF + T_SZ);
  const D_SZ = dynamic.length;
  const DS_OFF = align8(D_OFF + D_SZ);
  const DS_SZ = dynsym.length;
  const STR_OFF = align8(DS_OFF + DS_SZ);
  const STR_SZ = dynstr.length;
  const SHSTR_OFF = align8(STR_OFF + STR_SZ);
  const SHSTR_SZ = shstrtab.length;
  const SH_OFF = align8(SHSTR_OFF + SHSTR_SZ);
  const TOTAL = SH_OFF + SH*NS;

  // Rodata goes right after text in the same LOAD segment
  let R_OFF = 0, R_SZ = 0;
  if (rodata.length > 0) {
    R_OFF = align8(T_OFF + T_SZ);
    // Push dynamic after rodata
    // Recalculate...
  }
  // For simplicity in v0.1, embed rodata in .text region
  // (sol_log addresses point into the text LOAD region)
  // We'll append rodata right after code bytes
  const textAndRodata = rodata.length > 0 ? Buffer.concat([code, Buffer.alloc(align8(T_SZ) - T_SZ, 0), rodata]) : code;
  const TR_SZ = textAndRodata.length;

  // Recalc with combined text+rodata
  const D_OFF2 = align8(T_OFF + TR_SZ);
  const DS_OFF2 = align8(D_OFF2 + D_SZ);
  const STR_OFF2 = align8(DS_OFF2 + DS_SZ);
  const SHSTR_OFF2 = align8(STR_OFF2 + STR_SZ);
  const SH_OFF2 = align8(SHSTR_OFF2 + SHSTR_SZ);
  const TOTAL2 = SH_OFF2 + SH*NS;

  // Patch rodata addresses (vaddr == file offset)
  if (emitter._patches) {
    for (const patch of emitter._patches) {
      if (patch.type === 'rodata_addr') {
        const info = emitter.rodataLabels[patch.label];
        const addr = T_OFF + align8(T_SZ) + info.offset; // file offset of string
        emitter.instructions[patch.instrIndex].writeInt32LE(addr & 0xFFFFFFFF, 4);
        emitter.instructions[patch.instrIndex + 1].writeInt32LE(0, 4); // hi32=0
      }
    }
  }
  const patchedTextAndRodata = rodata.length > 0
    ? Buffer.concat([Buffer.concat(emitter.instructions), Buffer.alloc(align8(T_SZ) - T_SZ, 0), rodata])
    : Buffer.concat(emitter.instructions);

  // Patch dynsym entry 1: entrypoint
  const sp = SYM_SZ;
  dynsym.writeUInt32LE(1, sp);           // st_name
  dynsym[sp+4] = (1<<4)|2;              // STB_GLOBAL|STT_FUNC
  dynsym.writeUInt16LE(1, sp+6);        // st_shndx = .text
  dynsym.writeBigUInt64LE(BigInt(T_OFF), sp+8);  // st_value = file offset
  dynsym.writeBigUInt64LE(BigInt(T_SZ), sp+16);  // st_size

  // Patch .dynamic
  let dp = 0;
  const dw = (t,v) => { dynamic.writeBigUInt64LE(BigInt(t),dp); dynamic.writeBigUInt64LE(BigInt(v),dp+8); dp+=DYN_E; };
  dw(30, 4);             // DT_FLAGS = DF_TEXTREL
  dw(6, DS_OFF2);        // DT_SYMTAB
  dw(11, SYM_SZ);        // DT_SYMENT
  dw(5, STR_OFF2);       // DT_STRTAB
  dw(10, STR_SZ);        // DT_STRSZ
  dw(22, 0);             // DT_TEXTREL
  dw(0, 0);              // DT_NULL

  // Build ELF
  const elf = Buffer.alloc(TOTAL2, 0);

  // ELF header
  elf[0]=0x7F;elf[1]=0x45;elf[2]=0x4C;elf[3]=0x46;
  elf[4]=2;elf[5]=1;elf[6]=1;elf[7]=0;
  elf.writeUInt16LE(3, 16);           // ET_DYN
  elf.writeUInt16LE(0x107, 18);       // EM_SBF (263)
  elf.writeUInt32LE(1, 20);
  elf.writeBigUInt64LE(BigInt(T_OFF), 24);  // e_entry = file offset of .text
  elf.writeBigUInt64LE(BigInt(EH), 32);
  elf.writeBigUInt64LE(BigInt(SH_OFF2), 40);
  elf.writeUInt32LE(0, 48);           // flags
  elf.writeUInt16LE(EH, 52);
  elf.writeUInt16LE(PH, 54);
  elf.writeUInt16LE(NP, 56);
  elf.writeUInt16LE(SH, 58);
  elf.writeUInt16LE(NS, 60);
  elf.writeUInt16LE(5, 62);           // shstrndx

  // PHDR 0: .text + rodata (LOAD RE)
  let pos = EH;
  elf.writeUInt32LE(1,pos); elf.writeUInt32LE(5,pos+4);
  elf.writeBigUInt64LE(BigInt(T_OFF),pos+8);
  elf.writeBigUInt64LE(BigInt(T_OFF),pos+16);
  elf.writeBigUInt64LE(BigInt(T_OFF),pos+24);
  elf.writeBigUInt64LE(BigInt(TR_SZ),pos+32);
  elf.writeBigUInt64LE(BigInt(TR_SZ),pos+40);
  elf.writeBigUInt64LE(BigInt(0x1000),pos+48);

  // PHDR 1: .dynsym+.dynstr (LOAD R)
  pos+=PH;
  elf.writeUInt32LE(1,pos); elf.writeUInt32LE(4,pos+4);
  elf.writeBigUInt64LE(BigInt(DS_OFF2),pos+8);
  elf.writeBigUInt64LE(BigInt(DS_OFF2),pos+16);
  elf.writeBigUInt64LE(BigInt(DS_OFF2),pos+24);
  const rdSz = STR_OFF2+STR_SZ-DS_OFF2;
  elf.writeBigUInt64LE(BigInt(rdSz),pos+32);
  elf.writeBigUInt64LE(BigInt(rdSz),pos+40);
  elf.writeBigUInt64LE(BigInt(0x1000),pos+48);

  // PHDR 2: PT_DYNAMIC
  pos+=PH;
  elf.writeUInt32LE(2,pos); elf.writeUInt32LE(6,pos+4);
  elf.writeBigUInt64LE(BigInt(D_OFF2),pos+8);
  elf.writeBigUInt64LE(BigInt(D_OFF2),pos+16);
  elf.writeBigUInt64LE(BigInt(D_OFF2),pos+24);
  elf.writeBigUInt64LE(BigInt(D_SZ),pos+32);
  elf.writeBigUInt64LE(BigInt(D_SZ),pos+40);
  elf.writeBigUInt64LE(8n,pos+48);

  // Section data
  patchedTextAndRodata.copy(elf, T_OFF);
  dynamic.copy(elf, D_OFF2);
  dynsym.copy(elf, DS_OFF2);
  dynstr.copy(elf, STR_OFF2);
  shstrtab.copy(elf, SHSTR_OFF2);

  // Section headers
  // 0: null

  // 1: .text
  pos=SH_OFF2+SH;
  elf.writeUInt32LE(SN.TEXT,pos);
  elf.writeUInt32LE(1,pos+4); elf.writeBigUInt64LE(6n,pos+8);
  elf.writeBigUInt64LE(BigInt(T_OFF),pos+16);
  elf.writeBigUInt64LE(BigInt(T_OFF),pos+24);
  elf.writeBigUInt64LE(BigInt(T_SZ),pos+32);
  elf.writeBigUInt64LE(8n,pos+48);

  // 2: .dynamic
  pos=SH_OFF2+SH*2;
  elf.writeUInt32LE(SN.DYNAMIC,pos);
  elf.writeUInt32LE(6,pos+4); elf.writeBigUInt64LE(3n,pos+8);
  elf.writeBigUInt64LE(BigInt(D_OFF2),pos+16);
  elf.writeBigUInt64LE(BigInt(D_OFF2),pos+24);
  elf.writeBigUInt64LE(BigInt(D_SZ),pos+32);
  elf.writeUInt32LE(4,pos+40);
  elf.writeBigUInt64LE(8n,pos+48);
  elf.writeBigUInt64LE(16n,pos+56);

  // 3: .dynsym
  pos=SH_OFF2+SH*3;
  elf.writeUInt32LE(SN.DYNSYM,pos);
  elf.writeUInt32LE(11,pos+4); elf.writeBigUInt64LE(2n,pos+8);
  elf.writeBigUInt64LE(BigInt(DS_OFF2),pos+16);
  elf.writeBigUInt64LE(BigInt(DS_OFF2),pos+24);
  elf.writeBigUInt64LE(BigInt(DS_SZ),pos+32);
  elf.writeUInt32LE(4,pos+40); elf.writeUInt32LE(1,pos+44);
  elf.writeBigUInt64LE(8n,pos+48);
  elf.writeBigUInt64LE(BigInt(SYM_SZ),pos+56);

  // 4: .dynstr
  pos=SH_OFF2+SH*4;
  elf.writeUInt32LE(SN.DYNSTR,pos);
  elf.writeUInt32LE(3,pos+4); elf.writeBigUInt64LE(2n,pos+8);
  elf.writeBigUInt64LE(BigInt(STR_OFF2),pos+16);
  elf.writeBigUInt64LE(BigInt(STR_OFF2),pos+24);
  elf.writeBigUInt64LE(BigInt(STR_SZ),pos+32);
  elf.writeBigUInt64LE(1n,pos+48);

  // 5: .shstrtab
  pos=SH_OFF2+SH*5;
  elf.writeUInt32LE(SN.SHSTRTAB,pos);
  elf.writeUInt32LE(3,pos+4);
  elf.writeBigUInt64LE(BigInt(SHSTR_OFF2),pos+24);
  elf.writeBigUInt64LE(BigInt(SHSTR_SZ),pos+32);
  elf.writeBigUInt64LE(1n,pos+48);

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

  const emitter = new SBFEmitter();
  if (messages.length > 0) {
    emitter.emitLogProgram(messages);
  } else {
    // Noop: just return 0
    emitter.movImm(R0, 0);
    emitter.exit();
  }

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
