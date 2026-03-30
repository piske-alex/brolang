IDENTIFICATION DIVISION.
PROGRAM-ID. COBOL-BRO-TEST.
VIBES. IMMACULATE.

DATA DIVISION.
HODL GREETING is "gm ser"
SER count is 0
SER total is 0

PROCEDURE DIVISION.

BASED add(a, b) APE_IN
  PAPER_HANDS a PLUS b
APE_OUT

BASED greet(msg) APE_IN
  SHILL msg
  SHILL "vibes: immaculate"
APE_OUT

MAIN SECTION.

greet(GREETING)

SHILL "Testing ape_in/ape_out blocks:"

WAGMI 1 PLUS 1 EQUALS 2 APE_IN
  SHILL "  math works. few."
APE_OUT NGMI APE_IN
  SHILL "  math broken. cope."
APE_OUT

SHILL "Testing COBOL-style periods:"
SER result is add(10, 20)
SHILL "  10 + 20 = " PLUS result

SHILL "Testing loops with ape_in/ape_out:"
TO_THE_MOON count LESS_THAN 5 APE_IN
  total is total PLUS count
  count is count PLUS 1
APE_OUT
SHILL "  sum(0..4) = " PLUS total

SHILL "Testing mixed case keywords:"
ser x is 42
WAGMI x GREATER_THAN 40 APE_IN
  SHILL "  x is " PLUS x PLUS " (WAGMI)"
APE_OUT

SHILL ""
SHILL "All tests passed. wagmi."

STOP RUG.
