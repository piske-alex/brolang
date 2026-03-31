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
    // src=1 for syscall/helper call, imm=0xFFFFFFFF as placeholder (patched by relocation)
    this.emit(BPF_JMP | BPF_CALL, 0, 1, 0, -1);
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

  emitLogProgram(messages) {
    this.movReg(R6, R1); // save input pointer

    for (const msg of messages) {
      const label = this.addString(msg);
      const info = this.rodataLabels[label];
      // lddw r1, <rodata_offset> — actual address, relocation validates
      // The rodata file offset will be patched in ELF builder
      this._rodataRefs = this._rodataRefs || [];
      const patchIdx = this.instructions.length;
      this.loadImm64(R1, 0); // placeholder, patched by ELF builder
      this._rodataRefs.push({ instrIndex: patchIdx, label });
      // mov r2, len
      this.movImm(R2, info.length);
      // call sol_log_ (src=1, imm=-1, patched by relocation)
      this.syscall(SYSCALL_SOL_LOG);
    }

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
  // Clean rewrite matched against cargo-build-sbf reference output.
  // Reference: EM_SBF=0x107, ET_DYN, vaddr==file_offset, 4 LOAD segments
  const align8 = (v) => (v + 7) & ~7;
  const SYM_SZ = 24;  // sizeof(Elf64_Sym)
  const REL_SZ = 16;  // sizeof(Elf64_Rel)
  const DYN_E = 16;   // sizeof(Elf64_Dyn)
  const EH = 64;      // ELF header
  const PH = 56;      // program header
  const SH = 64;      // section header

  // ── Gather data from emitter ──
  const code = Buffer.concat(emitter.instructions);
  const rodata = Buffer.from(emitter.rodata);
  const syscalls = emitter._syscalls || [];
  const rodataRefs = emitter._rodataRefs || [];
  const SYSCALL_NAMES = { 0x7ef088ca: 'sol_log_', 0x7317b434: 'sol_log_64_' };

  // ── Build .dynstr ──
  // Collect unique syscall symbols
  const uniqueSyscalls = new Map();
  const syscallSymbols = [];
  for (const sc of syscalls) {
    if (!uniqueSyscalls.has(sc.hash)) {
      uniqueSyscalls.set(sc.hash, syscallSymbols.length + 2); // 0=null, 1=entrypoint
      syscallSymbols.push(SYSCALL_NAMES[sc.hash] || 'syscall_' + sc.hash.toString(16));
    }
  }
  let dynstrBuf = '\0entrypoint\0';
  const symNameOff = { entrypoint: 1 };
  for (const name of syscallSymbols) {
    symNameOff[name] = dynstrBuf.length;
    dynstrBuf += name + '\0';
  }
  const dynstr = Buffer.from(dynstrBuf);

  // ── Build .dynsym ──
  const numSyms = 2 + syscallSymbols.length; // null + entrypoint + syscalls
  const dynsym = Buffer.alloc(SYM_SZ * numSyms, 0);
  // sym 0: null (zeroed)
  // sym 1: entrypoint — patched after layout
  // sym 2+: syscall externals (undefined)
  for (let i = 0; i < syscallSymbols.length; i++) {
    const off = SYM_SZ * (2 + i);
    dynsym.writeUInt32LE(symNameOff[syscallSymbols[i]], off); // st_name
    dynsym[off + 4] = (1 << 4); // STB_GLOBAL | STT_NOTYPE
    // st_shndx=0 (UND), st_value=0, st_size=0
  }

  // ── Build .rel.dyn ──
  const numRels = rodataRefs.length + syscalls.length;
  const reldyn = Buffer.alloc(REL_SZ * numRels, 0);
  // Filled after layout

  // ── Build .dynamic ──
  const hasSyscalls = numRels > 0;
  const dynEntryCount = hasSyscalls ? 10 : 7;
  const dynamic = Buffer.alloc(DYN_E * dynEntryCount, 0);
  // Filled after layout

  // ── Build .shstrtab ──
  const shstrtabStr = hasSyscalls
    ? '\0.text\0.rodata\0.dynamic\0.dynsym\0.dynstr\0.rel.dyn\0.shstrtab\0'
    : '\0.text\0.rodata\0.dynamic\0.dynsym\0.dynstr\0.shstrtab\0';
  const shstrtab = Buffer.from(shstrtabStr);
  const SN = { text: 1, rodata: 7, dynamic: 15, dynsym: 24, dynstr: 32 };
  SN.reldyn = hasSyscalls ? 40 : -1;
  SN.shstrtab = hasSyscalls ? 49 : 40;

  // ── Layout: vaddr == file offset ──
  const NP = 4; // text, rodata, dynsym+dynstr+rel, dynamic
  const NS = (hasSyscalls ? 8 : 7); // null + text + rodata + dynamic + dynsym + dynstr + [rel] + shstrtab

  const PH_END = EH + PH * NP;
  const TEXT_OFF = align8(PH_END);
  const TEXT_SZ = code.length;
  const RODATA_OFF = align8(TEXT_OFF + TEXT_SZ);
  const RODATA_SZ = rodata.length;
  const DYN_OFF = align8(RODATA_OFF + Math.max(RODATA_SZ, 1));
  const DYN_SZ = dynamic.length;
  const DYNSYM_OFF = align8(DYN_OFF + DYN_SZ);
  const DYNSYM_SZ = dynsym.length;
  const DYNSTR_OFF = align8(DYNSYM_OFF + DYNSYM_SZ);
  const DYNSTR_SZ = dynstr.length;
  const RELDYN_OFF = hasSyscalls ? align8(DYNSTR_OFF + DYNSTR_SZ) : 0;
  const RELDYN_SZ = reldyn.length;
  const SHSTRTAB_OFF = align8(hasSyscalls ? RELDYN_OFF + RELDYN_SZ : DYNSTR_OFF + DYNSTR_SZ);
  const SHSTRTAB_SZ = shstrtab.length;
  const SHDRS_OFF = align8(SHSTRTAB_OFF + SHSTRTAB_SZ);
  const TOTAL = SHDRS_OFF + SH * NS;

  // ── Patch entrypoint symbol (sym 1) ──
  const sp = SYM_SZ;
  dynsym.writeUInt32LE(symNameOff.entrypoint, sp);
  dynsym[sp + 4] = (1 << 4) | 2; // STB_GLOBAL | STT_FUNC
  dynsym.writeUInt16LE(1, sp + 6); // st_shndx = .text section
  dynsym.writeBigUInt64LE(BigInt(TEXT_OFF), sp + 8); // st_value = file offset
  dynsym.writeBigUInt64LE(BigInt(TEXT_SZ), sp + 16); // st_size

  // ── Patch lddw instructions with rodata addresses ──
  for (const ref of rodataRefs) {
    const info = emitter.rodataLabels[ref.label];
    const addr = RODATA_OFF + info.offset; // vaddr == file offset
    emitter.instructions[ref.instrIndex].writeInt32LE(addr & 0xFFFFFFFF, 4);
    emitter.instructions[ref.instrIndex + 1].writeInt32LE(0, 4);
  }
  const patchedCode = Buffer.concat(emitter.instructions);

  // ── Fill .rel.dyn ──
  let ri = 0;
  // R_BPF_64_ABS64 (type 8) for lddw rodata references
  for (const ref of rodataRefs) {
    const off = TEXT_OFF + ref.instrIndex * 8;
    reldyn.writeBigUInt64LE(BigInt(off), ri * REL_SZ);
    reldyn.writeBigUInt64LE(8n, ri * REL_SZ + 8); // type=8, sym=0
    ri++;
  }
  // R_BPF_64_32 (type 10) for CALL syscalls
  for (const sc of syscalls) {
    const off = TEXT_OFF + sc.instrIndex * 8;
    const symIdx = uniqueSyscalls.get(sc.hash);
    reldyn.writeBigUInt64LE(BigInt(off), ri * REL_SZ);
    reldyn.writeBigUInt64LE((BigInt(symIdx) << 32n) | 10n, ri * REL_SZ + 8);
    ri++;
  }

  // ── Fill .dynamic ──
  let dp = 0;
  const dw = (tag, val) => {
    dynamic.writeBigUInt64LE(BigInt(tag), dp);
    dynamic.writeBigUInt64LE(BigInt(val), dp + 8);
    dp += DYN_E;
  };
  dw(30, 4);               // DT_FLAGS = DF_TEXTREL
  dw(6, DYNSYM_OFF);       // DT_SYMTAB
  dw(11, SYM_SZ);          // DT_SYMENT
  dw(5, DYNSTR_OFF);       // DT_STRTAB
  dw(10, DYNSTR_SZ);       // DT_STRSZ
  dw(22, 0);               // DT_TEXTREL
  if (hasSyscalls) {
    dw(17, RELDYN_OFF);    // DT_REL
    dw(18, RELDYN_SZ);     // DT_RELSZ
    dw(19, REL_SZ);        // DT_RELENT
  }
  dw(0, 0);                // DT_NULL

  // ── Assemble ELF ──
  const elf = Buffer.alloc(TOTAL, 0);

  // ELF header
  elf[0]=0x7F; elf[1]=0x45; elf[2]=0x4C; elf[3]=0x46;
  elf[4]=2; elf[5]=1; elf[6]=1;
  elf.writeUInt16LE(3, 16);                        // ET_DYN
  elf.writeUInt16LE(0x107, 18);                    // EM_SBF (263)
  elf.writeUInt32LE(1, 20);
  elf.writeBigUInt64LE(BigInt(TEXT_OFF), 24);       // e_entry
  elf.writeBigUInt64LE(BigInt(EH), 32);             // e_phoff
  elf.writeBigUInt64LE(BigInt(SHDRS_OFF), 40);      // e_shoff
  elf.writeUInt32LE(0, 48);                         // e_flags
  elf.writeUInt16LE(EH, 52);
  elf.writeUInt16LE(PH, 54);
  elf.writeUInt16LE(NP, 56);
  elf.writeUInt16LE(SH, 58);
  elf.writeUInt16LE(NS, 60);
  elf.writeUInt16LE(NS - 1, 62);                   // e_shstrndx

  // PHDR 0: .text (LOAD RE)
  let pos = EH;
  elf.writeUInt32LE(1, pos);     elf.writeUInt32LE(5, pos+4);
  elf.writeBigUInt64LE(BigInt(TEXT_OFF), pos+8);
  elf.writeBigUInt64LE(BigInt(TEXT_OFF), pos+16);
  elf.writeBigUInt64LE(BigInt(TEXT_OFF), pos+24);
  elf.writeBigUInt64LE(BigInt(TEXT_SZ), pos+32);
  elf.writeBigUInt64LE(BigInt(TEXT_SZ), pos+40);
  elf.writeBigUInt64LE(0x1000n, pos+48);

  // PHDR 1: .rodata (LOAD R)
  pos += PH;
  elf.writeUInt32LE(1, pos);     elf.writeUInt32LE(4, pos+4);
  elf.writeBigUInt64LE(BigInt(RODATA_OFF), pos+8);
  elf.writeBigUInt64LE(BigInt(RODATA_OFF), pos+16);
  elf.writeBigUInt64LE(BigInt(RODATA_OFF), pos+24);
  elf.writeBigUInt64LE(BigInt(RODATA_SZ || 1), pos+32);
  elf.writeBigUInt64LE(BigInt(RODATA_SZ || 1), pos+40);
  elf.writeBigUInt64LE(0x1000n, pos+48);

  // PHDR 2: .dynsym + .dynstr + .rel.dyn (LOAD R)
  pos += PH;
  const seg2end = hasSyscalls ? RELDYN_OFF + RELDYN_SZ : DYNSTR_OFF + DYNSTR_SZ;
  elf.writeUInt32LE(1, pos);     elf.writeUInt32LE(4, pos+4);
  elf.writeBigUInt64LE(BigInt(DYNSYM_OFF), pos+8);
  elf.writeBigUInt64LE(BigInt(DYNSYM_OFF), pos+16);
  elf.writeBigUInt64LE(BigInt(DYNSYM_OFF), pos+24);
  elf.writeBigUInt64LE(BigInt(seg2end - DYNSYM_OFF), pos+32);
  elf.writeBigUInt64LE(BigInt(seg2end - DYNSYM_OFF), pos+40);
  elf.writeBigUInt64LE(0x1000n, pos+48);

  // PHDR 3: PT_DYNAMIC
  pos += PH;
  elf.writeUInt32LE(2, pos);     elf.writeUInt32LE(6, pos+4);
  elf.writeBigUInt64LE(BigInt(DYN_OFF), pos+8);
  elf.writeBigUInt64LE(BigInt(DYN_OFF), pos+16);
  elf.writeBigUInt64LE(BigInt(DYN_OFF), pos+24);
  elf.writeBigUInt64LE(BigInt(DYN_SZ), pos+32);
  elf.writeBigUInt64LE(BigInt(DYN_SZ), pos+40);
  elf.writeBigUInt64LE(8n, pos+48);

  // ── Write section data ──
  patchedCode.copy(elf, TEXT_OFF);
  if (RODATA_SZ > 0) rodata.copy(elf, RODATA_OFF);
  dynamic.copy(elf, DYN_OFF);
  dynsym.copy(elf, DYNSYM_OFF);
  dynstr.copy(elf, DYNSTR_OFF);
  if (hasSyscalls) reldyn.copy(elf, RELDYN_OFF);
  shstrtab.copy(elf, SHSTRTAB_OFF);

  // ── Section headers ──
  // Track indices for sh_link references
  let si = 1;
  const secIdx = {};

  // 1: .text
  pos = SHDRS_OFF + SH * si;
  secIdx.text = si++;
  elf.writeUInt32LE(SN.text, pos);
  elf.writeUInt32LE(1, pos+4);       // SHT_PROGBITS
  elf.writeBigUInt64LE(6n, pos+8);   // SHF_ALLOC | SHF_EXECINSTR
  elf.writeBigUInt64LE(BigInt(TEXT_OFF), pos+16);
  elf.writeBigUInt64LE(BigInt(TEXT_OFF), pos+24);
  elf.writeBigUInt64LE(BigInt(TEXT_SZ), pos+32);
  elf.writeBigUInt64LE(8n, pos+48);

  // 2: .rodata
  pos = SHDRS_OFF + SH * si;
  secIdx.rodata = si++;
  elf.writeUInt32LE(SN.rodata, pos);
  elf.writeUInt32LE(1, pos+4);       // SHT_PROGBITS
  elf.writeBigUInt64LE(0x12n, pos+8); // SHF_ALLOC | SHF_MERGE (0x10|0x02)
  elf.writeBigUInt64LE(BigInt(RODATA_OFF), pos+16);
  elf.writeBigUInt64LE(BigInt(RODATA_OFF), pos+24);
  elf.writeBigUInt64LE(BigInt(RODATA_SZ || 1), pos+32);
  elf.writeBigUInt64LE(0x10n, pos+56); // sh_entsize (merge size)
  elf.writeBigUInt64LE(1n, pos+48);

  // 3: .dynamic
  pos = SHDRS_OFF + SH * si;
  secIdx.dynamic = si++;
  elf.writeUInt32LE(SN.dynamic, pos);
  elf.writeUInt32LE(6, pos+4);       // SHT_DYNAMIC
  elf.writeBigUInt64LE(3n, pos+8);   // SHF_WRITE | SHF_ALLOC
  elf.writeBigUInt64LE(BigInt(DYN_OFF), pos+16);
  elf.writeBigUInt64LE(BigInt(DYN_OFF), pos+24);
  elf.writeBigUInt64LE(BigInt(DYN_SZ), pos+32);
  // sh_link patched after dynstr index known
  elf.writeBigUInt64LE(8n, pos+48);
  elf.writeBigUInt64LE(16n, pos+56);

  // 4: .dynsym
  pos = SHDRS_OFF + SH * si;
  secIdx.dynsym = si++;
  elf.writeUInt32LE(SN.dynsym, pos);
  elf.writeUInt32LE(11, pos+4);      // SHT_DYNSYM
  elf.writeBigUInt64LE(2n, pos+8);   // SHF_ALLOC
  elf.writeBigUInt64LE(BigInt(DYNSYM_OFF), pos+16);
  elf.writeBigUInt64LE(BigInt(DYNSYM_OFF), pos+24);
  elf.writeBigUInt64LE(BigInt(DYNSYM_SZ), pos+32);
  elf.writeUInt32LE(1, pos+44);      // sh_info = first global sym
  elf.writeBigUInt64LE(8n, pos+48);
  elf.writeBigUInt64LE(BigInt(SYM_SZ), pos+56);

  // 5: .dynstr
  pos = SHDRS_OFF + SH * si;
  secIdx.dynstr = si++;
  elf.writeUInt32LE(SN.dynstr, pos);
  elf.writeUInt32LE(3, pos+4);       // SHT_STRTAB
  elf.writeBigUInt64LE(2n, pos+8);   // SHF_ALLOC
  elf.writeBigUInt64LE(BigInt(DYNSTR_OFF), pos+16);
  elf.writeBigUInt64LE(BigInt(DYNSTR_OFF), pos+24);
  elf.writeBigUInt64LE(BigInt(DYNSTR_SZ), pos+32);
  elf.writeBigUInt64LE(1n, pos+48);

  // 6: .rel.dyn (if syscalls)
  if (hasSyscalls) {
    pos = SHDRS_OFF + SH * si;
    secIdx.reldyn = si++;
    elf.writeUInt32LE(SN.reldyn, pos);
    elf.writeUInt32LE(9, pos+4);     // SHT_REL
    elf.writeBigUInt64LE(2n, pos+8); // SHF_ALLOC
    elf.writeBigUInt64LE(BigInt(RELDYN_OFF), pos+16);
    elf.writeBigUInt64LE(BigInt(RELDYN_OFF), pos+24);
    elf.writeBigUInt64LE(BigInt(RELDYN_SZ), pos+32);
    elf.writeUInt32LE(secIdx.dynsym, pos+40); // sh_link = .dynsym
    elf.writeBigUInt64LE(8n, pos+48);
    elf.writeBigUInt64LE(BigInt(REL_SZ), pos+56);
  }

  // 7: .shstrtab
  pos = SHDRS_OFF + SH * si;
  secIdx.shstrtab = si++;
  elf.writeUInt32LE(SN.shstrtab, pos);
  elf.writeUInt32LE(3, pos+4);       // SHT_STRTAB
  elf.writeBigUInt64LE(BigInt(SHSTRTAB_OFF), pos+24);
  elf.writeBigUInt64LE(BigInt(SHSTRTAB_SZ), pos+32);
  elf.writeBigUInt64LE(1n, pos+48);

  // Patch sh_link fields that reference .dynstr
  // .dynamic sh_link
  const dynShdrOff = SHDRS_OFF + SH * secIdx.dynamic;
  elf.writeUInt32LE(secIdx.dynstr, dynShdrOff + 40);
  // .dynsym sh_link
  const dynsymShdrOff = SHDRS_OFF + SH * secIdx.dynsym;
  elf.writeUInt32LE(secIdx.dynstr, dynsymShdrOff + 40);

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
