# BroLang Language Specification

> The world's first crypto-native programming language. NFA. DYOR.

## Keywords

| BroLang              | Meaning              | JavaScript equivalent     |
|----------------------|----------------------|---------------------------|
| `gm`                 | program start        | (file header)             |
| `gn`                 | program end          | (file footer)             |
| `ser`                | declare variable     | `let`                     |
| `hodl`               | declare constant     | `const`                   |
| `based`              | define function      | `function`                |
| `gg`                 | end block            | `}`                       |
| `paper_hands`        | return value         | `return`                  |
| `wagmi`              | if (true branch)     | `if`                      |
| `ngmi`               | else                 | `else`                    |
| `fr`                 | end if               | `}`                       |
| `to_the_moon`        | while loop           | `while`                   |
| `touch_grass`        | break                | `break`                   |
| `lfg`                | call / execute       | (function call)           |
| `shill`              | print                | `console.log`             |
| `rug`                | throw error          | `throw new Error`         |
| `ape_in`             | push to array        | `.push`                   |
| `probably_nothing`   | null                 | `null`                    |
| `few`                | true                 | `true`                    |
| `cope`               | false                | `false`                   |
| `nfa`                | comment              | `//`                      |

## Operators

| BroLang         | JS        |
|-----------------|-----------|
| `plus`          | `+`       |
| `minus`         | `-`       |
| `times`         | `*`       |
| `divided_by`    | `/`       |
| `mod`           | `%`       |
| `is`            | `=`       |
| `equals`        | `===`     |
| `greater_than`  | `>`       |
| `less_than`     | `<`       |
| `gte`           | `>=`      |
| `lte`           | `<=`      |
| `and`           | `&&`      |
| `or`            | `||`      |
| `not`           | `!`       |

## Syntax

```
gm

nfa This is a comment — not financial advice

hodl FEE_BPS is 30
ser my_bag is 0

based swap(amount_in, reserve_in, reserve_out)
  ser k is reserve_in times reserve_out
  ser new_reserve_in is reserve_in plus amount_in
  ser amount_out is reserve_out minus (k divided_by new_reserve_in)
  ser fee is amount_out times FEE_BPS divided_by 10000
  paper_hands amount_out minus fee
gg

wagmi amount greater_than 0
  shill "LFG"
ngmi
  rug "ngmi ser"
fr

to_the_moon i less_than 10
  shill i
gg

gn
```
