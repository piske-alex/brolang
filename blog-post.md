# I Built a Programming Language in Crypto-Bro Speak. Then It Ran DOOM. Then It Deployed to Solana.

*How a Sunday joke turned into a bytecode compiler, a native x86 compiler, a Solana BPF compiler, a playable FPS, an RPG, and a landing page — all pair-programmed with Claude Code in 3 days.*

---

It started with a COBOL file.

I was sitting at my desk on a Sunday, no intention of doing real work. I'd been going back and forth with Claude Code about our Solana codebase when I jokingly asked: "Can I rewrite this app in COBOL?"

Claude, being Claude, said no — then listed every practical reason why. So naturally I said "go for it smart alec," and it wrote me a COBOL microservice that prints "GM" based on the time of day. Complete with a `WS-VIBES` field permanently set to `BULLISH`.

```cobol
       01  WS-VIBES               PIC X(10) VALUE "BULLISH".
```

I should have stopped there.

## The Language

"What if every keyword was crypto slang?" is the kind of question that only sounds fun until you actually commit to it. But we committed.

In **BroLang**, you don't write `if/else` — you write `wagmi/ngmi`. You don't `return` — you `paper_hands`. Functions are `based`. Loops run `to_the_moon`. Comments start with `nfa` (not financial advice). And when something goes wrong, you `rug`.

Here's a real function that calculates swap output for a constant-product AMM:

```
based get_amount_out(amount_in, reserve_in, reserve_out)
  ser amount_with_fee is amount_in times (BPS minus FEE_BPS)
  ser numerator is amount_with_fee times reserve_out
  ser denominator is (reserve_in times BPS) plus amount_with_fee
  paper_hands numerator divided_by denominator
gg
```

The first version was a transpiler — BroLang to JavaScript, then `eval()`. It worked. We wrote an entire Uniswap V2 AMM simulation in it: liquidity pools, swaps with 0.3% fees, LP token minting and burning. A whale deposits, a degen apes in, paper hands dumps, an arb bot corrects the price. The output was correct to the decimal.

But then I asked the question that ruined my Sunday.

## "What If It Actually Compiled?"

Not transpiled. Not `eval()`. Actually compiled — like a real language.

So we built one. A real compiler pipeline:

```
source.bro → Lexer → Tokens → Parser → AST → Compiler → Bytecode → VM
```

**The Lexer** tokenizes BroLang source into typed tokens. Multi-word keywords like `paper_hands` and `to_the_moon` get recognized as single tokens.

**The Parser** implements precedence-climbing expression parsing. `times` and `divided_by` bind tighter than `plus` and `minus`. `and`/`or` bind loosest. It builds a proper abstract syntax tree.

**The Compiler** walks the AST and emits bytecode — real opcodes like `0x01 CONST`, `0x10 ADD`, `0x51 JMP_FALSE`, `0x60 CALL`. Function parameters become local variable slots. Jumps get patched for `wagmi/ngmi/fr` blocks and `to_the_moon` loops.

**The VM** is a stack machine. Operand stack, call stack with frame management, global variable hash map, local variable slots, constant pool per function. Same architecture as CPython or the JVM. Minus the decades of optimization. Plus more vibes.

Here's what the `get_amount_out` function looks like after compilation:

```
── based get_amount_out(amount_in, reserve_in, reserve_out) ──
  Code:
    0000  LOAD_LOCAL     0 (slot[0])
    0002  LOAD           0 ("BPS")
    0004  LOAD           1 ("FEE_BPS")
    0006  SUB
    0007  MUL
    0008  STORE          2 ("amount_with_fee")
    ...
    0031  DIV
    0032  RETURN
```

No JavaScript anywhere. Just opcodes and a stack.

## "Can It Run DOOM?"

Obviously the next question. And obviously the answer had to be yes.

We built a raycasting engine in BroLang. The classic Wolfenstein/DOOM technique: for each column of the screen, cast a ray from the player's position, march it forward until it hits a wall, calculate the wall height based on distance, and draw a vertical strip. Do this 80 times and you have a 3D-looking scene.

The first version used ASCII characters for shading — `@#%=-.` from close to far. It worked, but it looked like 1993.

So we added half-block Unicode rendering. The character `▀` (upper half block) lets you pack two pixels per terminal cell vertically, using ANSI foreground color for the top pixel and background color for the bottom pixel. With 24-bit color escape codes (`\x1b[38;2;R;G;Bm`), each cell becomes two independently-colored pixels. An 80×48 pixel framebuffer renders in an 80×24 character terminal. True-color DOOM in a terminal.

We added native functions to the VM for performance-critical operations: `vline` draws a vertical line in a single native call instead of 40 bytecode `pixel` calls. `rect` fills rectangles. `hflush` renders the pixel buffer using the half-block technique. The BroLang code handles the game logic, the natives handle the pixel pushing.

Then we added:
- Wall side-shading (east/west faces darker, like real DOOM)
- Ceiling and floor depth gradients
- A pixel-art gun sprite with muzzle flash animation
- A DOOM-style HUD with HP bar, ammo bar, kill counter, and a pixel-art DOOM face that grimaces when you're low on health
- A minimap showing the level layout and enemy positions
- 3 levels, 3 weapons, and jumping
- Mobile touch controls (yes, DOOM.bro runs on phones)

## Making It Playable

A demo is cool. A game is better.

The tricky part was keyboard input. The VM runs a synchronous game loop, but Node.js stdin is async. A busy-wait `sleep()` blocks the event loop, so key events never fire. The fix: `stty -icanon -echo min 0 time 0` puts the terminal into raw non-blocking mode, and `fs.readSync(0)` reads directly from file descriptor 0. Returns immediately with whatever bytes are available. No event loop needed.

Then we added enemies. Four imps placed around the map, rendered as billboard sprites — 2D pixel art that always faces the camera, scaled by distance. A depth buffer (one float per column, written during raycasting) handles occlusion: sprites behind walls don't render.

The imps have AI. Simple, but effective: each frame, they calculate the direction to the player, normalize it, and walk toward you. Wall collision with sliding, same as the player. When they get close, they hurt you. When you shoot them (spacebar), the game checks if any living enemy is within ~10 degrees of the crosshair and closer than the wall behind it. Three hits and they die. Kill all four to win.

The imps flash white when hit. The crosshair shows red hit markers. The DOOM face changes expression based on your health. The screen edges glow red when you're below 30 HP.

All of it — the raycaster, the sprite renderer, the AI, the input handling, the game loop — written in BroLang. Compiled to bytecode. Running on a stack machine.

## Then It Became a Real Language

At this point, Sunday was over. But we kept going.

**COBOL-bro hybrid syntax.** BroLang picked up its COBOL heritage: `IDENTIFICATION DIVISION`, `PROCEDURE DIVISION`, `APE_IN`/`APE_OUT` for block delimiters, `STOP RUG` to end a program. Functions can be written either way — lowercase `gm/gn/gg` for quick scripts or uppercase COBOL-style for proper programs.

**A module system.** `APE_INTO degen_math` imports a standard library. We built four modules: `degen_math` (floor, ceil, sqrt, pow, abs, min, max, pi), `degen_string` (char_at, upper, lower, trim, contains, replace, substr — 14 functions), `degen_array` (push, pop, map, filter, reduce, sort), and `degen_time` (now). Full test suite, all passing.

**Modern language features.** String interpolation (`"Hello {name}"`), the pipe operator (`5 PUMP double PUMP add(3)`), for-each loops (`SWEEP fruit IN fruits`), and lambdas (`ANON(x) x TIMES x`). Real language features, stupid names.

```
SER result is 10 PUMP double PUMP double
SHILL "result = {result}"

SWEEP fruit IN ["apple", "banana", "mango"] APE_IN
  SHILL "  fruit: {fruit}"
APE_OUT
```

## The RPG

Because obviously a language needs lore.

**The Legend of BroLang** is a top-down RPG written entirely in BroLang. You walk around a pixel-art world (80x48 canvas, half-block rendering, same engine as DOOM) and talk to NPCs who are literally the compiler pipeline: The Lexer, The Parser, The VM, and The DOOM Demon.

Each NPC explains their role in the compilation process. The Lexer talks about tokenizing source code. The Parser explains AST construction. The VM describes stack operations. The DOOM Demon... just wants you to play DOOM.

The whole thing — tile maps, NPC AI, dialogue system, pixel-art sprites, camera scrolling, collision detection — is 500 lines of BroLang.

## Compiling to Native x86-64

The bytecode VM was fun, but real languages compile to machine code.

So we built `brolang-native.js`. A compiler that takes BroLang source and emits a standalone Linux ELF binary. No JavaScript. No Node.js. No C runtime. No linker. Just raw `x86-64` instructions and Linux syscalls.

```bash
node brolang-native.js hello-native.bro    # produces hello-native.elf
chmod +x hello-native.elf
./hello-native.elf                          # prints "gm ser"
```

The compiler emits x86-64 machine code bytes directly. `mov rax, 1` for write syscall. `mov rdi, 1` for stdout. String literals go in a data section. Function calls use the System V AMD64 calling convention. The ELF header, program headers, sections — all assembled byte by byte.

The output binary is a few kilobytes. It runs on bare Linux kernel with zero dependencies. `strace` shows exactly three syscalls: `write`, `write`, `exit`. No dynamic loading, no glibc, no interpreters.

## Deploying to Solana

This is where the joke stopped being a joke.

We built `brolang-sbf.js` — a compiler that emits Solana BPF (SBF) bytecode. The same instruction set that Solana validators execute on-chain. Not a wrapper around Anchor. Not Rust compiled through Cargo. Raw BPF instructions, assembled into an ELF binary, deployable to Solana devnet.

```
IDENTIFICATION DIVISION.
PROGRAM-ID. GM-ONCHAIN.
VIBES. DEPLOYED.

SHILL "gm ser"
SHILL "this is brolang on solana"
SHILL "no rust. no anchor. raw bpf."
SHILL "wagmi"

STOP RUG.
```

The SBF compiler emits 8-byte fixed-width instructions: `[opcode:8][dst_reg:4][src_reg:4][offset:16][imm:32]`. Strings go into a `.rodata` section with `lddw` relocation entries so the Solana runtime can fix up pointers. The `SHILL` keyword compiles to a `sol_log` syscall — the Solana equivalent of `console.log`. The entrypoint follows the Solana BPF calling convention: input pointer in `r1`, return `0` for success.

Getting the ELF right took three attempts. First: the noop program deployed and executed but couldn't log. The `.rodata` section needed proper `R_BPF_64_ABS64` relocations so the runtime could patch absolute addresses for string pointers. Second: the relocations were right but `lddw` (load double word) is a 16-byte pseudo-instruction that occupies two instruction slots, and the program counter math was off by one. Third time: it worked.

```bash
node brolang-sbf.js hello-solana.bro        # produces hello-solana.so
solana program deploy hello-solana.so       # deploys to devnet
solana program invoke <PROGRAM_ID>          # prints "gm ser" in the log
```

`sol_log: "gm ser"` appeared in the Solana Explorer. A program written in crypto-bro speak, compiled from a meme language to raw BPF instructions, executing on the Solana blockchain. No Rust. No Anchor. No SDK.

The program ID exists on devnet. You can verify it.

## The Landing Page

We shipped a website: [piske-alex.github.io/brolang](https://piske-alex.github.io/brolang/)

It has playable DOOM in the browser (using a Canvas renderer instead of terminal escape codes), a live BroLang REPL where you can write and execute code, and tabs for both human documentation and `llms.txt` — a machine-readable spec that AI agents can consume to write BroLang.

The landing page has mobile support. You can play DOOM.bro on your phone.

## The Stack

This is the full compilation pipeline we built in 3 days:

```
source.bro
    ↓
  Lexer → Tokens
    ↓
  Parser → AST
    ↓
    ├── Compiler → Bytecode → VM           (interpreted)
    ├── x86-64 Compiler → ELF binary       (native Linux)
    └── SBF Compiler → Solana ELF → chain  (on-chain)
```

Three compiler backends. One lexer/parser frontend. The same BroLang source can run as interpreted bytecode, as a native Linux binary, or as a Solana program.

## Try It

```bash
git clone https://github.com/piske-alex/brolang
cd brolang

# Run the Uniswap AMM simulation
node brolang-vm.js uniswap-compiled.bro

# Play DOOM (interactive — kill 4 imps)
node brolang-vm.js doom-play.bro

# Play the RPG
node brolang-vm.js rpg.bro

# Compile to native x86-64 binary
node brolang-native.js hello-native.bro
chmod +x hello-native.elf && ./hello-native.elf

# Compile to Solana BPF
node brolang-sbf.js hello-solana.bro
# Deploy: solana program deploy hello-solana.so

# Show compiled bytecode
node brolang-vm.js uniswap-compiled.bro --dump
```

Or if you have Claude Code, just paste this:

```
clone https://github.com/piske-alex/brolang and run node brolang-vm.js doom-hires.bro inside the repo
```

## What I Learned

**Claude Code is absurdly good at pair programming for weird projects.** I didn't write a single line of this. I described what I wanted, made jokes, pushed back when things broke, and said "more" when it wasn't enough. Claude handled the lexer, parser, three compiler backends, VM, raycaster, sprite renderer, input system, enemy AI, RPG engine, SBF bytecode encoding, ELF binary generation, landing page, and this blog post. The entire project — from COBOL joke to on-chain deployment — happened in 3 days.

**The "can it run DOOM" test is an actual good benchmark.** It forces you to build: real-time rendering, game loops, input handling, sprite systems, collision detection, state management. If your language/VM can run DOOM, it can run most things.

**The "can it deploy to Solana" test is even better.** ELF format, relocations, syscall conventions, fixed-width instruction encoding, proper entrypoint signatures. Getting bytes to execute on someone else's validator is the ultimate "it works" test. No mock, no simulation, no test harness — either the chain accepts it or it doesn't.

**Joke projects can be technically real.** BroLang has a legitimate compiler pipeline with three backends. The bytecode VM is architecturally similar to CPython. The native compiler emits the same machine code GCC would for simple programs. The SBF compiler produces the same bytecode Anchor does. The keywords are stupid. The engineering is not.

**The escalation pattern is the product.** COBOL joke → transpiler → compiler → DOOM → native binary → Solana deployment. Each step felt like the obvious next question. The trick is never saying no to the next question. The project itself is the punchline, but each layer is technically sound. That's what makes it funny — it's not fake. Everything actually works.

And most importantly: **wagmi.**

---

*[BroLang on GitHub](https://github.com/piske-alex/brolang) — Star it if you think `paper_hands` is a better keyword than `return`.*

*Built by [Alex](https://github.com/piske-alex), CTO at [Lavarage](https://lavarage.xyz) — a leveraged trading protocol on Solana. Pair-programmed with [Claude Code](https://claude.ai/code).*
