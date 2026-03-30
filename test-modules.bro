IDENTIFICATION DIVISION.
PROGRAM-ID. MODULE-TEST.
VIBES. MODULAR.

APE_INTO degen_math
APE_INTO degen_string
APE_INTO degen_array
APE_INTO degen_time

DATA DIVISION.
SER passed is 0

PROCEDURE DIVISION.

BASED assert(label, got, expected) APE_IN
  WAGMI got EQUALS expected APE_IN
    SHILL "  PASS: " PLUS label
    passed is passed PLUS 1
  APE_OUT NGMI APE_IN
    SHILL "  FAIL: " PLUS label PLUS " (got " PLUS got PLUS ", expected " PLUS expected PLUS ")"
  APE_OUT
APE_OUT

MAIN SECTION.

SHILL "==========================================="
SHILL "  BroLang Module System Tests"
SHILL "==========================================="
SHILL ""

SHILL "--- degen_math ---"
assert("floor", floor(3.7), 3)
assert("ceil", ceil(3.2), 4)
assert("sqrt", floor(sqrt(16)), 4)
assert("abs", abs(0 minus 42), 42)
assert("min", min(5, 3, 8), 3)
assert("max", max(5, 3, 8), 8)
assert("pow", pow(2, 10), 1024)
assert("round", round(3.5), 4)
assert("pi exists", floor(pi() times 100), 314)
SHILL ""

SHILL "--- degen_string ---"
assert("char_at", char_at("hello", 1), "e")
assert("str_len", str_len("wagmi"), 5)
assert("upper", upper("gm"), "GM")
assert("lower", lower("WAGMI"), "wagmi")
assert("trim", trim("  hi  "), "hi")
assert("contains", contains("wagmi ser", "ser"), 1)
assert("starts_with", starts_with("brolang", "bro"), 1)
assert("ends_with", ends_with("brolang", "lang"), 1)
assert("substr", substr("hello world", 0, 5), "hello")
assert("replace", replace("hello world", "world", "bro"), "hello bro")
assert("to_number", to_number("42"), 42)
assert("to_string", to_string(42), "42")
assert("repeat", repeat("gm ", 3), "gm gm gm ")
SHILL ""

SHILL "--- degen_array ---"
SER arr is arr_new()
arr_push(arr, 10)
arr_push(arr, 30)
arr_push(arr, 20)
assert("arr_len", arr_len(arr), 3)
assert("arr_get", arr_get(arr, 1), 30)
arr_set(arr, 1, 99)
assert("arr_set", arr_get(arr, 1), 99)
assert("arr_contains", arr_contains(arr, 10), 1)
assert("arr_index_of", arr_index_of(arr, 99), 1)
SER popped is arr_pop(arr)
assert("arr_pop", popped, 20)
assert("arr_len after pop", arr_len(arr), 2)
SHILL ""

SHILL "--- degen_time ---"
SER t1 is now()
SER t2 is now()
assert("now returns number", t2 gte t1, few)
SHILL ""

SHILL "==========================================="
SHILL "  " PLUS passed PLUS " tests passed"
SHILL "==========================================="
SHILL ""
SHILL "  wagmi."

STOP RUG.
