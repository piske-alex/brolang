gm

hodl SCR_W is 80
hodl VIEW_H is 40
hodl HUD_H is 8
hodl TOTAL_H is 48
hodl MAP_W is 16
hodl MAP_H is 16
hodl MAP1 is "1111111111111111100000001000000110000000100000011000000000000001101110000001110110100000000010011010000000001001100000000000000110000000000000011000000000000001101000000000010110100000000001011011100000111001100000001000000110000000100000011111111111111111"
hodl MAP2 is "1111111111111111100000100000010110110010111001011010000001000101101011100010000110001000000000011110100111011101100000010001000110111101000100011000000100000001101000100011110110101010100000011010101000100001101000101000010110000000100001011111111111111111"
hodl MAP3 is "1111111111111111100000000000000110000000000000011001100000110001100110000011000110000000000000011000001100000011000011110000011000011110000011000001100000011000000000000001100110000011000110011000001100011000000000000001100000000000000111111111111111111"
ser active_map is MAP1
ser current_level is 1
hodl PI is 3.14159265
hodl TWO_PI is 6.28318530
hodl FOV is 1.0472
hodl FOV_HALF is 0.5236
hodl MAX_DEPTH is 16.0
hodl RAY_STEP is 0.12
hodl MOVE_SPEED is 0.18
hodl TURN_SPEED is 0.10
hodl ENEMY_SPEED is 0.04
hodl GRAVITY is 0.15
hodl JUMP_FORCE is 1.8
ser player_x is 2.5
ser player_y is 2.5
ser player_a is 0.3
ser player_z is 0.0
ser player_vz is 0.0
ser last_side is 0
ser shoot_frames is 0
ser shoot_cooldown is 0
ser hp is 100
ser kills is 0
ser total_kills is 0
ser hit_flash is 0
ser game_state is 0
ser level_target is 4
ser weapon is 1
ser ammo_pistol is 50
ser ammo_shotgun is 12

based is_wall(mx, my)
  wagmi mx less_than 0 or mx gte MAP_W or my less_than 0 or my gte MAP_H
    paper_hands 1
  fr
  wagmi char_at(active_map, my times MAP_W plus mx) equals "1"
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
      ser fx is hx minus Math.floor(hx)
      wagmi fx less_than 0.08 or fx greater_than 0.92
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

based render_enemy(idx)
  ser ex is enemy_x(idx)
  ser ey is enemy_y(idx)
  ser dx is ex minus player_x
  ser dy is ey minus player_y
  ser dist is Math.sqrt(dx times dx plus dy times dy)
  wagmi dist less_than 0.3 or dist greater_than MAX_DEPTH
    paper_hands 0
  fr
  ser angle is Math.atan2(dy, dx) minus player_a
  to_the_moon angle greater_than PI
    angle is angle minus TWO_PI
  gg
  to_the_moon angle less_than (0 minus PI)
    angle is angle plus TWO_PI
  gg
  wagmi angle less_than (0 minus FOV_HALF minus 0.3) or angle greater_than (FOV_HALF plus 0.3)
    paper_hands 0
  fr
  ser sx is Math.floor((angle divided_by FOV plus 0.5) times SCR_W)
  ser sh is clamp(Math.floor(VIEW_H divided_by dist times 0.8), 4, VIEW_H)
  ser sw is Math.floor(sh times 0.5)
  ser hw is Math.floor(sw divided_by 2)
  ser hh is Math.floor(sh divided_by 2)
  ser my is VIEW_H divided_by 2 minus Math.floor(player_z times 3)
  ser fl is enemy_flash(idx)
  ser hd_h is Math.floor(sh times 0.25)
  ser bd_h is Math.floor(sh times 0.45)
  ser bt is my minus hh
  ser br is 160
  ser bg is 40
  ser bb is 40
  wagmi current_level equals 2
    br is 40
    bg is 50
    bb is 160
  fr
  wagmi current_level equals 3
    br is 40
    bg is 160
    bb is 40
  fr
  wagmi fl equals 1
    br is 255
    bg is 200
    bb is 200
  fr
  ser col is sx minus hw
  to_the_moon col less_than (sx plus hw)
    wagmi col gte 0 and col less_than SCR_W
      wagmi zbuf_get(col) greater_than dist
        ser frac is (col minus sx plus hw) divided_by sw
        wagmi frac greater_than 0.15 and frac less_than 0.85
          vline(col, clamp(bt, 0, VIEW_H), clamp(bt plus hd_h, 0, VIEW_H), br plus 20, bg plus 70, bb plus 40)
          wagmi frac greater_than 0.3 and frac less_than 0.45
            ser ey2 is bt plus Math.floor(hd_h divided_by 2)
            wagmi ey2 gte 0 and ey2 less_than VIEW_H
              pixel(col, ey2, 255, 255, 0)
            fr
          fr
          wagmi frac greater_than 0.55 and frac less_than 0.7
            ser ey2 is bt plus Math.floor(hd_h divided_by 2)
            wagmi ey2 gte 0 and ey2 less_than VIEW_H
              pixel(col, ey2, 255, 255, 0)
            fr
          fr
          vline(col, clamp(bt plus hd_h, 0, VIEW_H), clamp(bt plus hd_h plus bd_h, 0, VIEW_H), br, bg, bb)
          wagmi frac greater_than 0.2 and frac less_than 0.8
            vline(col, clamp(bt plus hd_h plus bd_h, 0, VIEW_H), clamp(bt plus sh, 0, VIEW_H), br minus 40, bg minus 10, bb minus 10)
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

based check_shoot()
  ser spread is 0.18
  ser damage is 1
  wagmi weapon equals 2
    spread is 0.35
    damage is 2
  fr
  wagmi weapon equals 3
    spread is 0.3
    damage is 3
  fr
  ser best_i is 0 minus 1
  ser best_dist is MAX_DEPTH
  wagmi weapon equals 3
    best_dist is 2.5
  fr
  ser cz is zbuf_get(SCR_W divided_by 2)
  ser ei is 0
  to_the_moon ei less_than enemy_count()
    wagmi enemy_alive(ei) equals 1
      ser edx is enemy_x(ei) minus player_x
      ser edy is enemy_y(ei) minus player_y
      ser edist is Math.sqrt(edx times edx plus edy times edy)
      ser max_d is cz
      wagmi weapon equals 3
        max_d is 2.5
      fr
      wagmi edist less_than max_d
        ser ea is Math.atan2(edy, edx) minus player_a
        to_the_moon ea greater_than PI
          ea is ea minus TWO_PI
        gg
        to_the_moon ea less_than (0 minus PI)
          ea is ea plus TWO_PI
        gg
        ser abs_a is ea
        wagmi abs_a less_than 0
          abs_a is 0 minus abs_a
        fr
        wagmi abs_a less_than spread and edist less_than best_dist
          best_i is ei
          best_dist is edist
        fr
      fr
    fr
    ei is ei plus 1
  gg
  wagmi best_i gte 0
    ser rem is enemy_hurt(best_i, damage)
    hit_flash is 3
    wagmi rem equals 0
      kills is kills plus 1
      total_kills is total_kills plus 1
    fr
  fr
gg

based check_enemy_damage()
  ser ei is 0
  to_the_moon ei less_than enemy_count()
    wagmi enemy_alive(ei) equals 1
      ser edx is enemy_x(ei) minus player_x
      ser edy is enemy_y(ei) minus player_y
      wagmi Math.sqrt(edx times edx plus edy times edy) less_than 1.5
        hp is hp minus 1
      fr
    fr
    ei is ei plus 1
  gg
gg

based move_enemies()
  ser spd is ENEMY_SPEED
  wagmi current_level equals 2
    spd is 0.05
  fr
  wagmi current_level equals 3
    spd is 0.06
  fr
  ser ei is 0
  to_the_moon ei less_than enemy_count()
    wagmi enemy_alive(ei) equals 1
      ser ex is enemy_x(ei)
      ser ey is enemy_y(ei)
      ser edx is player_x minus ex
      ser edy is player_y minus ey
      ser edist is Math.sqrt(edx times edx plus edy times edy)
      wagmi edist greater_than 1.2
        ser mx is edx divided_by edist times spd
        ser my is edy divided_by edist times spd
        wagmi is_wall(Math.floor(ex plus mx), Math.floor(ey)) equals 0
          ex is ex plus mx
        fr
        wagmi is_wall(Math.floor(ex), Math.floor(ey plus my)) equals 0
          ey is ey plus my
        fr
        enemy_set_pos(ei, ex, ey)
      fr
    fr
    ei is ei plus 1
  gg
gg

based draw_pistol()
  ser gx is 33
  ser gy is 25
  wagmi shoot_frames greater_than 0
    gy is gy minus 1
  fr
  wagmi shoot_frames greater_than 2
    rect(gx plus 5, gy minus 7, 4, 4, 255, 255, 120)
    rect(gx plus 6, gy minus 9, 2, 2, 255, 255, 220)
  fr
  rect(gx plus 5, gy minus 3, 4, 3, 120, 120, 130)
  rect(gx plus 3, gy, 8, 4, 160, 160, 170)
  rect(gx plus 4, gy plus 4, 6, 2, 100, 100, 110)
  rect(gx plus 4, gy plus 6, 6, 5, 120, 75, 35)
  rect(gx plus 2, gy plus 11, 10, 4, 200, 155, 120)
  rect(gx plus 4, gy plus 15, 6, 3, 195, 150, 115)
gg

based draw_shotgun()
  ser gx is 30
  ser gy is 24
  wagmi shoot_frames greater_than 0
    gy is gy minus 2
  fr
  wagmi shoot_frames greater_than 4
    rect(gx plus 4, gy minus 8, 8, 5, 255, 240, 100)
    rect(gx plus 5, gy minus 10, 6, 3, 255, 255, 200)
  fr
  rect(gx plus 5, gy minus 4, 3, 4, 100, 100, 110)
  rect(gx plus 9, gy minus 4, 3, 4, 100, 100, 110)
  rect(gx plus 3, gy, 12, 4, 140, 140, 150)
  rect(gx plus 4, gy plus 4, 10, 3, 120, 80, 40)
  rect(gx plus 3, gy plus 7, 12, 5, 100, 65, 30)
  rect(gx plus 2, gy plus 12, 14, 4, 200, 155, 120)
  rect(gx plus 4, gy plus 16, 8, 3, 195, 150, 115)
gg

based draw_chainsaw()
  ser gx is 28
  ser gy is 22
  ser bob is 0
  wagmi shoot_frames greater_than 0
    bob is 1
  fr
  ser by is gy minus 6 plus bob
  rect(gx plus 2, by, 16, 2, 180, 180, 190)
  ser ti is 0
  to_the_moon ti less_than 8
    pixel(gx plus 2 plus ti times 2, by minus 1, 200, 200, 210)
    ti is ti plus 1
  gg
  rect(gx plus 4, by plus 2, 12, 3, 150, 150, 160)
  rect(gx plus 6, gy, 10, 6, 200, 120, 30)
  rect(gx plus 7, gy plus 1, 8, 4, 220, 140, 40)
  rect(gx plus 5, gy plus 6, 4, 5, 100, 100, 110)
  rect(gx plus 13, gy plus 6, 4, 5, 100, 100, 110)
  rect(gx plus 3, gy plus 11, 8, 4, 200, 155, 120)
  rect(gx plus 12, gy plus 11, 6, 4, 200, 155, 120)
  rect(gx plus 5, gy plus 15, 10, 3, 195, 150, 115)
gg

based draw_gun()
  wagmi weapon equals 1
    draw_pistol()
  fr
  wagmi weapon equals 2
    draw_shotgun()
  fr
  wagmi weapon equals 3
    draw_chainsaw()
  fr
gg

based draw_hud()
  rect(0, VIEW_H, SCR_W, HUD_H, 45, 45, 50)
  rect(0, VIEW_H, SCR_W, 1, 80, 75, 60)
  rect(0, TOTAL_H minus 1, SCR_W, 1, 80, 75, 60)
  rect(2, VIEW_H plus 2, 14, 4, 35, 35, 40)
  ser av is ammo_pistol
  ser am is 50
  wagmi weapon equals 2
    av is ammo_shotgun
    am is 12
  fr
  wagmi weapon equals 3
    av is 99
    am is 99
  fr
  rect(3, VIEW_H plus 3, clamp(av times 12 divided_by am, 0, 12), 2, 200, 200, 40)
  rect(20, VIEW_H plus 2, 18, 4, 35, 35, 40)
  ser hw is clamp(hp times 16 divided_by 100, 0, 16)
  ser hr is 0
  ser hg is 200
  wagmi hp less_than 30
    hr is 220
    hg is 40
  fr
  rect(21, VIEW_H plus 3, hw, 2, hr, hg, 20)
  rect(42, VIEW_H plus 2, 8, 5, 200, 160, 120)
  pixel(44, VIEW_H plus 3, 255, 255, 255)
  pixel(45, VIEW_H plus 3, 40, 40, 40)
  pixel(47, VIEW_H plus 3, 255, 255, 255)
  pixel(48, VIEW_H plus 3, 40, 40, 40)
  pixel(46, VIEW_H plus 4, 180, 140, 100)
  wagmi hp greater_than 50
    rect(44, VIEW_H plus 5, 5, 1, 180, 50, 50)
  ngmi
    rect(44, VIEW_H plus 5, 5, 1, 120, 30, 30)
  fr
  rect(54, VIEW_H plus 2, 12, 4, 35, 35, 40)
  ser ki is 0
  to_the_moon ki less_than clamp(kills, 0, 4)
    rect(55 plus ki times 3, VIEW_H plus 3, 2, 2, 220, 40, 40)
    ki is ki plus 1
  gg
  rect(68, VIEW_H plus 2, 10, 4, 35, 35, 40)
  ser li is 0
  to_the_moon li less_than current_level
    rect(70 plus li times 2, VIEW_H plus 3, 1, 2, 255, 200, 40)
    li is li plus 1
  gg
  pixel(40, 20, 255, 255, 255)
  pixel(39, 20, 200, 200, 200)
  pixel(41, 20, 200, 200, 200)
  pixel(40, 19, 200, 200, 200)
  pixel(40, 21, 200, 200, 200)
  wagmi hit_flash greater_than 0
    pixel(38, 18, 255, 50, 50)
    pixel(42, 18, 255, 50, 50)
    pixel(38, 22, 255, 50, 50)
    pixel(42, 22, 255, 50, 50)
    hit_flash is hit_flash minus 1
  fr
  wagmi hp less_than 30
    ser fy is 0
    to_the_moon fy less_than VIEW_H
      pixel(0, fy, 120, 0, 0)
      pixel(SCR_W minus 1, fy, 120, 0, 0)
      fy is fy plus 1
    gg
  fr
gg

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
  pixel(ox plus Math.floor(player_x), oy plus Math.floor(player_y), 0, 255, 0)
  ser dx is Math.floor(player_x plus Math.cos(player_a) times 2)
  ser dy is Math.floor(player_y plus Math.sin(player_a) times 2)
  pixel(ox plus clamp(dx, 0, MAP_W minus 1), oy plus clamp(dy, 0, MAP_H minus 1), 255, 255, 0)
  ser ei is 0
  to_the_moon ei less_than enemy_count()
    wagmi enemy_alive(ei) equals 1
      pixel(ox plus Math.floor(enemy_x(ei)), oy plus Math.floor(enemy_y(ei)), 255, 50, 50)
    fr
    ei is ei plus 1
  gg
gg

based render_frame()
  ser zo is Math.floor(player_z times 3)
  ser col is 0
  to_the_moon col less_than SCR_W
    ser ra is player_a minus FOV_HALF plus (col times FOV divided_by SCR_W)
    ser dist is cast_ray(player_x, player_y, ra)
    dist is dist times Math.cos(ra minus player_a)
    zbuf_set(col, dist)
    ser wh is clamp(VIEW_H divided_by dist, 0, VIEW_H)
    ser mid is VIEW_H divided_by 2 minus zo
    ser wtop is clamp(mid minus Math.floor(wh divided_by 2), 0, VIEW_H)
    ser wbot is clamp(mid plus Math.floor(wh divided_by 2), 0, VIEW_H)
    ser b is clamp(1.0 minus (dist divided_by MAX_DEPTH), 0.0, 1.0)
    ser wr is Math.floor(190 times b plus 15)
    ser wg is Math.floor(35 times b plus 5)
    ser wb is Math.floor(25 times b plus 5)
    wagmi current_level equals 2
      wr is Math.floor(30 times b plus 10)
      wg is Math.floor(60 times b plus 10)
      wb is Math.floor(180 times b plus 20)
    fr
    wagmi current_level equals 3
      wr is Math.floor(40 times b plus 10)
      wg is Math.floor(160 times b plus 20)
      wb is Math.floor(40 times b plus 10)
    fr
    wagmi last_side equals 1
      wr is Math.floor(wr times 0.6)
      wg is Math.floor(wg times 0.6)
      wb is Math.floor(wb times 0.6)
    fr
    vline(col, 0, Math.floor(wtop divided_by 2), 4, 4, 15)
    vline(col, Math.floor(wtop divided_by 2), wtop, 8, 8, 28)
    vline(col, wtop, wbot, wr, wg, wb)
    ser fm is Math.floor((wbot plus VIEW_H) divided_by 2)
    vline(col, wbot, fm, 18, 55, 18)
    vline(col, fm, VIEW_H, 8, 28, 8)
    col is col plus 1
  gg
  render_all_enemies()
  draw_gun()
  draw_minimap()
  draw_hud()
  hflush()
gg

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
    wagmi k equals "e"
      wagmi player_z equals 0.0
        player_vz is JUMP_FORCE
      fr
    fr
    wagmi k equals "space"
      wagmi shoot_cooldown equals 0
        wagmi weapon equals 3
          shoot_frames is 2
          shoot_cooldown is 2
          check_shoot()
        ngmi
          wagmi weapon equals 1 and ammo_pistol greater_than 0
            shoot_frames is 4
            shoot_cooldown is 4
            ammo_pistol is ammo_pistol minus 1
            check_shoot()
          fr
          wagmi weapon equals 2 and ammo_shotgun greater_than 0
            shoot_frames is 8
            shoot_cooldown is 8
            ammo_shotgun is ammo_shotgun minus 1
            check_shoot()
          fr
        fr
      fr
    fr
    wagmi k equals "1"
      weapon is 1
    fr
    wagmi k equals "2"
      weapon is 2
    fr
    wagmi k equals "3"
      weapon is 3
    fr
    wagmi k equals "q" or k equals "esc"
      game_state is 3
    fr
    k is key()
  gg
gg

based setup_level()
  enemies_clear()
  kills is 0
  player_x is 2.5
  player_y is 2.5
  player_a is 0.3
  player_z is 0.0
  player_vz is 0.0
  wagmi current_level equals 1
    active_map is MAP1
    level_target is 4
    enemy_add(5.5, 7.5, 3)
    enemy_add(10.5, 3.5, 3)
    enemy_add(12.5, 10.5, 3)
    enemy_add(3.5, 13.5, 3)
  fr
  wagmi current_level equals 2
    active_map is MAP2
    level_target is 5
    enemy_add(5.5, 3.5, 4)
    enemy_add(13.5, 2.5, 4)
    enemy_add(8.5, 8.5, 4)
    enemy_add(2.5, 12.5, 4)
    enemy_add(12.5, 13.5, 4)
  fr
  wagmi current_level equals 3
    active_map is MAP3
    level_target is 6
    enemy_add(7.5, 3.5, 5)
    enemy_add(7.5, 12.5, 5)
    enemy_add(3.5, 7.5, 5)
    enemy_add(12.5, 7.5, 5)
    enemy_add(4.5, 4.5, 6)
    enemy_add(11.5, 11.5, 6)
  fr
gg

hires(SCR_W, TOTAL_H)
zbuf_init(SCR_W)
enemies_init()
game_init()
clear_screen()

shill ""
shill "     ██████╗  ██████╗  ██████╗ ███╗   ███╗"
shill "     ██╔══██╗██╔═══██╗██╔═══██╗████╗ ████║"
shill "     ██║  ██║██║   ██║██║   ██║██╔████╔██║"
shill "     ██║  ██║██║   ██║██║   ██║██║╚██╔╝██║"
shill "     ██████╔╝╚██████╔╝╚██████╔╝██║ ╚═╝ ██║"
shill "     ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝"
shill "              . B R O   v 0 . 3"
shill ""
shill "       WASD/Arrows — Move   E — Jump"
shill "       Space — Shoot   1/2/3 — Weapons"
shill "       Q — Quit"
shill ""
shill "       3 levels. 15 enemies. 3 weapons."
shill "       Press any key..."

ser waiting is 1
to_the_moon waiting equals 1
  wagmi str_len(key()) greater_than 0
    waiting is 0
  fr
  sleep(50)
gg
key_flush()
clear_screen()
setup_level()

to_the_moon game_state equals 0
  process_input()
  wagmi shoot_frames greater_than 0
    shoot_frames is shoot_frames minus 1
  fr
  wagmi shoot_cooldown greater_than 0
    shoot_cooldown is shoot_cooldown minus 1
  fr
  wagmi player_z greater_than 0.0 or player_vz greater_than 0.0
    player_z is player_z plus player_vz
    player_vz is player_vz minus GRAVITY
    wagmi player_z lte 0.0
      player_z is 0.0
      player_vz is 0.0
    fr
  fr
  move_enemies()
  check_enemy_damage()
  wagmi hp lte 0
    hp is 0
    game_state is 2
  fr
  wagmi kills gte level_target and game_state equals 0
    render_frame()
    wagmi current_level less_than 3
      sleep(800)
      current_level is current_level plus 1
      setup_level()
      hp is clamp(hp plus 25, 0, 100)
      ammo_pistol is ammo_pistol plus 15
      ammo_shotgun is ammo_shotgun plus 4
    ngmi
      game_state is 1
      sleep(1000)
    fr
  fr
  wagmi game_state equals 0
    render_frame()
    sleep(40)
  fr
gg

clear_screen()
shill ""
wagmi game_state equals 1
  shill "  YOU WIN — ALL 3 LEVELS CLEARED"
  shill "  Total kills: " plus total_kills plus " | HP: " plus hp plus "%"
ngmi
  wagmi game_state equals 3
    shill "  Quit. Level " plus current_level plus "/3 | Kills: " plus total_kills
  ngmi
    shill "  YOU DIED — Level " plus current_level plus "/3 | Kills: " plus total_kills
  fr
fr
shill ""
shill "  wagmi."
shill ""

gn
