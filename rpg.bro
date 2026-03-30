gm
APE_INTO degen_math
APE_INTO degen_string
APE_INTO degen_time
APE_INTO degen_gfx
APE_INTO degen_game

hodl SCR_W is 80
hodl SCR_H is 48
hodl TILE is 4
hodl VIEW_W is 20
hodl VIEW_H is 10
hodl MAP_W is 40
hodl MAP_H is 20
hodl DLG_Y is 42

nfa Map tiles: 0=grass 1=wall 2=path 3=water 4=door 5=stone_floor
nfa Map is 40x20 = 800 chars
hodl WORLD is "1111111111111111111111111111111111111111100000000000000000001111111111111111111110022222200000000001311111111111111111111002000020222222201311111111111110000000020000020000000201311111115555555111111002000002022222020131111111555555511111100200000200000002013111111155555551111110020000020222200201300000005555555000011002000002000020020030000000555555500001100222222000002002003111111155555551111110000000000000200200311111115555555111111002222222200020020031111111555555511111100000000020002002003111111155555551111110000000002000200200300000005555555000011002222222200020020030000000555555500001100000000000002222003111111155555551111110000000000000000001311111115555555111111111111111111111111111111111111111111111111"

nfa NPC positions (tile x, tile y)
nfa 0: The Lexer (in the grass area)
nfa 1: The Parser (near the path)
nfa 2: The VM (in the stone room)
nfa 3: The DOOM Demon (deep in stone room)

ser player_x is 2
ser player_y is 2
ser player_dir is 0
ser game_running is 1
ser dialog_active is 0
ser dialog_text is ""
ser dialog_line2 is ""
ser dialog_speaker is ""
ser keywords_found is 0
ser npc_talked_0 is 0
ser npc_talked_1 is 0
ser npc_talked_2 is 0
ser npc_talked_3 is 0

based get_tile(tx, ty)
  wagmi tx less_than 0 or tx gte MAP_W or ty less_than 0 or ty gte MAP_H
    paper_hands 1
  fr
  paper_hands to_number(char_at(WORLD, ty times MAP_W plus tx))
gg

based is_solid(tx, ty)
  ser t is get_tile(tx, ty)
  wagmi t equals 1 or t equals 3
    paper_hands 1
  fr
  paper_hands 0
gg

based draw_tile(sx, sy, tile_type)
  wagmi tile_type equals 0
    rect(sx, sy, TILE, TILE, 30, 90, 30)
    pixel(sx plus 1, sy plus 1, 35, 100, 35)
  fr
  wagmi tile_type equals 1
    rect(sx, sy, TILE, TILE, 70, 65, 60)
    rect(sx, sy, TILE, 1, 85, 80, 75)
  fr
  wagmi tile_type equals 2
    rect(sx, sy, TILE, TILE, 140, 120, 80)
    pixel(sx plus 2, sy plus 2, 130, 110, 70)
  fr
  wagmi tile_type equals 3
    rect(sx, sy, TILE, TILE, 30, 50, 120)
    pixel(sx plus 1, sy plus 2, 40, 60, 140)
  fr
  wagmi tile_type equals 4
    rect(sx, sy, TILE, TILE, 160, 140, 50)
    rect(sx plus 1, sy plus 1, 2, 2, 180, 160, 60)
  fr
  wagmi tile_type equals 5
    rect(sx, sy, TILE, TILE, 80, 80, 90)
    pixel(sx plus 1, sy plus 3, 75, 75, 85)
  fr
gg

based draw_npc(sx, sy, npc_id)
  nfa Each NPC is a different color
  wagmi npc_id equals 0
    nfa Lexer - cyan
    rect(sx, sy, TILE, TILE, 50, 200, 200)
    pixel(sx plus 1, sy, 255, 255, 100)
  fr
  wagmi npc_id equals 1
    nfa Parser - magenta
    rect(sx, sy, TILE, TILE, 200, 80, 200)
    pixel(sx plus 2, sy, 255, 255, 100)
  fr
  wagmi npc_id equals 2
    nfa VM - orange
    rect(sx, sy, TILE, TILE, 220, 150, 40)
    pixel(sx plus 1, sy, 255, 255, 100)
  fr
  wagmi npc_id equals 3
    nfa DOOM Demon - red
    rect(sx, sy, TILE, TILE, 220, 40, 40)
    pixel(sx plus 1, sy, 255, 50, 50)
    pixel(sx plus 2, sy, 255, 50, 50)
  fr
gg

based draw_player(sx, sy)
  rect(sx, sy, TILE, TILE, 60, 180, 60)
  rect(sx plus 1, sy, 2, 1, 255, 255, 255)
  pixel(sx plus 1, sy plus 2, 50, 160, 50)
gg

based draw_text_char(ch, cx, cy, r, g, b)
  nfa Minimal 3x5 pixel font for key characters
  nfa Just draw a colored pixel pattern — enough to be readable
  pixel(cx, cy, r, g, b)
  pixel(cx plus 1, cy, r, g, b)
gg

based show_dialog(speaker, line1, line2)
  dialog_active is 1
  dialog_speaker is speaker
  dialog_text is line1
  dialog_line2 is line2
gg

based close_dialog()
  dialog_active is 0
gg

based check_npc_interact()
  nfa NPC 0: The Lexer at (5, 3)
  wagmi player_x equals 4 and player_y equals 3
    wagmi npc_talked_0 equals 0
      show_dialog("THE LEXER", "gm ser. I break source code into tokens.", "I gave you: ser, hodl, wagmi, shill")
      npc_talked_0 is 1
      keywords_found is keywords_found plus 4
    ngmi
      show_dialog("THE LEXER", "Every word has meaning. Even 'rug'.", "Go find the Parser. East, past the water.")
    fr
  fr
  nfa NPC 1: The Parser at (15, 5)
  wagmi player_x equals 14 and player_y equals 5
    wagmi npc_talked_1 equals 0
      show_dialog("THE PARSER", "I read the tokens and build the AST.", "I gave you: based, paper_hands, ape_in")
      npc_talked_1 is 1
      keywords_found is keywords_found plus 3
    ngmi
      show_dialog("THE PARSER", "wagmi/ngmi/fr. The sacred if/else.", "The VM awaits in the stone chamber.")
    fr
  fr
  nfa NPC 2: The VM at (30, 8)
  wagmi player_x equals 29 and player_y equals 8
    wagmi npc_talked_2 equals 0
      show_dialog("THE VIRTUAL MACHINE", "I execute the bytecode on a stack.", "CONST, ADD, MUL, CALL, RETURN, HALT.")
      npc_talked_2 is 1
      keywords_found is keywords_found plus 3
    ngmi
      show_dialog("THE VM", "The stack holds all truth. Push. Pop.", "Deeper in the chamber... something stirs.")
    fr
  fr
  nfa NPC 3: DOOM Demon at (35, 12)
  wagmi player_x equals 34 and player_y equals 12
    wagmi npc_talked_3 equals 0
      show_dialog("THE DOOM DEMON", "You found me. I am what they all fear.", "Can. It. Run. DOOM? ...yes. Yes it can.")
      npc_talked_3 is 1
      keywords_found is keywords_found plus 5
    ngmi
      wagmi keywords_found gte 15
        show_dialog("THE DOOM DEMON", "15 keywords collected. The language", "is complete. You built BroLang. wagmi.")
        game_running is 0
      ngmi
        show_dialog("THE DOOM DEMON", "Not enough keywords yet, degen.", "Talk to everyone. Collect them all.")
      fr
    fr
  fr
gg

based render_world()
  nfa Calculate camera position (centered on player)
  ser cam_x is player_x minus (VIEW_W divided_by 2)
  ser cam_y is player_y minus (VIEW_H divided_by 2)
  wagmi cam_x less_than 0
    cam_x is 0
  fr
  wagmi cam_y less_than 0
    cam_y is 0
  fr
  wagmi cam_x greater_than MAP_W minus VIEW_W
    cam_x is MAP_W minus VIEW_W
  fr
  wagmi cam_y greater_than MAP_H minus VIEW_H
    cam_y is MAP_H minus VIEW_H
  fr

  nfa Draw tiles
  ser ty is 0
  to_the_moon ty less_than VIEW_H
    ser tx is 0
    to_the_moon tx less_than VIEW_W
      ser wx is cam_x plus tx
      ser wy is cam_y plus ty
      ser sx is tx times TILE
      ser sy is ty times TILE
      ser tile is get_tile(wx, wy)
      draw_tile(sx, sy, tile)
      tx is tx plus 1
    gg
    ty is ty plus 1
  gg

  nfa Draw NPCs if in view
  nfa NPC 0 at (5,3)
  wagmi 5 gte cam_x and 5 less_than cam_x plus VIEW_W and 3 gte cam_y and 3 less_than cam_y plus VIEW_H
    draw_npc((5 minus cam_x) times TILE, (3 minus cam_y) times TILE, 0)
  fr
  nfa NPC 1 at (15,5)
  wagmi 15 gte cam_x and 15 less_than cam_x plus VIEW_W and 5 gte cam_y and 5 less_than cam_y plus VIEW_H
    draw_npc((15 minus cam_x) times TILE, (5 minus cam_y) times TILE, 1)
  fr
  nfa NPC 2 at (30,8)
  wagmi 30 gte cam_x and 30 less_than cam_x plus VIEW_W and 8 gte cam_y and 8 less_than cam_y plus VIEW_H
    draw_npc((30 minus cam_x) times TILE, (8 minus cam_y) times TILE, 2)
  fr
  nfa NPC 3 at (35,12)
  wagmi 35 gte cam_x and 35 less_than cam_x plus VIEW_W and 12 gte cam_y and 12 less_than cam_y plus VIEW_H
    draw_npc((35 minus cam_x) times TILE, (12 minus cam_y) times TILE, 3)
  fr

  nfa Draw player
  ser px is (player_x minus cam_x) times TILE
  ser py is (player_y minus cam_y) times TILE
  draw_player(px, py)
gg

based render_hud()
  nfa HUD background
  rect(0, 40, SCR_W, 8, 20, 20, 25)
  rect(0, 40, SCR_W, 1, 60, 55, 45)

  nfa Dialog box
  wagmi dialog_active equals 1
    rect(2, DLG_Y, 76, 5, 10, 10, 15)
    rect(2, DLG_Y, 76, 1, 100, 80, 200)

    nfa Speaker name indicator (colored dot)
    rect(4, DLG_Y plus 1, 2, 1, 100, 200, 200)
  ngmi
    nfa Show hints when no dialog
    nfa "SPACE: talk  WASD: move"
    rect(4, DLG_Y plus 1, 2, 1, 80, 80, 90)
  fr

  nfa Keywords counter (top right of HUD)
  ser ki is 0
  to_the_moon ki less_than keywords_found and ki less_than 15
    ser kx is 60 plus ki
    pixel(kx, 41, 255, 200, 50)
    ki is ki plus 1
  gg
gg

based render_frame()
  render_world()
  render_hud()
  hflush()
gg

based process_input()
  ser k is key()
  to_the_moon str_len(k) greater_than 0
    wagmi dialog_active equals 1
      wagmi k equals "space" or k equals "enter"
        close_dialog()
      fr
    ngmi
      ser nx is player_x
      ser ny is player_y
      wagmi k equals "w" or k equals "up"
        ny is player_y minus 1
      fr
      wagmi k equals "s" or k equals "down"
        ny is player_y plus 1
      fr
      wagmi k equals "a" or k equals "left"
        nx is player_x minus 1
      fr
      wagmi k equals "d" or k equals "right"
        nx is player_x plus 1
      fr
      wagmi is_solid(nx, ny) equals 0
        player_x is nx
        player_y is ny
      fr
      wagmi k equals "space"
        check_npc_interact()
      fr
      wagmi k equals "q"
        game_running is 0
      fr
    fr
    k is key()
  gg
gg

nfa =============================================
nfa   MAIN
nfa =============================================

hires(SCR_W, SCR_H)
game_init()
clear_screen()

nfa Title
shill ""
shill "  ╔══════════════════════════════════════╗"
shill "  ║     THE LEGEND OF BROLANG           ║"
shill "  ║     An RPG in BroLang               ║"
shill "  ╚══════════════════════════════════════╝"
shill ""
shill "  You are a degen. You seek the sacred"
shill "  keywords to build the ultimate language."
shill ""
shill "  Find the 4 NPCs. Collect 15 keywords."
shill "  Talk to The DOOM Demon to win."
shill ""
shill "  WASD: move  SPACE: talk  Q: quit"
shill ""
shill "  Press any key..."

ser w is 1
to_the_moon w equals 1
  wagmi str_len(key()) greater_than 0
    w is 0
  fr
  sleep(50)
gg
key_flush()
clear_screen()

nfa Opening dialog
show_dialog("NARRATOR", "You awaken in a terminal. The cursor", "blinks. Something ancient stirs...")

to_the_moon game_running equals 1
  process_input()
  render_frame()
  sleep(50)
gg

clear_screen()
shill ""
wagmi keywords_found gte 15
  shill "  ==========================================="
  shill "  YOU BUILT BROLANG"
  shill "  ==========================================="
  shill ""
  shill "  Keywords collected: {keywords_found}"
  shill ""
  shill "  The Lexer tokenized your dreams."
  shill "  The Parser shaped them into an AST."
  shill "  The VM executed them on a stack."
  shill "  And DOOM... DOOM ran on all of it."
  shill ""
  shill "  wagmi."
ngmi
  shill "  You left the terminal."
  shill "  Keywords: {keywords_found}/15"
  shill "  The language remains unfinished... for now."
fr
shill ""

gn
