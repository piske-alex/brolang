IDENTIFICATION DIVISION.
PROGRAM-ID. MODERN-FEATURES.
VIBES. CUTTING-EDGE.

APE_INTO degen_math
APE_INTO degen_string
APE_INTO degen_array

PROCEDURE DIVISION.

BASED double(x) APE_IN
  PAPER_HANDS x TIMES 2
APE_OUT

BASED add(a, b) APE_IN
  PAPER_HANDS a PLUS b
APE_OUT

BASED greet(name) APE_IN
  PAPER_HANDS "gm " PLUS name PLUS " ser"
APE_OUT

MAIN SECTION.

SHILL "==========================================="
SHILL "  BroLang Modern Features Test"
SHILL "==========================================="
SHILL ""

nfa --- 1. String Interpolation ---
SHILL "--- String Interpolation ---"
SER name is "Satoshi"
SER balance is 42
SHILL "Hello {name}, you have {balance} SOL"
SHILL "1 + 1 = {1 plus 1}"
SHILL "sqrt(144) = {Math.floor(Math.sqrt(144))}"
SHILL ""

nfa --- 2. PUMP (Pipe Operator) ---
SHILL "--- Pipe Operator ---"
SER result is 5 PUMP double
SHILL "5 PUMP double = {result}"

SER result2 is 10 PUMP double PUMP double
SHILL "10 PUMP double PUMP double = {result2}"

SER msg is "world" PUMP greet
SHILL "msg: {msg}"

SER sum is 3 PUMP add(7)
SHILL "3 PUMP add(7) = {sum}"
SHILL ""

nfa --- 3. SWEEP (For-Each) ---
SHILL "--- Sweep (For-Each) ---"
SER fruits is ["apple", "banana", "mango"]
SWEEP fruit IN fruits APE_IN
  SHILL "  fruit: {fruit}"
APE_OUT

SER nums is [10, 20, 30, 40, 50]
SER total is 0
SWEEP n IN nums APE_IN
  total is total PLUS n
APE_OUT
SHILL "sum of [10,20,30,40,50] = {total}"
SHILL ""

nfa --- 4. ANON (Lambda) ---
SHILL "--- Lambda ---"
SER triple is ANON(x) x TIMES 3
SHILL "triple(7) = {triple(7)}"

SER square is ANON(x) x TIMES x
SHILL "square(9) = {square(9)}"

nfa Lambda stored then piped
SER sq_plus_one is ANON(x) x TIMES x PLUS 1
SER val is 5 PUMP sq_plus_one
SHILL "5 PUMP sq_plus_one = {val}"
SHILL ""

SHILL "==========================================="
SHILL "  All modern features working. wagmi."
SHILL "==========================================="

STOP RUG.
