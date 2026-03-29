# BroLang

The world's first crypto-native programming language. NFA. DYOR.

Every keyword is crypto-bro speak. Compiles to bytecode. Runs on a custom stack-based virtual machine. Can run DOOM.

## Quick Start

```bash
# Run the Uniswap AMM simulation
node brolang-vm.js uniswap-compiled.bro

# Run DOOM (non-interactive demo)
node brolang-vm.js doom-hires.bro

# Play DOOM (interactive — kill 4 imps)
node brolang-vm.js doom-play.bro

# Show compiled bytecode
node brolang-vm.js uniswap-compiled.bro --dump

# Show AST
node brolang-vm.js uniswap-compiled.bro --ast
```

## Language

| BroLang | Meaning | JavaScript |
|---------|---------|------------|
| `gm` | program start | |
| `gn` | program end | |
| `ser` | declare variable | `let` |
| `hodl` | declare constant | `const` |
| `based` | define function | `function` |
| `gg` | end block | `}` |
| `paper_hands` | return | `return` |
| `wagmi` | if | `if` |
| `ngmi` | else | `else` |
| `fr` | end if | `}` |
| `to_the_moon` | while loop | `while` |
| `touch_grass` | break | `break` |
| `shill` | print | `console.log` |
| `rug` | throw error | `throw` |
| `few` | true | `true` |
| `cope` | false | `false` |
| `probably_nothing` | null | `null` |
| `nfa` | comment | `//` |
| `plus` | + | `+` |
| `minus` | - | `-` |
| `times` | * | `*` |
| `divided_by` | / | `/` |
| `equals` | === | `===` |
| `greater_than` | > | `>` |
| `less_than` | < | `<` |
| `and` | && | `&&` |
| `or` | \|\| | `\|\|` |

## Architecture

```
source.bro → Lexer → Tokens → Parser → AST → Compiler → Bytecode → VM
                                                            ↑
                                                  0x01 CONST
                                                  0x10 ADD
                                                  0x12 MUL
                                                  0x51 JMP_FALSE
                                                  0x60 CALL
                                                  0x61 RETURN
                                                  0xFF HALT
```

No transpilation. No `eval()`. The source is lexed, parsed into an AST, compiled to bytecode opcodes, and executed on a stack-based virtual machine.

## The VM

The BroLang VM is a stack machine with:

- **Operand stack** — all computation happens here
- **Global variables** — stored by name in a hash map
- **Local variables** — function parameters in slot-indexed frames
- **Call stack** — function call/return with frame management
- **Constant pool** — per-chunk constant storage
- **Built-in functions** — `Math.floor`, `Math.sin`, `Math.sqrt`, etc.
- **Native functions** — `screen`, `draw`, `flush`, `pixel`, `vline`, `rect`, `hflush` (half-block rendering), `key` (game input), enemy/zbuf systems

### Half-Block Rendering

The hi-res renderer uses Unicode `▀` (upper half block) characters with 24-bit ANSI color to achieve 2x vertical resolution. An 80×48 pixel framebuffer renders in an 80×24 terminal grid, with per-pixel RGB color via `\x1b[38;2;R;G;Bm` (foreground = top pixel) and `\x1b[48;2;R;G;Bm` (background = bottom pixel).

## Example Programs

### Uniswap V2 AMM (`uniswap-compiled.bro`)

A complete constant-product AMM with:
- `get_amount_out()` with 0.3% fee
- `add_liquidity()` / `remove_liquidity()` with LP tokens
- `swap_sol_for_usdc()` / `swap_usdc_for_sol()`
- Full simulation: whale deposits, degen apes in, paper hands dumps, arb bot corrects, whale exits

### DOOM (`doom-play.bro`)

A playable first-person shooter with:
- Raycasting 3D engine
- True-color ANSI rendering (24-bit RGB)
- Billboard sprite enemies with depth-buffer occlusion
- Enemy AI (imps walk toward you, wall collision)
- Shooting with hit detection and muzzle flash
- Gun sprite, HUD with HP/ammo bars, DOOM face, minimap
- Wall side-shading (classic DOOM look)
- Win/death conditions

Controls: WASD move, Space shoot, Q quit.

## Files

| File | Description |
|------|-------------|
| `brolang.js` | Transpiler (BroLang → JavaScript) |
| `brolang-vm.js` | Compiler + VM (BroLang → Bytecode → Execute) |
| `spec.md` | Language specification |
| `uniswap.bro` | Uniswap AMM (for transpiler) |
| `uniswap-compiled.bro` | Uniswap AMM (for compiler/VM) |
| `doom.bro` | DOOM ASCII demo (character mode) |
| `doom-hires.bro` | DOOM hi-res demo (half-block, non-interactive) |
| `doom-play.bro` | DOOM playable (enemies, shooting, win condition) |
| `../gm.cob` | The COBOL GM microservice that started it all |

## Requirements

- Node.js 18+
- A terminal with Unicode and 24-bit color support (most modern terminals)
- For `doom-play.bro`: Linux/macOS/WSL (uses `stty` for raw input)

## License

MIT

## Origin Story

This started as a joke COBOL "GM microservice" on a Sunday afternoon, escalated to "what if we made a crypto programming language", then "can it compile instead of transpile", then "can it run DOOM", then "can it be higher resolution", then "can I actually play it". The answer to all of these was yes.

wagmi.
