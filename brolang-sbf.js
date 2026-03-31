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
    this.emit(BPF_JMP | BPF_CALL, 0, 0, 0, 0); // imm=0, relocation patches it
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

  // Append raw bytes to the instruction stream (for inline string data)
  appendData(bytes) {
    // Pad to 8-byte alignment first
    while (this.instructions.length * 8 % 8 !== 0) {
      this.instructions.push(Buffer.alloc(8, 0));
    }
    const offset = this.instructions.length * 8; // byte offset from start of .text
    for (let i = 0; i < bytes.length; i += 8) {
      const chunk = Buffer.alloc(8, 0);
      for (let j = 0; j < 8 && i + j < bytes.length; j++) {
        chunk[j] = bytes[i + j];
      }
      this.instructions.push(chunk);
    }
    return offset;
  }

  emitLogProgram(messages) {
    this.movReg(R6, R1); // save input pointer

    // First emit all code, then append string data after exit
    const msgRefs = []; // { patchIdx, len }
    for (const msg of messages) {
      // lddw r1, 0 (placeholder — patched below)
      const patchIdx = this.instructions.length;
      this.loadImm64(R1, 0);
      this.movImm(R2, msg.length);
      this.syscall(SYSCALL_SOL_LOG);
      msgRefs.push({ patchIdx, msg });
    }

    // Return success
    this.movImm(R0, 0);
    this.exit();

    // Append string data AFTER exit, still within .text section
    // Then patch the lddw instructions with the actual addresses
    for (const ref of msgRefs) {
      const strBytes = Buffer.from(ref.msg, 'utf8');
      const dataOffset = this.appendData(strBytes);
      // dataOffset is byte offset from start of instruction stream
      // The actual virtual address will be TEXT_OFF + dataOffset
      // Store as _inlineData patch
      this._inlinePatches = this._inlinePatches || [];
      this._inlinePatches.push({ instrIndex: ref.patchIdx, byteOffset: dataOffset });
    }
  }

  getCode() {
    return Buffer.concat(this.instructions);
  }
}


// ═══════════════════════════════════════════
//  SOLANA ELF BUILDER
// ═══════════════════════════════════════════

function buildSolanaELF(emitter) {
  // ELF format matched against cargo-build-sbf output.
  // vaddr == file_offset, EM_SBF=0x107, ET_DYN
  // Adds .rel.dyn for syscall resolution at load time.

  const code = Buffer.concat(emitter.instructions);
  const rodata = Buffer.from(emitter.rodata);
  const syscalls = emitter._syscalls || [];
  const patches = emitter._patches || [];
  const align8 = (v) => (v + 7) & ~7;
  const SYM_SZ = 24;
  const REL_SZ = 16; // Elf64_Rel
  const DYN_E = 16;

  // Collect unique syscall names for symbol table
  // sol_log hash = 0x7ef088ca → symbol name "sol_log_"
  const SYSCALL_NAMES = { 0x7ef088ca: 'sol_log_', 0x7317b434: 'sol_log_64_' };
  const uniqueSyscalls = new Map(); // hash → symbol_index
  const syscallList = []; // ordered list of {name, hash}
  for (const sc of syscalls) {
    if (!uniqueSyscalls.has(sc.hash)) {
      uniqueSyscalls.set(sc.hash, syscallList.length + 2); // +2: sym 0=null, 1=entrypoint
      syscallList.push({ name: SYSCALL_NAMES[sc.hash] || `syscall_${sc.hash.toString(16)}`, hash: sc.hash });
    }
  }

  // Build .dynstr: \0entrypoint\0sol_log_\0...
  let dynstrParts = ['\0', 'entrypoint\0'];
  const symNameOffsets = {}; // symbol name → offset in dynstr
  symNameOffsets['entrypoint'] = 1;
  let dsOff = dynstrParts.join('').length;
  for (const sc of syscallList) {
    symNameOffsets[sc.name] = dsOff;
    dynstrParts.push(sc.name + '\0');
    dsOff += sc.name.length + 1;
  }
  const dynstr = Buffer.from(dynstrParts.join(''));

  // Build .dynsym: null + entrypoint + syscall symbols
  const numSyms = 2 + syscallList.length;
  const dynsym = Buffer.alloc(SYM_SZ * numSyms, 0);
  // sym 0: null (zeroed)
  // sym 1: entrypoint (patched later with TEXT_OFF)
  // sym 2+: syscall symbols (undefined externals)
  for (let i = 0; i < syscallList.length; i++) {
    const off = SYM_SZ * (2 + i);
    const sc = syscallList[i];
    dynsym.writeUInt32LE(symNameOffsets[sc.name], off);    // st_name
    dynsym[off + 4] = (1 << 4) | 0;                        // STB_GLOBAL | STT_NOTYPE
    dynsym[off + 5] = 0;                                    // STV_DEFAULT
    dynsym.writeUInt16LE(0, off + 6);                       // st_shndx = SHN_UNDEF
    // st_value = 0, st_size = 0
  }

  // Build .rel.dyn: one relocation per syscall CALL instruction
  const reldyn = Buffer.alloc(REL_SZ * syscalls.length, 0);
  // r_offset and r_info patched after layout (need TEXT_OFF)

  // Build .dynamic
  const numDynEntries = syscalls.length > 0 ? 10 : 7;
  const dynamic = Buffer.alloc(DYN_E * numDynEntries, 0);

  // .shstrtab
  const hasReldyn = syscalls.length > 0;
  const shstrtabStr = hasReldyn
    ? '\0.text\0.rodata\0.dynamic\0.dynsym\0.dynstr\0.rel.dyn\0.shstrtab\0'
    : '\0.text\0.dynamic\0.dynsym\0.dynstr\0.shstrtab\0';
  const shstrtab = Buffer.from(shstrtabStr);
  // Compute section name offsets
  const snText = 1;
  const snRodata = 7;
  const snDynamic = 15;
  const snDynsym = 24;
  const snDynstr = 32;
  const snReldyn = hasReldyn ? 40 : -1;
  const snShstrtab = hasReldyn ? 49 : 40;

  // Layout
  const EH = 64, PH = 56, SH = 64;
  const NP = 3;
  const hasRodata = rodata.length > 0;
  const NS = (hasReldyn ? 7 : 6) + (hasRodata ? 1 : 0);

  const PH_END = EH + PH * NP;
  const TEXT_OFF = align8(PH_END);
  const TEXT_SZ = code.length;

  // Append rodata after text in the same region
  let textAndRodata;
  if (rodata.length > 0) {
    const padSz = align8(TEXT_SZ) - TEXT_SZ;
    textAndRodata = Buffer.concat([code, Buffer.alloc(padSz, 0), rodata]);
  } else {
    textAndRodata = code;
  }
  const TR_SZ = textAndRodata.length;

  const DYN_OFF = align8(TEXT_OFF + TR_SZ);
  const DYN_SZ = dynamic.length;

  const DYNSYM_OFF = align8(DYN_OFF + DYN_SZ);
  const DYNSYM_SZ = dynsym.length;

  const DYNSTR_OFF = align8(DYNSYM_OFF + DYNSYM_SZ);
  const DYNSTR_SZ = dynstr.length;

  let RELDYN_OFF = 0, RELDYN_SZ = 0;
  if (hasReldyn) {
    RELDYN_OFF = align8(DYNSTR_OFF + DYNSTR_SZ);
    RELDYN_SZ = reldyn.length;
  }

  const SHSTRTAB_OFF = align8(hasReldyn ? RELDYN_OFF + RELDYN_SZ : DYNSTR_OFF + DYNSTR_SZ);
  const SHSTRTAB_SZ = shstrtab.length;

  const SHDRS_OFF = align8(SHSTRTAB_OFF + SHSTRTAB_SZ);
  const TOTAL = SHDRS_OFF + SH * NS;

  // Patch entrypoint symbol
  const sp = SYM_SZ;
  dynsym.writeUInt32LE(symNameOffsets['entrypoint'], sp);
  dynsym[sp + 4] = (1 << 4) | 2; // STB_GLOBAL | STT_FUNC
  dynsym.writeUInt16LE(1, sp + 6); // st_shndx = .text
  dynsym.writeBigUInt64LE(BigInt(TEXT_OFF), sp + 8);
  dynsym.writeBigUInt64LE(BigInt(TEXT_SZ), sp + 16);

  // Patch .rel.dyn entries
  for (let i = 0; i < syscalls.length; i++) {
    const sc = syscalls[i];
    const symIdx = uniqueSyscalls.get(sc.hash);
    const instrByteOffset = TEXT_OFF + sc.instrIndex * 8; // each instruction is 8 bytes
    const R_BPF_64_32 = 10;
    reldyn.writeBigUInt64LE(BigInt(instrByteOffset), i * REL_SZ);
    // r_info = (sym_idx << 32) | type
    const rInfo = (BigInt(symIdx) << 32n) | BigInt(R_BPF_64_32);
    reldyn.writeBigUInt64LE(rInfo, i * REL_SZ + 8);
  }

  // Patch .dynamic entries
  let dp = 0;
  const DT_NULL=0, DT_STRTAB=5, DT_SYMTAB=6, DT_STRSZ=10, DT_SYMENT=11;
  const DT_REL=17, DT_RELSZ=18, DT_RELENT=19, DT_TEXTREL=22, DT_FLAGS=30;
  const dw = (t,v) => { dynamic.writeBigUInt64LE(BigInt(t),dp); dynamic.writeBigUInt64LE(BigInt(v),dp+8); dp+=DYN_E; };
  dw(DT_FLAGS, 4); // DF_TEXTREL
  dw(DT_SYMTAB, DYNSYM_OFF);
  dw(DT_SYMENT, SYM_SZ);
  dw(DT_STRTAB, DYNSTR_OFF);
  dw(DT_STRSZ, DYNSTR_SZ);
  dw(DT_TEXTREL, 0);
  if (hasReldyn) {
    dw(DT_REL, RELDYN_OFF);
    dw(DT_RELSZ, RELDYN_SZ);
    dw(DT_RELENT, REL_SZ);
  }
  dw(DT_NULL, 0);

  // Patch inline string addresses (strings appended after exit in .text)
  const inlinePatches = emitter._inlinePatches || [];
  for (const ip of inlinePatches) {
    const addr = TEXT_OFF + ip.byteOffset;
    emitter.instructions[ip.instrIndex].writeInt32LE(addr & 0xFFFFFFFF, 4);
    emitter.instructions[ip.instrIndex + 1].writeInt32LE(0, 4);
  }
  // Rebuild code with patches applied (includes inline string data)
  textAndRodata = Buffer.concat(emitter.instructions);

  // Build ELF
  const elf = Buffer.alloc(TOTAL, 0);

  // ELF header
  elf[0]=0x7F;elf[1]=0x45;elf[2]=0x4C;elf[3]=0x46;
  elf[4]=2;elf[5]=1;elf[6]=1;
  elf.writeUInt16LE(3, 16);           // ET_DYN
  elf.writeUInt16LE(0x107, 18);       // EM_SBF
  elf.writeUInt32LE(1, 20);
  elf.writeBigUInt64LE(BigInt(TEXT_OFF), 24);
  elf.writeBigUInt64LE(BigInt(EH), 32);
  elf.writeBigUInt64LE(BigInt(SHDRS_OFF), 40);
  elf.writeUInt32LE(0, 48);
  elf.writeUInt16LE(EH, 52);
  elf.writeUInt16LE(PH, 54);
  elf.writeUInt16LE(NP, 56);
  elf.writeUInt16LE(SH, 58);
  elf.writeUInt16LE(NS, 60);
  elf.writeUInt16LE(NS - 1, 62); // shstrndx = last section

  // PHDR 0: .text + rodata (LOAD RE)
  let pos = EH;
  elf.writeUInt32LE(1,pos); elf.writeUInt32LE(5,pos+4);
  elf.writeBigUInt64LE(BigInt(TEXT_OFF),pos+8);
  elf.writeBigUInt64LE(BigInt(TEXT_OFF),pos+16);
  elf.writeBigUInt64LE(BigInt(TEXT_OFF),pos+24);
  elf.writeBigUInt64LE(BigInt(TEXT_SZ),pos+32);
  elf.writeBigUInt64LE(BigInt(TEXT_SZ),pos+40);
  elf.writeBigUInt64LE(0x1000n,pos+48);

  // PHDR 1: .dynsym + .dynstr + .rel.dyn (LOAD R)
  pos+=PH;
  elf.writeUInt32LE(1,pos); elf.writeUInt32LE(4,pos+4);
  const RD_START = TEXT_OFF + align8(TEXT_SZ); // start from rodata
  elf.writeBigUInt64LE(BigInt(RD_START),pos+8);
  elf.writeBigUInt64LE(BigInt(RD_START),pos+16);
  elf.writeBigUInt64LE(BigInt(RD_START),pos+24);
  const rdEnd = hasReldyn ? RELDYN_OFF + RELDYN_SZ : DYNSTR_OFF + DYNSTR_SZ;
  elf.writeBigUInt64LE(BigInt(rdEnd - RD_START),pos+32);
  elf.writeBigUInt64LE(BigInt(rdEnd - RD_START),pos+40);
  elf.writeBigUInt64LE(0x1000n,pos+48);

  // PHDR 2: PT_DYNAMIC
  pos+=PH;
  elf.writeUInt32LE(2,pos); elf.writeUInt32LE(6,pos+4);
  elf.writeBigUInt64LE(BigInt(DYN_OFF),pos+8);
  elf.writeBigUInt64LE(BigInt(DYN_OFF),pos+16);
  elf.writeBigUInt64LE(BigInt(DYN_OFF),pos+24);
  elf.writeBigUInt64LE(BigInt(DYN_SZ),pos+32);
  elf.writeBigUInt64LE(BigInt(DYN_SZ),pos+40);
  elf.writeBigUInt64LE(8n,pos+48);

  // Section data
  textAndRodata.copy(elf, TEXT_OFF);
  dynamic.copy(elf, DYN_OFF);
  dynsym.copy(elf, DYNSYM_OFF);
  dynstr.copy(elf, DYNSTR_OFF);
  if (hasReldyn) reldyn.copy(elf, RELDYN_OFF);
  shstrtab.copy(elf, SHSTRTAB_OFF);

  // Section headers
  let si = 1;
  let dynsymSi = 0, dynstrSi = 0;

  // 1: .text
  pos = SHDRS_OFF + SH * si++;
  elf.writeUInt32LE(snText,pos);
  elf.writeUInt32LE(1,pos+4); elf.writeBigUInt64LE(6n,pos+8);
  elf.writeBigUInt64LE(BigInt(TEXT_OFF),pos+16);
  elf.writeBigUInt64LE(BigInt(TEXT_OFF),pos+24);
  elf.writeBigUInt64LE(BigInt(TEXT_SZ),pos+32);
  elf.writeBigUInt64LE(8n,pos+48);

  // .rodata (if rodata exists)
  if (hasRodata) {
    const RODATA_OFF = TEXT_OFF + align8(TEXT_SZ);
    const RODATA_SZ = rodata.length;
    pos = SHDRS_OFF + SH * si++;
    elf.writeUInt32LE(snRodata,pos);
    elf.writeUInt32LE(1,pos+4); elf.writeBigUInt64LE(2n,pos+8); // SHT_PROGBITS, SHF_ALLOC
    elf.writeBigUInt64LE(BigInt(RODATA_OFF),pos+16);
    elf.writeBigUInt64LE(BigInt(RODATA_OFF),pos+24);
    elf.writeBigUInt64LE(BigInt(RODATA_SZ),pos+32);
    elf.writeBigUInt64LE(1n,pos+48);
  }

  // .dynamic
  pos = SHDRS_OFF + SH * si++;
  // dynstrIdx computed dynamically below
  elf.writeUInt32LE(snDynamic,pos);
  elf.writeUInt32LE(6,pos+4); elf.writeBigUInt64LE(3n,pos+8);
  elf.writeBigUInt64LE(BigInt(DYN_OFF),pos+16);
  elf.writeBigUInt64LE(BigInt(DYN_OFF),pos+24);
  elf.writeBigUInt64LE(BigInt(DYN_SZ),pos+32);
  elf.writeUInt32LE(dynstrSi,pos+40);
  elf.writeBigUInt64LE(8n,pos+48);
  elf.writeBigUInt64LE(16n,pos+56);

  // .dynsym
  dynsymSi = si;
  pos = SHDRS_OFF + SH * si++;
  elf.writeUInt32LE(snDynsym,pos);
  elf.writeUInt32LE(11,pos+4); elf.writeBigUInt64LE(2n,pos+8);
  elf.writeBigUInt64LE(BigInt(DYNSYM_OFF),pos+16);
  elf.writeBigUInt64LE(BigInt(DYNSYM_OFF),pos+24);
  elf.writeBigUInt64LE(BigInt(DYNSYM_SZ),pos+32);
  elf.writeUInt32LE(dynstrSi,pos+40); elf.writeUInt32LE(1,pos+44);
  elf.writeBigUInt64LE(8n,pos+48);
  elf.writeBigUInt64LE(BigInt(SYM_SZ),pos+56);

  // .dynstr
  dynstrSi = si;
  pos = SHDRS_OFF + SH * si++;
  elf.writeUInt32LE(snDynstr,pos);
  elf.writeUInt32LE(3,pos+4); elf.writeBigUInt64LE(2n,pos+8);
  elf.writeBigUInt64LE(BigInt(DYNSTR_OFF),pos+16);
  elf.writeBigUInt64LE(BigInt(DYNSTR_OFF),pos+24);
  elf.writeBigUInt64LE(BigInt(DYNSTR_SZ),pos+32);
  elf.writeBigUInt64LE(1n,pos+48);

  // 5: .rel.dyn (if syscalls present)
  if (hasReldyn) {
    pos = SHDRS_OFF + SH * si++;
    elf.writeUInt32LE(snReldyn,pos);
    elf.writeUInt32LE(9,pos+4); // SHT_REL
    elf.writeBigUInt64LE(2n,pos+8); // SHF_ALLOC
    elf.writeBigUInt64LE(BigInt(RELDYN_OFF),pos+16);
    elf.writeBigUInt64LE(BigInt(RELDYN_OFF),pos+24);
    elf.writeBigUInt64LE(BigInt(RELDYN_SZ),pos+32);
    elf.writeUInt32LE(dynsymSi,pos+40); // sh_link = .dynsym index
    elf.writeUInt32LE(1,pos+44); // sh_info = .text index
    elf.writeBigUInt64LE(8n,pos+48);
    elf.writeBigUInt64LE(BigInt(REL_SZ),pos+56);
  }

  // Last: .shstrtab
  pos = SHDRS_OFF + SH * si;
  elf.writeUInt32LE(snShstrtab,pos);
  elf.writeUInt32LE(3,pos+4);
  elf.writeBigUInt64LE(BigInt(SHSTRTAB_OFF),pos+24);
  elf.writeBigUInt64LE(BigInt(SHSTRTAB_SZ),pos+32);
  elf.writeBigUInt64LE(1n,pos+48);

  return elf;
}


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
