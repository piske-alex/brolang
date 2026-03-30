IDENTIFICATION DIVISION.
PROGRAM-ID. UNISWAP-BRO.
VIBES. BULLISH.

DATA DIVISION.
HODL FEE_BPS is 30
HODL BPS is 10000
HODL MINIMUM_LIQUIDITY is 1000

SER reserve_sol is 0
SER reserve_usdc is 0
SER total_lp is 0

PROCEDURE DIVISION.

BASED get_amount_out(amount_in, reserve_in, reserve_out) APE_IN
  SER amount_with_fee is amount_in TIMES (BPS MINUS FEE_BPS)
  SER numerator is amount_with_fee TIMES reserve_out
  SER denominator is (reserve_in TIMES BPS) PLUS amount_with_fee
  PAPER_HANDS numerator DIVIDED_BY denominator
APE_OUT

BASED get_price() APE_IN
  WAGMI reserve_sol EQUALS 0 APE_IN
    PAPER_HANDS 0
  APE_OUT
  PAPER_HANDS reserve_usdc DIVIDED_BY reserve_sol
APE_OUT

BASED round2(x) APE_IN
  PAPER_HANDS Math.floor(x TIMES 100) DIVIDED_BY 100
APE_OUT

BASED add_liquidity(sol_amount, usdc_amount) APE_IN
  SER lp_minted is 0

  WAGMI total_lp EQUALS 0 APE_IN
    lp_minted is Math.floor(Math.sqrt(sol_amount TIMES usdc_amount)) MINUS MINIMUM_LIQUIDITY
    SHILL "  First LP! Burning 1000 LP tokens for safety"
  APE_OUT NGMI APE_IN
    SER lp_from_sol is Math.floor(sol_amount TIMES total_lp DIVIDED_BY reserve_sol)
    SER lp_from_usdc is Math.floor(usdc_amount TIMES total_lp DIVIDED_BY reserve_usdc)
    lp_minted is Math.min(lp_from_sol, lp_from_usdc)
  APE_OUT

  reserve_sol is reserve_sol PLUS sol_amount
  reserve_usdc is reserve_usdc PLUS usdc_amount
  total_lp is total_lp PLUS lp_minted

  SHILL "  Deposited " PLUS sol_amount PLUS " SOL + " PLUS usdc_amount PLUS " USDC"
  SHILL "  Minted " PLUS lp_minted PLUS " LP tokens"
  SHILL "  Pool: " PLUS reserve_sol PLUS " SOL / " PLUS reserve_usdc PLUS " USDC"
  SHILL ""

  PAPER_HANDS lp_minted
APE_OUT

BASED swap_usdc_for_sol(usdc_in) APE_IN
  SER sol_out is get_amount_out(usdc_in, reserve_usdc, reserve_sol)

  reserve_usdc is reserve_usdc PLUS usdc_in
  reserve_sol is reserve_sol MINUS sol_out

  SHILL "  Swapped " PLUS usdc_in PLUS " USDC -> " PLUS round2(sol_out) PLUS " SOL"
  SHILL "  Price: " PLUS round2(get_price()) PLUS " USDC/SOL"
  SHILL ""

  PAPER_HANDS sol_out
APE_OUT

BASED swap_sol_for_usdc(sol_in) APE_IN
  SER usdc_out is get_amount_out(sol_in, reserve_sol, reserve_usdc)

  reserve_sol is reserve_sol PLUS sol_in
  reserve_usdc is reserve_usdc MINUS usdc_out

  SHILL "  Swapped " PLUS sol_in PLUS " SOL -> " PLUS round2(usdc_out) PLUS " USDC"
  SHILL "  Price: " PLUS round2(get_price()) PLUS " USDC/SOL"
  SHILL ""

  PAPER_HANDS usdc_out
APE_OUT

MAIN SECTION.

SHILL "==========================================="
SHILL "  COBOL-BRO DEX — Constant Product AMM"
SHILL "  SOL/USDC Pool | Fee: 0.3%"
SHILL "  Now with IDENTIFICATION DIVISION."
SHILL "==========================================="
SHILL ""

SHILL "--- Whale provides initial liquidity ---"
SER whale_lp is add_liquidity(1000, 150000)
SHILL "  Initial price: " PLUS round2(get_price()) PLUS " USDC/SOL"
SHILL ""

SHILL "--- Degen buys SOL with 10000 USDC ---"
SER sol_bought is swap_usdc_for_sol(10000)

SHILL "--- Paper hands dumps 50 SOL ---"
SER usdc_received is swap_sol_for_usdc(50)

SHILL "--- Arb bot buys 5000 USDC worth ---"
SER arb_sol is swap_usdc_for_sol(5000)

SHILL "==========================================="
SHILL "  FINAL STATE"
SHILL "==========================================="
SHILL "  Reserve SOL:  " PLUS round2(reserve_sol)
SHILL "  Reserve USDC: " PLUS round2(reserve_usdc)
SHILL "  Price:        " PLUS round2(get_price()) PLUS " USDC/SOL"
SHILL "==========================================="
SHILL ""
SHILL "  WAGMI."

STOP RUG.
