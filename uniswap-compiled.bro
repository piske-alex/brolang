gm

nfa =============================================
nfa   UNISWAP V2 CONSTANT PRODUCT AMM
nfa   Compiled to bytecode. Executed on BroLang VM.
nfa   No transpilation. No eval. Pure stack machine.
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

nfa Get the current price (USDC per SOL)
based get_price()
  wagmi reserve_sol equals 0
    paper_hands 0
  fr
  paper_hands reserve_usdc divided_by reserve_sol
gg

nfa Round to 2 decimal places (no .toFixed needed in the VM)
based round2(x)
  paper_hands Math.floor(x times 100) divided_by 100
gg

nfa =============================================
nfa   LIQUIDITY
nfa =============================================

based add_liquidity(sol_amount, usdc_amount)
  ser lp_minted is 0

  wagmi total_lp equals 0
    lp_minted is Math.floor(Math.sqrt(sol_amount times usdc_amount)) minus MINIMUM_LIQUIDITY
    shill "  First LP! Burning 1000 LP tokens for safety"
  ngmi
    ser lp_from_sol is Math.floor(sol_amount times total_lp divided_by reserve_sol)
    ser lp_from_usdc is Math.floor(usdc_amount times total_lp divided_by reserve_usdc)
    lp_minted is Math.min(lp_from_sol, lp_from_usdc)
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

based remove_liquidity(lp_amount)
  ser sol_out is Math.floor(lp_amount times reserve_sol divided_by total_lp)
  ser usdc_out is Math.floor(lp_amount times reserve_usdc divided_by total_lp)

  reserve_sol is reserve_sol minus sol_out
  reserve_usdc is reserve_usdc minus usdc_out
  total_lp is total_lp minus lp_amount

  shill "  Burned " plus lp_amount plus " LP tokens"
  shill "  Withdrew " plus sol_out plus " SOL + " plus usdc_out plus " USDC"
  shill "  Pool: " plus reserve_sol plus " SOL / " plus reserve_usdc plus " USDC"
  shill ""

  paper_hands sol_out
gg

nfa =============================================
nfa   SWAPS
nfa =============================================

based swap_sol_for_usdc(sol_in)
  ser usdc_out is get_amount_out(sol_in, reserve_sol, reserve_usdc)

  reserve_sol is reserve_sol plus sol_in
  reserve_usdc is reserve_usdc minus usdc_out

  ser price is round2(get_price())

  shill "  Swapped " plus sol_in plus " SOL -> " plus round2(usdc_out) plus " USDC"
  shill "  Price after: " plus price plus " USDC/SOL"
  shill "  k = " plus round2(reserve_sol times reserve_usdc)
  shill ""

  paper_hands usdc_out
gg

based swap_usdc_for_sol(usdc_in)
  ser sol_out is get_amount_out(usdc_in, reserve_usdc, reserve_sol)

  reserve_usdc is reserve_usdc plus usdc_in
  reserve_sol is reserve_sol minus sol_out

  ser price is round2(get_price())

  shill "  Swapped " plus usdc_in plus " USDC -> " plus round2(sol_out) plus " SOL"
  shill "  Price after: " plus price plus " USDC/SOL"
  shill "  k = " plus round2(reserve_sol times reserve_usdc)
  shill ""

  paper_hands sol_out
gg

nfa =============================================
nfa   SIMULATION
nfa =============================================

shill "==========================================="
shill "  BROLANG DEX — Bytecode-Compiled AMM"
shill "  SOL/USDC Pool"
shill "  Fee: 0.3% (30 bps) — just like Uni V2"
shill "  Powered by: BroLang VM (stack machine)"
shill "==========================================="
shill ""

nfa --- Chapter 1: Whale seeds the pool ---
shill "--- Chapter 1: Whale provides initial liquidity ---"
ser whale_lp is add_liquidity(1000, 150000)
shill "  Initial price: " plus round2(get_price()) plus " USDC/SOL"
shill ""

nfa --- Chapter 2: Degen apes in ---
shill "--- Chapter 2: Degen buys SOL with 10000 USDC ---"
ser sol_bought is swap_usdc_for_sol(10000)

nfa --- Chapter 3: Paper hands dumps ---
shill "--- Chapter 3: Paper hands dumps 50 SOL ---"
ser usdc_received is swap_sol_for_usdc(50)

nfa --- Chapter 4: Arb bot ---
shill "--- Chapter 4: Arb bot buys 5000 USDC worth ---"
ser arb_sol is swap_usdc_for_sol(5000)

nfa --- Chapter 5: Small fish ---
shill "--- Chapter 5: Small fish buys with 500 USDC ---"
ser smol_sol is swap_usdc_for_sol(500)

nfa --- Chapter 6: Whale exits ---
shill "--- Chapter 6: Whale removes half their LP ---"
ser half_lp is Math.floor(whale_lp divided_by 2)
ser withdrawn is remove_liquidity(half_lp)

nfa --- Final state ---
shill "==========================================="
shill "  FINAL POOL STATE"
shill "==========================================="
shill "  Reserve SOL:  " plus round2(reserve_sol)
shill "  Reserve USDC: " plus round2(reserve_usdc)
shill "  Price:        " plus round2(get_price()) plus " USDC/SOL"
shill "  LP supply:    " plus total_lp
shill "  k:            " plus round2(reserve_sol times reserve_usdc)
shill "==========================================="
shill ""
shill "  wagmi. (compiled & executed on the BroLang VM)"
shill ""

gn
