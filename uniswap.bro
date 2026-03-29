gm

nfa =============================================
nfa   UNISWAP V2 CONSTANT PRODUCT AMM
nfa   Written in BroLang — the language of degens
nfa   NFA. DYOR. Probably nothing.
nfa =============================================

nfa --- Protocol constants ---
hodl FEE_BPS is 30
hodl BPS is 10000
hodl MINIMUM_LIQUIDITY is 1000

nfa --- Pool state ---
ser reserve_sol is 0
ser reserve_usdc is 0
ser total_lp is 0
ser protocol_fees is 0

nfa =============================================
nfa   CORE AMM FUNCTIONS
nfa =============================================

nfa Calculate output amount using x * y = k
based get_amount_out(amount_in, reserve_in, reserve_out)
  ser amount_with_fee is amount_in times (BPS minus FEE_BPS)
  ser numerator is amount_with_fee times reserve_out
  ser denominator is (reserve_in times BPS) plus amount_with_fee
  paper_hands numerator divided_by denominator
gg

nfa Calculate how much you need to put in to get exact output
based get_amount_in(amount_out, reserve_in, reserve_out)
  ser numerator is reserve_in times amount_out times BPS
  ser denominator is (reserve_out minus amount_out) times (BPS minus FEE_BPS)
  paper_hands (numerator divided_by denominator) plus 1
gg

nfa Get the current price (USDC per SOL)
based get_price()
  wagmi reserve_sol equals 0
    paper_hands 0
  fr
  paper_hands reserve_usdc divided_by reserve_sol
gg

nfa =============================================
nfa   LIQUIDITY FUNCTIONS
nfa =============================================

nfa Add liquidity — returns LP tokens minted
based add_liquidity(sol_amount, usdc_amount)
  ser lp_minted is 0

  wagmi total_lp equals 0
    nfa First deposit — LP = sqrt(sol * usdc) - MINIMUM_LIQUIDITY
    lp_minted is lfg Math.floor(lfg Math.sqrt(sol_amount times usdc_amount)) minus MINIMUM_LIQUIDITY
    shill "  First LP! Burning " plus MINIMUM_LIQUIDITY plus " LP tokens for safety"
  ngmi
    nfa Subsequent deposits — proportional to existing reserves
    ser lp_from_sol is lfg Math.floor(sol_amount times total_lp divided_by reserve_sol)
    ser lp_from_usdc is lfg Math.floor(usdc_amount times total_lp divided_by reserve_usdc)
    lp_minted is lfg Math.min(lp_from_sol, lp_from_usdc)
  fr

  reserve_sol is reserve_sol plus sol_amount
  reserve_usdc is reserve_usdc plus usdc_amount
  total_lp is total_lp plus lp_minted

  shill "  Deposited " plus sol_amount plus " SOL + " plus usdc_amount plus " USDC"
  shill "  Minted " plus lp_minted plus " LP tokens"
  shill "  Pool: " plus reserve_sol plus " SOL / " plus reserve_usdc plus " USDC"
  shill "  Total LP supply: " plus total_lp
  shill ""

  paper_hands lp_minted
gg

nfa Remove liquidity — returns [sol_out, usdc_out]
based remove_liquidity(lp_amount)
  ser sol_out is lfg Math.floor(lp_amount times reserve_sol divided_by total_lp)
  ser usdc_out is lfg Math.floor(lp_amount times reserve_usdc divided_by total_lp)

  reserve_sol is reserve_sol minus sol_out
  reserve_usdc is reserve_usdc minus usdc_out
  total_lp is total_lp minus lp_amount

  shill "  Burned " plus lp_amount plus " LP tokens"
  shill "  Withdrew " plus sol_out plus " SOL + " plus usdc_out plus " USDC"
  shill "  Pool: " plus reserve_sol plus " SOL / " plus reserve_usdc plus " USDC"
  shill ""

  paper_hands [sol_out, usdc_out]
gg

nfa =============================================
nfa   SWAP FUNCTIONS
nfa =============================================

nfa Swap SOL for USDC (sell SOL)
based swap_sol_for_usdc(sol_in)
  ser usdc_out is lfg get_amount_out(sol_in, reserve_sol, reserve_usdc)

  reserve_sol is reserve_sol plus sol_in
  reserve_usdc is reserve_usdc minus usdc_out

  ser price_after is lfg get_price()

  shill "  Swapped " plus sol_in plus " SOL -> " plus usdc_out plus " USDC"
  shill "  Price after: " plus lfg price_after.toFixed(2) plus " USDC/SOL"
  shill "  k = " plus (reserve_sol times reserve_usdc)
  shill ""

  paper_hands usdc_out
gg

nfa Swap USDC for SOL (buy SOL)
based swap_usdc_for_sol(usdc_in)
  ser sol_out is lfg get_amount_out(usdc_in, reserve_usdc, reserve_sol)

  reserve_usdc is reserve_usdc plus usdc_in
  reserve_sol is reserve_sol minus sol_out

  ser price_after is lfg get_price()

  shill "  Swapped " plus usdc_in plus " USDC -> " plus sol_out plus " SOL"
  shill "  Price after: " plus lfg price_after.toFixed(2) plus " USDC/SOL"
  shill "  k = " plus (reserve_sol times reserve_usdc)
  shill ""

  paper_hands sol_out
gg

nfa =============================================
nfa   SIMULATION — A DAY IN THE LIFE OF A POOL
nfa =============================================

shill "==========================================="
shill "  BROLANG DEX — Constant Product AMM"
shill "  SOL/USDC Pool"
shill "  Fee: 0.3% (30 bps) — just like Uni V2"
shill "==========================================="
shill ""

nfa --- Chapter 1: Whale provides initial liquidity ---
shill "--- Chapter 1: Whale provides initial liquidity ---"
ser whale_lp is lfg add_liquidity(1000, 150000)
shill "  Initial price: " plus lfg get_price().toFixed(2) plus " USDC/SOL"
shill ""

nfa --- Chapter 2: Degen apes into SOL ---
shill "--- Chapter 2: Degen buys SOL with 10000 USDC ---"
ser sol_bought is lfg swap_usdc_for_sol(10000)

nfa --- Chapter 3: Paper hands dumps ---
shill "--- Chapter 3: Paper hands dumps 50 SOL ---"
ser usdc_received is lfg swap_sol_for_usdc(50)

nfa --- Chapter 4: Arbitrageur corrects the price ---
shill "--- Chapter 4: Arb bot buys 5000 USDC worth ---"
ser arb_sol is lfg swap_usdc_for_sol(5000)

nfa --- Chapter 5: Another degen market buys ---
shill "--- Chapter 5: Small fish buys with 500 USDC ---"
ser smol_sol is lfg swap_usdc_for_sol(500)

nfa --- Chapter 6: Whale removes liquidity ---
shill "--- Chapter 6: Whale removes half their LP ---"
ser half_lp is lfg Math.floor(whale_lp divided_by 2)
ser withdrawn is lfg remove_liquidity(half_lp)

nfa --- Final state ---
shill "==========================================="
shill "  FINAL POOL STATE"
shill "==========================================="
shill "  Reserve SOL:  " plus reserve_sol
shill "  Reserve USDC: " plus reserve_usdc
shill "  Price:        " plus lfg get_price().toFixed(2) plus " USDC/SOL"
shill "  LP supply:    " plus total_lp
shill "  k:            " plus (reserve_sol times reserve_usdc)
shill "==========================================="
shill ""
shill "  wagmi."
shill ""

gn
