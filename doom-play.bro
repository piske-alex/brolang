gm

nfa =============================================
nfa   D O O M . B R O   —   P L A Y A B L E
nfa
nfa   WASD to move. Space to shoot. Q to quit.
nfa   Kill all 4 imps to win.
nfa =============================================

nfa --- Screen ---
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
hodl TWO_PI is 6.28318530
hodl FOV is 1.0472
hodl FOV_HALF is 0.5236
hodl MAX_DEPTH is 16.0
hodl RAY_STEP is 0.12

nfa --- Movement ---
hodl MOVE_SPEED is 0.18
hodl TURN_SPEED is 0.10

nfa --- Player ---
ser player_x is 2.5
ser player_y is 2.5
ser player_a is 0.3
ser last_side is 0
ser shoot_frames is 0
ser ammo is 50
ser hp is 100
ser kills is 0
ser hit_flash is 0
ser game_state is 0

nfa =============================================
nfa   CORE FUNCTIONS
nfa =============================================

based is_wall(mx, my)
  wagmi mx less_than 0 or mx gte MAP_W or my less_than 0 or my gte MAP_H
    paper_hands 1
  fr
  wagmi char_at(MAP, my times MAP_W plus mx) equals "1"
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
    wagmi is_wall(tx, ty) equals 1
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

based clamp(v, lo, hi)
  wagmi v less_than lo
    paper_hands lo
  fr
  wagmi v greater_than hi
    paper_hands hi
  fr
  paper_hands v
gg

based try_move(dx, dy)
  ser nx is player_x plus dx
  ser ny is player_y plus dy
  wagmi is_wall(Math.floor(nx), Math.floor(player_y)) equals 0
    player_x is nx
  fr
  wagmi is_wall(Math.floor(player_x), Math.floor(ny)) equals 0
    player_y is ny
  fr
gg

nfa =============================================
nfa   ENEMY RENDERING (billboard sprites)
nfa =============================================

based render_enemy(idx)
  ser ex is enemy_x(idx)
  ser ey is enemy_y(idx)

  nfa Vector from player to enemy
  ser dx is ex minus player_x
  ser dy is ey minus player_y
  ser dist is Math.sqrt(dx times dx plus dy times dy)

  wagmi dist less_than 0.3 or dist greater_than MAX_DEPTH
    paper_hands 0
  fr

  nfa Angle to enemy relative to player view
  ser angle is Math.atan2(dy, dx) minus player_a

  nfa Normalize to [-PI, PI]
  to_the_moon angle greater_than PI
    angle is angle minus TWO_PI
  gg
  to_the_moon angle less_than (0 minus PI)
    angle is angle plus TWO_PI
  gg

  nfa Skip if outside FOV (with margin for sprite width)
  wagmi angle less_than (0 minus FOV_HALF minus 0.3) or angle greater_than (FOV_HALF plus 0.3)
    paper_hands 0
  fr

  nfa Screen X center of sprite
  ser sx is Math.floor((angle divided_by FOV plus 0.5) times SCR_W)

  nfa Sprite dimensions based on distance
  ser sprite_h is Math.floor(VIEW_H divided_by dist times 0.8)
  sprite_h is clamp(sprite_h, 4, VIEW_H)
  ser sprite_w is Math.floor(sprite_h times 0.5)
  ser half_w is Math.floor(sprite_w divided_by 2)
  ser half_h is Math.floor(sprite_h divided_by 2)
  ser mid_y is VIEW_H divided_by 2

  nfa Is this enemy flashing from a hit?
  ser flash is enemy_flash(idx)

  nfa Head dimensions
  ser head_h is Math.floor(sprite_h times 0.25)
  ser body_h is Math.floor(sprite_h times 0.45)
  ser leg_h is sprite_h minus head_h minus body_h

  ser body_top is mid_y minus half_h

  nfa Draw sprite column by column
  ser col is sx minus half_w
  to_the_moon col less_than (sx plus half_w)
    wagmi col gte 0 and col less_than SCR_W
      nfa Occlusion: only draw if enemy is closer than wall
      wagmi zbuf_get(col) greater_than dist

        nfa How far across the sprite (0.0 to 1.0)
        ser frac is (col minus sx plus half_w) divided_by sprite_w

        nfa Color selection
        ser hr is 180
        ser hg is 110
        ser hb is 80
        ser br is 160
        ser bg is 40
        ser bb is 40
        ser lr is 120
        ser lg is 30
        ser lb is 30

        nfa Flash white when hit
        wagmi flash equals 1
          hr is 255
          hg is 255
          hb is 255
          br is 255
          bg is 200
          bb is 200
          lr is 255
          lg is 200
          lb is 200
        fr

        nfa Taper the sprite (narrower at top and bottom)
        ser in_body is 1
        wagmi frac less_than 0.15 or frac greater_than 0.85
          in_body is 0
        fr

        wagmi in_body equals 1
          nfa Head
          ser y1 is clamp(body_top, 0, VIEW_H)
          ser y2 is clamp(body_top plus head_h, 0, VIEW_H)
          vline(col, y1, y2, hr, hg, hb)

          nfa Eyes (center columns only)
          wagmi frac greater_than 0.25 and frac less_than 0.45
            ser eye_y is body_top plus Math.floor(head_h divided_by 2)
            wagmi eye_y gte 0 and eye_y less_than VIEW_H
              pixel(col, eye_y, 255, 255, 0)
            fr
          fr
          wagmi frac greater_than 0.55 and frac less_than 0.75
            ser eye_y is body_top plus Math.floor(head_h divided_by 2)
            wagmi eye_y gte 0 and eye_y less_than VIEW_H
              pixel(col, eye_y, 255, 255, 0)
            fr
          fr

          nfa Body
          ser y3 is clamp(body_top plus head_h, 0, VIEW_H)
          ser y4 is clamp(body_top plus head_h plus body_h, 0, VIEW_H)
          vline(col, y3, y4, br, bg, bb)

          nfa Legs (narrower)
          wagmi frac greater_than 0.2 and frac less_than 0.8
            ser y5 is clamp(body_top plus head_h plus body_h, 0, VIEW_H)
            ser y6 is clamp(body_top plus sprite_h, 0, VIEW_H)
            vline(col, y5, y6, lr, lg, lb)
          fr
        fr

      fr
    fr
    col is col plus 1
  gg

  paper_hands 1
gg

based render_all_enemies()
  ser ei is 0
  to_the_moon ei less_than enemy_count()
    wagmi enemy_alive(ei) equals 1
      render_enemy(ei)
    fr
    ei is ei plus 1
  gg
gg

nfa =============================================
nfa   SHOOTING / HIT DETECTION
nfa =============================================

based check_shoot()
  nfa Find enemy closest to crosshair
  ser best_i is 0 minus 1
  ser best_dist is MAX_DEPTH
  ser center_z is zbuf_get(SCR_W divided_by 2)

  ser ei is 0
  to_the_moon ei less_than enemy_count()
    wagmi enemy_alive(ei) equals 1
      ser ex is enemy_x(ei)
      ser ey is enemy_y(ei)
      ser dx is ex minus player_x
      ser dy is ey minus player_y
      ser dist is Math.sqrt(dx times dx plus dy times dy)

      nfa Must be closer than the wall at crosshair
      wagmi dist less_than center_z
        ser angle is Math.atan2(dy, dx) minus player_a
        to_the_moon angle greater_than PI
          angle is angle minus TWO_PI
        gg
        to_the_moon angle less_than (0 minus PI)
          angle is angle plus TWO_PI
        gg

        nfa Check if near crosshair (within ~10 degrees)
        ser abs_angle is angle
        wagmi abs_angle less_than 0
          abs_angle is 0 minus abs_angle
        fr
        wagmi abs_angle less_than 0.18 and dist less_than best_dist
          best_i is ei
          best_dist is dist
        fr
      fr
    fr
    ei is ei plus 1
  gg

  wagmi best_i gte 0
    ser remaining is enemy_hurt(best_i, 1)
    hit_flash is 3
    wagmi remaining equals 0
      kills is kills plus 1
    fr
  fr
gg

nfa =============================================
nfa   ENEMY PROXIMITY DAMAGE
nfa =============================================

based check_enemy_damage()
  ser ei is 0
  to_the_moon ei less_than enemy_count()
    wagmi enemy_alive(ei) equals 1
      ser dx is enemy_x(ei) minus player_x
      ser dy is enemy_y(ei) minus player_y
      ser dist is Math.sqrt(dx times dx plus dy times dy)
      wagmi dist less_than 1.5
        hp is hp minus 1
      fr
    fr
    ei is ei plus 1
  gg
gg

nfa =============================================
nfa   ENEMY AI — walk toward player
nfa =============================================

hodl ENEMY_SPEED is 0.04

based move_enemies()
  ser ei is 0
  to_the_moon ei less_than enemy_count()
    wagmi enemy_alive(ei) equals 1
      ser ex is enemy_x(ei)
      ser ey is enemy_y(ei)
      ser dx is player_x minus ex
      ser dy is player_y minus ey
      ser dist is Math.sqrt(dx times dx plus dy times dy)

      nfa Only move if not too close (stop at melee range)
      wagmi dist greater_than 1.2
        nfa Normalize direction
        ser nx is dx divided_by dist times ENEMY_SPEED
        ser ny is dy divided_by dist times ENEMY_SPEED

        nfa Check wall collision for enemy (slide along walls)
        ser new_ex is ex plus nx
        ser new_ey is ey plus ny

        wagmi is_wall(Math.floor(new_ex), Math.floor(ey)) equals 0
          ex is new_ex
        fr
        wagmi is_wall(Math.floor(ex), Math.floor(new_ey)) equals 0
          ey is new_ey
        fr

        enemy_set_pos(ei, ex, ey)
      fr
    fr
    ei is ei plus 1
  gg
gg

nfa =============================================
nfa   GUN SPRITE
nfa =============================================

based draw_gun()
  ser gx is 33
  ser gy is 25

  wagmi shoot_frames greater_than 0
    gy is gy minus 1
  fr

  nfa Muzzle flash
  wagmi shoot_frames greater_than 2
    rect(gx plus 5, gy minus 7, 4, 4, 255, 255, 120)
    rect(gx plus 6, gy minus 9, 2, 2, 255, 255, 220)
    pixel(gx plus 3, gy minus 5, 255, 200, 50)
    pixel(gx plus 10, gy minus 5, 255, 200, 50)
    pixel(gx plus 7, gy minus 10, 255, 255, 255)
  fr

  nfa Barrel
  rect(gx plus 5, gy minus 3, 4, 3, 120, 120, 130)
  nfa Slide
  rect(gx plus 3, gy, 8, 4, 160, 160, 170)
  rect(gx plus 2, gy plus 1, 10, 2, 145, 145, 155)
  rect(gx plus 3, gy plus 1, 8, 1, 130, 130, 140)
  nfa Guard + grip
  rect(gx plus 4, gy plus 4, 6, 2, 100, 100, 110)
  rect(gx plus 4, gy plus 6, 6, 5, 120, 75, 35)
  rect(gx plus 5, gy plus 6, 4, 5, 135, 85, 40)
  nfa Hand
  rect(gx plus 2, gy plus 11, 10, 4, 200, 155, 120)
  rect(gx plus 4, gy plus 15, 6, 3, 195, 150, 115)
gg

nfa =============================================
nfa   HUD
nfa =============================================

based draw_hud()
  rect(0, VIEW_H, SCR_W, HUD_H, 45, 45, 50)
  rect(0, VIEW_H, SCR_W, 1, 80, 75, 60)
  rect(0, TOTAL_H minus 1, SCR_W, 1, 80, 75, 60)

  nfa Ammo bar
  rect(2, VIEW_H plus 2, 14, 4, 35, 35, 40)
  ser ammo_w is clamp(ammo times 12 divided_by 50, 0, 12)
  rect(3, VIEW_H plus 3, ammo_w, 2, 200, 200, 40)

  nfa HP bar
  rect(20, VIEW_H plus 2, 18, 4, 35, 35, 40)
  ser hp_w is clamp(hp times 16 divided_by 100, 0, 16)
  ser hp_r is 0
  ser hp_g is 200
  wagmi hp less_than 30
    hp_r is 220
    hp_g is 40
  fr
  rect(21, VIEW_H plus 3, hp_w, 2, hp_r, hp_g, 20)

  nfa DOOM face — expression changes with HP
  rect(42, VIEW_H plus 2, 8, 5, 200, 160, 120)
  pixel(44, VIEW_H plus 3, 255, 255, 255)
  pixel(45, VIEW_H plus 3, 40, 40, 40)
  pixel(47, VIEW_H plus 3, 255, 255, 255)
  pixel(48, VIEW_H plus 3, 40, 40, 40)
  pixel(46, VIEW_H plus 4, 180, 140, 100)
  wagmi hp greater_than 50
    nfa Grin
    rect(44, VIEW_H plus 5, 5, 1, 180, 50, 50)
  ngmi
    nfa Grimace
    rect(44, VIEW_H plus 5, 5, 1, 120, 30, 30)
    pixel(43, VIEW_H plus 5, 200, 160, 120)
    pixel(49, VIEW_H plus 5, 200, 160, 120)
  fr

  nfa Kill counter
  rect(54, VIEW_H plus 2, 12, 4, 35, 35, 40)
  nfa Show kills as colored blocks (1 per kill, max 4)
  ser ki is 0
  to_the_moon ki less_than kills
    rect(55 plus ki times 3, VIEW_H plus 3, 2, 2, 220, 40, 40)
    ki is ki plus 1
  gg

  nfa Crosshair (white cross at center)
  pixel(40, 20, 255, 255, 255)
  pixel(39, 20, 200, 200, 200)
  pixel(41, 20, 200, 200, 200)
  pixel(40, 19, 200, 200, 200)
  pixel(40, 21, 200, 200, 200)

  nfa Hit marker flash
  wagmi hit_flash greater_than 0
    pixel(38, 18, 255, 50, 50)
    pixel(42, 18, 255, 50, 50)
    pixel(38, 22, 255, 50, 50)
    pixel(42, 22, 255, 50, 50)
    hit_flash is hit_flash minus 1
  fr

  nfa Screen flash red when taking damage
  wagmi hp less_than 100
    nfa Low HP warning — red tint on edges
    wagmi hp less_than 30
      ser fy is 0
      to_the_moon fy less_than VIEW_H
        pixel(0, fy, 120, 0, 0)
        pixel(1, fy, 80, 0, 0)
        pixel(SCR_W minus 1, fy, 120, 0, 0)
        pixel(SCR_W minus 2, fy, 80, 0, 0)
        fy is fy plus 1
      gg
    fr
  fr
gg

nfa =============================================
nfa   MINIMAP
nfa =============================================

based draw_minimap()
  ser ox is SCR_W minus MAP_W minus 1
  ser oy is 1
  rect(ox minus 1, oy minus 1, MAP_W plus 2, MAP_H plus 2, 0, 0, 0)
  ser my is 0
  to_the_moon my less_than MAP_H
    ser mx is 0
    to_the_moon mx less_than MAP_W
      wagmi is_wall(mx, my) equals 1
        pixel(ox plus mx, oy plus my, 80, 80, 90)
      ngmi
        pixel(ox plus mx, oy plus my, 15, 15, 20)
      fr
      mx is mx plus 1
    gg
    my is my plus 1
  gg

  nfa Player dot
  pixel(ox plus Math.floor(player_x), oy plus Math.floor(player_y), 0, 255, 0)

  nfa Player direction
  ser dir_x is Math.floor(player_x plus Math.cos(player_a) times 2)
  ser dir_y is Math.floor(player_y plus Math.sin(player_a) times 2)
  pixel(ox plus clamp(dir_x, 0, MAP_W minus 1), oy plus clamp(dir_y, 0, MAP_H minus 1), 255, 255, 0)

  nfa Enemy dots on minimap
  ser ei is 0
  to_the_moon ei less_than enemy_count()
    wagmi enemy_alive(ei) equals 1
      pixel(ox plus Math.floor(enemy_x(ei)), oy plus Math.floor(enemy_y(ei)), 255, 50, 50)
    fr
    ei is ei plus 1
  gg
gg

nfa =============================================
nfa   RENDER FRAME
nfa =============================================

based render_frame()
  nfa Raycast all columns + fill depth buffer
  ser col is 0
  to_the_moon col less_than SCR_W
    ser ray_a is player_a minus FOV_HALF plus (col times FOV divided_by SCR_W)
    ser dist is cast_ray(player_x, player_y, ray_a)
    dist is dist times Math.cos(ray_a minus player_a)

    nfa Store in depth buffer
    zbuf_set(col, dist)

    ser wh is VIEW_H divided_by dist
    wagmi wh greater_than VIEW_H
      wh is VIEW_H
    fr
    ser hw is Math.floor(wh divided_by 2.0)
    ser mid is VIEW_H divided_by 2
    ser wtop is clamp(mid minus hw, 0, VIEW_H)
    ser wbot is clamp(mid plus hw, 0, VIEW_H)

    ser bright is clamp(1.0 minus (dist divided_by MAX_DEPTH), 0.0, 1.0)
    ser wr is Math.floor(190 times bright plus 15)
    ser wg is Math.floor(35 times bright plus 5)
    ser wb is Math.floor(25 times bright plus 5)
    wagmi last_side equals 1
      wr is Math.floor(wr times 0.6)
      wg is Math.floor(wg times 0.6)
      wb is Math.floor(wb times 0.6)
    fr

    ser ceil_mid is Math.floor(wtop divided_by 2)
    vline(col, 0, ceil_mid, 4, 4, 15)
    vline(col, ceil_mid, wtop, 8, 8, 28)
    vline(col, wtop, wbot, wr, wg, wb)
    ser floor_mid is Math.floor((wbot plus VIEW_H) divided_by 2)
    vline(col, wbot, floor_mid, 18, 55, 18)
    vline(col, floor_mid, VIEW_H, 8, 28, 8)

    col is col plus 1
  gg

  nfa Render enemies (using depth buffer for occlusion)
  render_all_enemies()

  nfa Overlays
  draw_gun()
  draw_minimap()
  draw_hud()
  hflush()
gg

nfa =============================================
nfa   INPUT
nfa =============================================

based process_input()
  ser k is key()
  to_the_moon str_len(k) greater_than 0

    wagmi k equals "w" or k equals "up"
      try_move(Math.cos(player_a) times MOVE_SPEED, Math.sin(player_a) times MOVE_SPEED)
    fr
    wagmi k equals "s" or k equals "down"
      try_move(0 minus (Math.cos(player_a) times MOVE_SPEED), 0 minus (Math.sin(player_a) times MOVE_SPEED))
    fr
    wagmi k equals "a" or k equals "left"
      player_a is player_a minus TURN_SPEED
    fr
    wagmi k equals "d" or k equals "right"
      player_a is player_a plus TURN_SPEED
    fr

    nfa Shoot
    wagmi k equals "space"
      wagmi ammo greater_than 0 and shoot_frames equals 0
        shoot_frames is 4
        ammo is ammo minus 1
        check_shoot()
      fr
    fr

    nfa Quit
    wagmi k equals "q" or k equals "esc"
      game_state is 3
    fr

    k is key()
  gg
gg

nfa =============================================
nfa   MAIN
nfa =============================================

hires(SCR_W, TOTAL_H)
zbuf_init(SCR_W)
enemies_init()
game_init()
clear_screen()

nfa --- Place enemies ---
enemy_add(5.5, 7.5, 3)
enemy_add(10.5, 3.5, 3)
enemy_add(12.5, 10.5, 3)
enemy_add(3.5, 13.5, 3)

nfa --- Title ---
shill ""
shill ""
shill "     ██████╗  ██████╗  ██████╗ ███╗   ███╗"
shill "     ██╔══██╗██╔═══██╗██╔═══██╗████╗ ████║"
shill "     ██║  ██║██║   ██║██║   ██║██╔████╔██║"
shill "     ██║  ██║██║   ██║██║   ██║██║╚██╔╝██║"
shill "     ██████╔╝╚██████╔╝╚██████╔╝██║ ╚═╝ ██║"
shill "     ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝"
shill "              . B R O   P L A Y"
shill ""
shill "       WASD / Arrows — Move & turn"
shill "       Space          — Shoot"
shill "       Q              — Quit"
shill ""
shill "       Kill 4 imps. Don't die."
shill "       They hurt you up close."
shill ""
shill "       Press any key to start..."

ser waiting is 1
to_the_moon waiting equals 1
  ser wk is key()
  wagmi str_len(wk) greater_than 0
    waiting is 0
  fr
  sleep(50)
gg
key_flush()
clear_screen()

nfa --- GAME LOOP ---
nfa game_state: 0=playing 1=won 2=dead 3=quit
to_the_moon game_state equals 0

  process_input()

  wagmi shoot_frames greater_than 0
    shoot_frames is shoot_frames minus 1
  fr

  move_enemies()
  check_enemy_damage()

  nfa Check death
  wagmi hp lte 0
    hp is 0
    game_state is 2
  fr

  nfa Check win
  wagmi kills gte 4 and game_state equals 0
    game_state is 1
    render_frame()
    sleep(500)
  fr

  wagmi game_state equals 0
    render_frame()
    sleep(40)
  fr
gg

nfa --- End screen ---
clear_screen()
shill ""
wagmi game_state equals 1
  shill "  ==========================================="
  shill "       YOU WIN — ALL IMPS ELIMINATED"
  shill "  ==========================================="
  shill ""
  shill "  Kills: 4/4"
  shill "  Ammo remaining: " plus ammo
  shill "  HP remaining: " plus hp plus "%"
ngmi
  wagmi game_state equals 3
    shill "  You quit. The imps win this time."
    shill "  Kills: " plus kills plus "/4"
  ngmi
    shill "  ==========================================="
    shill "       YOU DIED"
    shill "  ==========================================="
    shill ""
    shill "  Kills: " plus kills plus "/4"
  fr
fr
shill ""
shill "  Engine: BroLang bytecode VM"
shill "  wagmi."
shill ""

gn
