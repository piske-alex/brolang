gm

nfa =============================================
nfa   D O O M . B R O   —   H I - R E S
nfa
nfa   True-color raycaster using half-block
nfa   Unicode rendering (▀) for 2x vertical
nfa   resolution with 24-bit RGB color.
nfa
nfa   80x48 pixel viewport in 80x24 terminal.
nfa   Compiled to bytecode. Stack VM.
nfa   Washing machine edition.
nfa =============================================

nfa --- Screen (pixel dimensions) ---
hodl SCR_W is 80
hodl VIEW_H is 40
hodl HUD_H is 8
hodl TOTAL_H is 48

nfa --- Map 16x16 ---
hodl MAP_W is 16
hodl MAP_H is 16
hodl MAP is "1111111111111111100000001000000110000000100000011000000000000001101110000001110110100000000010011010000000001001100000000000000110000000000000011000000000000001101000000000010110100000000001011011100000111001100000001000000110000000100000011111111111111111"

nfa --- Camera ---
hodl PI is 3.14159265
hodl FOV is 1.0472
hodl FOV_HALF is 0.5236
hodl MAX_DEPTH is 16.0
hodl RAY_STEP is 0.1

nfa --- Player ---
ser player_x is 2.0
ser player_y is 2.0
ser player_a is 0.3
ser last_side is 0

nfa =============================================
nfa   FUNCTIONS
nfa =============================================

based is_wall(mx, my)
  wagmi mx less_than 0 or mx gte MAP_W or my less_than 0 or my gte MAP_H
    paper_hands 1
  fr
  ser idx is my times MAP_W plus mx
  wagmi char_at(MAP, idx) equals "1"
    paper_hands 1
  fr
  paper_hands 0
gg

based cast_ray(px, py, angle)
  ser rx is Math.cos(angle)
  ser ry is Math.sin(angle)
  ser d is 0.0
  to_the_moon d less_than MAX_DEPTH
    ser hx is px plus rx times d
    ser hy is py plus ry times d
    ser tx is Math.floor(hx)
    ser ty is Math.floor(hy)
    ser hit is is_wall(tx, ty)
    wagmi hit equals 1
      nfa Detect wall face for side shading
      ser frac_x is hx minus Math.floor(hx)
      wagmi frac_x less_than 0.08 or frac_x greater_than 0.92
        last_side is 1
      ngmi
        last_side is 0
      fr
      paper_hands d
    fr
    d is d plus RAY_STEP
  gg
  paper_hands MAX_DEPTH
gg

nfa Clamp a value between min and max
based clamp(v, lo, hi)
  wagmi v less_than lo
    paper_hands lo
  fr
  wagmi v greater_than hi
    paper_hands hi
  fr
  paper_hands v
gg

nfa =============================================
nfa   GUN SPRITE (pixel art)
nfa =============================================

based draw_gun(is_firing)
  nfa Gun position (bottom center of viewport)
  ser gx is 33
  ser gy is 25

  nfa Muzzle flash
  wagmi is_firing equals 1
    rect(gx plus 5, gy minus 6, 4, 3, 255, 255, 120)
    rect(gx plus 6, gy minus 8, 2, 2, 255, 255, 200)
    pixel(gx plus 4, gy minus 5, 255, 200, 50)
    pixel(gx plus 9, gy minus 5, 255, 200, 50)
    pixel(gx plus 7, gy minus 9, 255, 255, 255)
  fr

  nfa Barrel (dark gray)
  rect(gx plus 5, gy minus 3, 4, 3, 120, 120, 130)

  nfa Slide (lighter metal)
  rect(gx plus 3, gy, 8, 4, 160, 160, 170)
  rect(gx plus 2, gy plus 1, 10, 2, 145, 145, 155)

  nfa Slide detail line
  rect(gx plus 3, gy plus 1, 8, 1, 130, 130, 140)

  nfa Trigger guard
  rect(gx plus 4, gy plus 4, 6, 2, 100, 100, 110)
  rect(gx plus 5, gy plus 5, 4, 1, 40, 40, 50)

  nfa Grip (brown wood)
  rect(gx plus 4, gy plus 6, 6, 5, 120, 75, 35)
  rect(gx plus 5, gy plus 6, 4, 5, 135, 85, 40)

  nfa Grip lines (texture)
  rect(gx plus 5, gy plus 7, 4, 1, 100, 60, 25)
  rect(gx plus 5, gy plus 9, 4, 1, 100, 60, 25)

  nfa Hand (skin tone)
  rect(gx plus 2, gy plus 11, 10, 4, 200, 155, 120)
  rect(gx plus 3, gy plus 11, 8, 3, 210, 165, 130)

  nfa Knuckle highlights
  rect(gx plus 3, gy plus 11, 2, 1, 220, 175, 140)
  rect(gx plus 6, gy plus 11, 2, 1, 220, 175, 140)
  rect(gx plus 9, gy plus 11, 1, 1, 220, 175, 140)

  nfa Wrist
  rect(gx plus 4, gy plus 15, 6, 3, 195, 150, 115)
gg

nfa =============================================
nfa   HUD (graphical bars)
nfa =============================================

based draw_hud(hp, ammo, armor)
  nfa Background
  rect(0, VIEW_H, SCR_W, HUD_H, 45, 45, 50)

  nfa Top border
  rect(0, VIEW_H, SCR_W, 1, 80, 75, 60)

  nfa Bottom border
  rect(0, TOTAL_H minus 1, SCR_W, 1, 80, 75, 60)

  nfa === AMMO section (left) ===
  nfa Label background
  rect(2, VIEW_H plus 2, 14, 4, 35, 35, 40)
  nfa Ammo bar (yellow)
  ser ammo_w is ammo times 12 divided_by 100
  rect(3, VIEW_H plus 3, ammo_w, 2, 200, 200, 40)

  nfa === HP section ===
  rect(20, VIEW_H plus 2, 18, 4, 35, 35, 40)
  nfa HP bar (green → red if low)
  ser hp_w is hp times 16 divided_by 100
  ser hp_r is 0
  ser hp_g is 200
  wagmi hp less_than 30
    hp_r is 220
    hp_g is 40
  fr
  rect(21, VIEW_H plus 3, hp_w, 2, hp_r, hp_g, 20)

  nfa === DOOM FACE (center) ===
  nfa Face background
  rect(42, VIEW_H plus 2, 8, 5, 200, 160, 120)
  nfa Eyes
  pixel(44, VIEW_H plus 3, 255, 255, 255)
  pixel(45, VIEW_H plus 3, 40, 40, 40)
  pixel(47, VIEW_H plus 3, 255, 255, 255)
  pixel(48, VIEW_H plus 3, 40, 40, 40)
  nfa Nose
  pixel(46, VIEW_H plus 4, 180, 140, 100)
  nfa Mouth (grin)
  rect(44, VIEW_H plus 5, 5, 1, 180, 50, 50)

  nfa === ARMOR section ===
  rect(54, VIEW_H plus 2, 14, 4, 35, 35, 40)
  nfa Armor bar (blue)
  ser arm_w is armor times 12 divided_by 100
  wagmi arm_w greater_than 0
    rect(55, VIEW_H plus 3, arm_w, 2, 40, 80, 200)
  fr

  nfa === Key cards ===
  nfa Blue key
  rect(72, VIEW_H plus 2, 2, 2, 40, 80, 220)
  nfa Red key
  rect(75, VIEW_H plus 2, 2, 2, 220, 40, 40)
  nfa Yellow key
  rect(72, VIEW_H plus 5, 2, 2, 220, 220, 40)
gg

nfa =============================================
nfa   MINIMAP (pixel-based)
nfa =============================================

based draw_minimap(px, py)
  ser ox is SCR_W minus MAP_W minus 1
  ser oy is 1
  nfa Map background
  rect(ox minus 1, oy minus 1, MAP_W plus 2, MAP_H plus 2, 0, 0, 0)

  ser my is 0
  to_the_moon my less_than MAP_H
    ser mx is 0
    to_the_moon mx less_than MAP_W
      ser w is is_wall(mx, my)
      wagmi w equals 1
        pixel(ox plus mx, oy plus my, 80, 80, 90)
      ngmi
        ser pmx is Math.floor(px)
        ser pmy is Math.floor(py)
        wagmi mx equals pmx and my equals pmy
          pixel(ox plus mx, oy plus my, 0, 255, 0)
        ngmi
          pixel(ox plus mx, oy plus my, 15, 15, 20)
        fr
      fr
      mx is mx plus 1
    gg
    my is my plus 1
  gg
gg

nfa =============================================
nfa   RENDER FRAME
nfa =============================================

based render_frame(px, py, pa, frame_num)

  nfa --- Raycast and draw each column ---
  ser col is 0
  to_the_moon col less_than SCR_W
    ser ray_a is pa minus FOV_HALF plus (col times FOV divided_by SCR_W)
    ser dist is cast_ray(px, py, ray_a)

    nfa Fish-eye correction
    dist is dist times Math.cos(ray_a minus pa)

    nfa Wall height in pixels
    ser wh is VIEW_H divided_by dist
    wagmi wh greater_than VIEW_H
      wh is VIEW_H
    fr
    ser hw is Math.floor(wh divided_by 2.0)
    ser mid is VIEW_H divided_by 2
    ser wtop is mid minus hw
    ser wbot is mid plus hw

    wtop is clamp(wtop, 0, VIEW_H)
    wbot is clamp(wbot, 0, VIEW_H)

    nfa --- Wall color (red-ish, fades with distance) ---
    ser bright is 1.0 minus (dist divided_by MAX_DEPTH)
    bright is clamp(bright, 0.0, 1.0)

    ser wr is Math.floor(190 times bright plus 15)
    ser wg is Math.floor(35 times bright plus 5)
    ser wb is Math.floor(25 times bright plus 5)

    nfa Side shading (E/W faces darker — classic DOOM look)
    wagmi last_side equals 1
      wr is Math.floor(wr times 0.6)
      wg is Math.floor(wg times 0.6)
      wb is Math.floor(wb times 0.6)
    fr

    nfa --- Ceiling gradient (dark blue) ---
    ser ceil_mid is Math.floor(wtop divided_by 2)
    vline(col, 0, ceil_mid, 4, 4, 15)
    vline(col, ceil_mid, wtop, 8, 8, 28)

    nfa --- Wall ---
    vline(col, wtop, wbot, wr, wg, wb)

    nfa --- Floor gradient (green → dark) ---
    ser floor_mid is Math.floor((wbot plus VIEW_H) divided_by 2)
    vline(col, wbot, floor_mid, 18, 55, 18)
    vline(col, floor_mid, VIEW_H, 8, 28, 8)

    col is col plus 1
  gg

  nfa --- Overlays ---
  ser firing is 0
  wagmi frame_num mod 8 equals 4
    firing is 1
  fr
  draw_gun(firing)
  draw_minimap(px, py)
  draw_hud(100, 50, 0)

  hflush()
gg

nfa =============================================
nfa   MAIN
nfa =============================================

hires(SCR_W, TOTAL_H)
clear_screen()

nfa --- Title ---
shill ""
shill ""
shill ""
shill "     ██████╗  ██████╗  ██████╗ ███╗   ███╗"
shill "     ██╔══██╗██╔═══██╗██╔═══██╗████╗ ████║"
shill "     ██║  ██║██║   ██║██║   ██║██╔████╔██║"
shill "     ██║  ██║██║   ██║██║   ██║██║╚██╔╝██║"
shill "     ██████╔╝╚██████╔╝╚██████╔╝██║ ╚═╝ ██║"
shill "     ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝"
shill "              . B R O   H I R E S"
shill ""
shill "       24-bit true color  |  ▀ half-block"
shill "       80x48 pixels in 80x24 terminal"
shill "       Compiled bytecode  |  Stack VM"
shill ""
shill "       Starting in 2 seconds..."
sleep(2000)
clear_screen()

nfa --- Game loop ---
ser frame is 0
hodl TOTAL is 42

to_the_moon frame less_than TOTAL

  render_frame(player_x, player_y, player_a, frame)

  nfa --- MOVEMENT ---

  nfa Phase 1 (0-9): Walk east
  wagmi frame less_than 10
    player_x is player_x plus 0.35
  fr

  nfa Phase 2 (10-15): Turn south
  wagmi frame gte 10 and frame less_than 16
    player_a is player_a plus 0.25
  fr

  nfa Phase 3 (16-22): Walk forward
  wagmi frame gte 16 and frame less_than 23
    player_x is player_x plus Math.cos(player_a) times 0.3
    player_y is player_y plus Math.sin(player_a) times 0.3
  fr

  nfa Phase 4 (23-28): Turn and walk
  wagmi frame gte 23 and frame less_than 29
    player_a is player_a minus 0.2
    player_x is player_x plus Math.cos(player_a) times 0.2
    player_y is player_y plus Math.sin(player_a) times 0.2
  fr

  nfa Phase 5 (29-41): Classic DOOM spin
  wagmi frame gte 29
    player_a is player_a plus 0.24
  fr

  nfa Bounds
  player_x is clamp(player_x, 1.2, 14.8)
  player_y is clamp(player_y, 1.2, 14.8)

  sleep(100)
  frame is frame plus 1
gg

nfa --- End ---
clear_screen()
shill ""
shill "  ==========================================="
shill "       DOOM.BRO HIRES — Demo Complete"
shill "  ==========================================="
shill ""
shill "  Resolution: 80x48 pixels (half-block ▀)"
shill "  Color:      24-bit true RGB"
shill "  Frames:     42 @ ~10 fps"
shill "  Engine:     BroLang bytecode VM"
shill "  Features:   Wall side-shading, gradient"
shill "              ceiling/floor, gun sprite with"
shill "              muzzle flash, pixel HUD, minimap"
shill ""
shill "  Can it run on a washing machine?"
shill "  It just did. In hi-res."
shill ""
shill "  wagmi."
shill ""

gn
