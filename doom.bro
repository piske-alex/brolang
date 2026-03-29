gm

nfa =============================================
nfa   D O O M . B R O
nfa
nfa   The washing machine edition.
nfa   ANSI color raycaster with gun sprite,
nfa   compiled to bytecode, run on stack VM.
nfa
nfa   RIP AND TEAR. NFA. DYOR.
nfa =============================================

nfa --- Screen ---
hodl SCR_W is 80
hodl SCR_H is 24
hodl VIEW_H is 20
hodl HUD_TOP is 20

nfa --- Map 16x16 ---
hodl MAP_W is 16
hodl MAP_H is 16
hodl MAP is "1111111111111111100000001000000110000000100000011000000000000001101110000001110110100000000010011010000000001001100000000000000110000000000000011000000000000001101000000000010110100000000001011011100000111001100000001000000110000000100000011111111111111111"

nfa --- Camera ---
hodl PI is 3.14159265
hodl FOV is 1.0472
hodl FOV_HALF is 0.5236
hodl MAX_DEPTH is 16.0
hodl RAY_STEP is 0.12

nfa --- Colors ---
nfa 0=reset 1=dark_gray 2=red 3=bright_red 4=yellow
nfa 5=green 6=blue 7=white 8=bright_white 9=magenta
nfa 11=brown 12=cyan 13=dim_green

nfa --- Player ---
ser player_x is 2.0
ser player_y is 2.0
ser player_a is 0.3

nfa =============================================
nfa   HELPER FUNCTIONS
nfa =============================================

based is_wall(mx, my)
  wagmi mx less_than 0 or mx gte MAP_W or my less_than 0 or my gte MAP_H
    paper_hands 1
  fr
  ser idx is my times MAP_W plus mx
  ser cell is char_at(MAP, idx)
  wagmi cell equals "1"
    paper_hands 1
  fr
  paper_hands 0
gg

nfa Raycaster — returns distance to nearest wall
based cast_ray(px, py, angle)
  ser rx is Math.cos(angle)
  ser ry is Math.sin(angle)
  ser d is 0.0
  to_the_moon d less_than MAX_DEPTH
    ser tx is Math.floor(px plus rx times d)
    ser ty is Math.floor(py plus ry times d)
    ser hit is is_wall(tx, ty)
    wagmi hit equals 1
      paper_hands d
    fr
    d is d plus RAY_STEP
  gg
  paper_hands MAX_DEPTH
gg

nfa Wall character + color based on distance
nfa Returns shade char — caller picks color
based wall_shade(dist)
  wagmi dist less_than 2.5
    paper_hands "@"
  fr
  wagmi dist less_than 4.0
    paper_hands "#"
  fr
  wagmi dist less_than 6.0
    paper_hands "%"
  fr
  wagmi dist less_than 8.0
    paper_hands "="
  fr
  wagmi dist less_than 11.0
    paper_hands "-"
  fr
  paper_hands "."
gg

nfa Wall color based on distance
based wall_color(dist)
  wagmi dist less_than 2.5
    paper_hands 3
  fr
  wagmi dist less_than 4.0
    paper_hands 2
  fr
  wagmi dist less_than 6.0
    paper_hands 11
  fr
  wagmi dist less_than 9.0
    paper_hands 1
  fr
  paper_hands 1
gg

nfa Floor color based on distance from screen center
based floor_color(row, center)
  ser d is row minus center
  wagmi d greater_than 7
    paper_hands 5
  fr
  wagmi d greater_than 4
    paper_hands 13
  fr
  paper_hands 1
gg

nfa Floor character
based floor_ch(row, center)
  ser d is row minus center
  wagmi d greater_than 7
    paper_hands "."
  fr
  wagmi d greater_than 4
    paper_hands ","
  fr
  wagmi d greater_than 2
    paper_hands "-"
  fr
  paper_hands " "
gg

nfa =============================================
nfa   GUN SPRITE
nfa =============================================

based draw_gun(is_firing)
  nfa Gun sits at bottom-center of viewport
  ser gx is 34
  ser gy is 13

  nfa Gun color: bright white normally, yellow when firing
  ser gc is 7
  wagmi is_firing equals 1
    gc is 4
  fr

  nfa Muzzle flash when firing
  wagmi is_firing equals 1
    draw(gx plus 5, gy minus 3, "*", 4)
    draw(gx plus 4, gy minus 2, "*", 4)
    draw(gx plus 5, gy minus 2, "|", 4)
    draw(gx plus 6, gy minus 2, "*", 4)
    draw(gx plus 5, gy minus 1, "^", 4)
  fr

  nfa Barrel
  draw(gx plus 4, gy, "_", gc)
  draw(gx plus 5, gy, "_", gc)
  draw(gx plus 6, gy, "|", gc)

  nfa Slide
  draw(gx plus 2, gy plus 1, "/", gc)
  draw(gx plus 3, gy plus 1, "=", gc)
  draw(gx plus 4, gy plus 1, "=", gc)
  draw(gx plus 5, gy plus 1, "=", gc)
  draw(gx plus 6, gy plus 1, "|", gc)
  draw(gx plus 7, gy plus 1, "|", gc)

  nfa Body
  draw(gx plus 1, gy plus 2, "|", gc)
  draw(gx plus 2, gy plus 2, "=", gc)
  draw(gx plus 3, gy plus 2, "=", gc)
  draw(gx plus 4, gy plus 2, "=", gc)
  draw(gx plus 5, gy plus 2, "=", gc)
  draw(gx plus 6, gy plus 2, "=", gc)
  draw(gx plus 7, gy plus 2, "|", gc)

  nfa Grip
  draw(gx plus 3, gy plus 3, "|", gc)
  draw(gx plus 4, gy plus 3, "|", gc)
  draw(gx plus 5, gy plus 3, "|", gc)

  nfa Hand
  draw(gx plus 2, gy plus 4, "/", 11)
  draw(gx plus 3, gy plus 4, "|", 11)
  draw(gx plus 4, gy plus 4, "O", 11)
  draw(gx plus 5, gy plus 4, "|", 11)
  draw(gx plus 6, gy plus 4, "\\", 11)

  nfa Wrist
  draw(gx plus 3, gy plus 5, "|", 11)
  draw(gx plus 4, gy plus 5, "|", 11)
  draw(gx plus 5, gy plus 5, "|", 11)
gg

nfa =============================================
nfa   DOOM HUD
nfa =============================================

based draw_hud(hp, ammo, armor, frame_num)
  nfa Top separator
  ser i is 0
  to_the_moon i less_than SCR_W
    draw(i, HUD_TOP, "=", 4)
    i is i plus 1
  gg

  nfa AMMO section
  draw(1, HUD_TOP plus 1, "A", 1)
  draw(2, HUD_TOP plus 1, "M", 1)
  draw(3, HUD_TOP plus 1, "M", 1)
  draw(4, HUD_TOP plus 1, "O", 1)

  nfa Ammo value
  draw(6, HUD_TOP plus 1, "5", 4)
  draw(7, HUD_TOP plus 1, "0", 4)

  nfa Health section
  draw(12, HUD_TOP plus 1, "H", 1)
  draw(13, HUD_TOP plus 1, "P", 1)

  nfa Health value + color
  ser hp_color is 5
  wagmi hp less_than 30
    hp_color is 3
  fr
  draw(15, HUD_TOP plus 1, "1", hp_color)
  draw(16, HUD_TOP plus 1, "0", hp_color)
  draw(17, HUD_TOP plus 1, "0", hp_color)
  draw(18, HUD_TOP plus 1, "%", hp_color)

  nfa DOOM face (center of HUD)
  ser face_x is 34
  draw(face_x, HUD_TOP plus 1, "[", 4)
  draw(face_x plus 1, HUD_TOP plus 1, ">", 8)
  draw(face_x plus 2, HUD_TOP plus 1, ":", 8)
  draw(face_x plus 3, HUD_TOP plus 1, "D", 8)
  draw(face_x plus 4, HUD_TOP plus 1, "]", 4)

  nfa ARMOR section
  draw(42, HUD_TOP plus 1, "A", 1)
  draw(43, HUD_TOP plus 1, "R", 1)
  draw(44, HUD_TOP plus 1, "M", 1)

  draw(46, HUD_TOP plus 1, "0", 6)
  draw(47, HUD_TOP plus 1, "%", 6)

  nfa KEYS section
  draw(52, HUD_TOP plus 1, "[", 1)
  draw(53, HUD_TOP plus 1, "B", 6)
  draw(54, HUD_TOP plus 1, "]", 1)
  draw(55, HUD_TOP plus 1, "[", 1)
  draw(56, HUD_TOP plus 1, "R", 3)
  draw(57, HUD_TOP plus 1, "]", 1)
  draw(58, HUD_TOP plus 1, "[", 1)
  draw(59, HUD_TOP plus 1, "Y", 4)
  draw(60, HUD_TOP plus 1, "]", 1)

  nfa Bottom separator
  ser j is 0
  to_the_moon j less_than SCR_W
    draw(j, HUD_TOP plus 2, "=", 4)
    j is j plus 1
  gg

  nfa Engine credit
  draw(62, HUD_TOP plus 1, "B", 1)
  draw(63, HUD_TOP plus 1, "r", 1)
  draw(64, HUD_TOP plus 1, "o", 1)
  draw(65, HUD_TOP plus 1, "L", 1)
  draw(66, HUD_TOP plus 1, "a", 1)
  draw(67, HUD_TOP plus 1, "n", 1)
  draw(68, HUD_TOP plus 1, "g", 1)
  draw(69, HUD_TOP plus 1, " ", 1)
  draw(70, HUD_TOP plus 1, "V", 1)
  draw(71, HUD_TOP plus 1, "M", 1)
gg

nfa =============================================
nfa   MINIMAP
nfa =============================================

based draw_minimap(px, py)
  ser ox is SCR_W minus MAP_W minus 1
  ser oy is 1
  ser my is 0
  to_the_moon my less_than MAP_H
    ser mx is 0
    to_the_moon mx less_than MAP_W
      ser w is is_wall(mx, my)
      wagmi w equals 1
        draw(ox plus mx, oy plus my, "#", 1)
      ngmi
        ser pmx is Math.floor(px)
        ser pmy is Math.floor(py)
        wagmi mx equals pmx and my equals pmy
          draw(ox plus mx, oy plus my, "@", 5)
        ngmi
          draw(ox plus mx, oy plus my, " ", 0)
        fr
      fr
      mx is mx plus 1
    gg
    my is my plus 1
  gg
gg

nfa =============================================
nfa   RENDER ONE FRAME
nfa =============================================

based render_frame(px, py, pa, frame_num)
  nfa Cast rays and draw columns
  ser col is 0
  to_the_moon col less_than SCR_W
    ser ray_a is pa minus FOV_HALF plus (col times FOV divided_by SCR_W)
    ser dist is cast_ray(px, py, ray_a)

    nfa Fish-eye correction
    dist is dist times Math.cos(ray_a minus pa)

    nfa Wall height
    ser wh is VIEW_H divided_by dist
    wagmi wh greater_than VIEW_H
      wh is VIEW_H
    fr
    ser hw is Math.floor(wh divided_by 2.0)
    ser mid is Math.floor(VIEW_H divided_by 2.0)
    ser wtop is mid minus hw
    ser wbot is mid plus hw

    wagmi wtop less_than 0
      wtop is 0
    fr
    wagmi wbot gte VIEW_H
      wbot is VIEW_H minus 1
    fr

    nfa Get wall appearance
    ser wc is wall_shade(dist)
    ser wcol is wall_color(dist)

    nfa Draw column
    ser row is 0
    to_the_moon row less_than VIEW_H
      wagmi row less_than wtop
        nfa Ceiling - dark blue
        draw(col, row, " ", 6)
      ngmi
        wagmi row less_than wbot
          nfa Wall
          draw(col, row, wc, wcol)
        ngmi
          nfa Floor
          ser fc is floor_ch(row, mid)
          ser fco is floor_color(row, mid)
          draw(col, row, fc, fco)
        fr
      fr
      row is row plus 1
    gg

    col is col plus 1
  gg

  nfa Overlays
  ser is_firing is 0
  wagmi frame_num mod 7 equals 3
    is_firing is 1
  fr
  draw_gun(is_firing)
  draw_minimap(px, py)
  draw_hud(100, 50, 0, frame_num)

  flush()
gg

nfa =============================================
nfa   MAIN
nfa =============================================

nfa Init screen
screen(SCR_W, SCR_H)
clear_screen()

nfa Title screen
shill ""
shill ""
shill ""
shill "     ██████╗  ██████╗  ██████╗ ███╗   ███╗"
shill "     ██╔══██╗██╔═══██╗██╔═══██╗████╗ ████║"
shill "     ██║  ██║██║   ██║██║   ██║██╔████╔██║"
shill "     ██║  ██║██║   ██║██║   ██║██║╚██╔╝██║"
shill "     ██████╔╝╚██████╔╝╚██████╔╝██║ ╚═╝ ██║"
shill "     ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝"
shill "                  . B R O"
shill ""
shill "       Compiled to bytecode. Run on VM."
shill "       ANSI color raycaster engine."
shill ""
shill "       Press Ctrl+C to quit."
shill "       Starting in 2 seconds..."
shill ""
sleep(2000)
clear_screen()

nfa --- Game loop ---
ser frame is 0
hodl TOTAL is 42

to_the_moon frame less_than TOTAL

  render_frame(player_x, player_y, player_a, frame)

  nfa --- MOVEMENT PATH ---

  nfa Phase 1 (0-9): Walk east through corridor
  wagmi frame less_than 10
    player_x is player_x plus 0.35
  fr

  nfa Phase 2 (10-15): Turn south
  wagmi frame gte 10 and frame less_than 16
    player_a is player_a plus 0.25
  fr

  nfa Phase 3 (16-22): Walk forward through room
  wagmi frame gte 16 and frame less_than 23
    player_x is player_x plus Math.cos(player_a) times 0.3
    player_y is player_y plus Math.sin(player_a) times 0.3
  fr

  nfa Phase 4 (23-28): Turn east and walk
  wagmi frame gte 23 and frame less_than 29
    player_a is player_a minus 0.2
    player_x is player_x plus Math.cos(player_a) times 0.2
    player_y is player_y plus Math.sin(player_a) times 0.2
  fr

  nfa Phase 5 (29-41): The classic DOOM spin
  wagmi frame gte 29
    player_a is player_a plus 0.25
  fr

  nfa Keep in bounds
  wagmi player_x less_than 1.2
    player_x is 1.2
  fr
  wagmi player_x greater_than 14.8
    player_x is 14.8
  fr
  wagmi player_y less_than 1.2
    player_y is 1.2
  fr
  wagmi player_y greater_than 14.8
    player_y is 14.8
  fr

  sleep(110)
  frame is frame plus 1
gg

nfa --- End ---
clear_screen()
shill ""
shill "  ==========================================="
shill "       DOOM.BRO — Demo Complete"
shill "  ==========================================="
shill ""
shill "  42 frames | 80x20 viewport | ANSI color"
shill "  Engine: BroLang bytecode VM"
shill "  Gun: ASCII pistol with muzzle flash"
shill "  HUD: HP, Ammo, Armor, DOOM face, keys"
shill ""
shill "  No JavaScript was harmed. Pure bytecode."
shill ""
shill "  Can it run on a washing machine?"
shill "  It just did."
shill ""
shill "  wagmi."
shill ""

gn
