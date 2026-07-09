"""
gen_sprites.py
Gerador de sprites pixel art (PNG) para os monstros do Monster Attack Clicker.

Cada monstro vira um spritesheet horizontal com 3 frames de 128x128:
  [ idle | piscando | flash de dano (branco) ]
salvos em assets/sprites/<key>.png — o mesmo arquivo referenciado em
js/config.js (campo `image` de cada MONSTER_TYPES).

Como usar:
  python tools/gen_sprites.py

Requer Pillow (pip install pillow). Edite as paletas/formas abaixo e rode de
novo para regenerar os PNGs — não precisa mexer em nenhum JS.
"""
import os
from PIL import Image

GRID = 32
PIXEL = 4
FRAME = GRID * PIXEL
WHITE = (255, 255, 255, 255)

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites')


def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


# ---------------------------------------------------------------------
# Engine genérico: silhueta (grade booleana 32x32) + contorno automático +
# manchas de highlight/shadow + overlays (acessórios) + olhos + boca.
# Usado por todos os monstros humanoides/dragão. O Slime usa seu próprio
# algoritmo de "blob" (silhueta por função, não por união de elipses).
# ---------------------------------------------------------------------
def new_grid():
    return [[False] * GRID for _ in range(GRID)]


def set_ellipse(grid, cx, cy, rx, ry):
    for r in range(GRID):
        for c in range(GRID):
            dx = (c + 0.5 - cx) / rx
            dy = (r + 0.5 - cy) / ry
            if dx * dx + dy * dy <= 1.0:
                grid[r][c] = True


def set_rect(grid, r0, c0, r1, c1):
    for r in range(max(0, r0), min(GRID, r1)):
        for c in range(max(0, c0), min(GRID, c1)):
            grid[r][c] = True


def is_in(grid, r, c):
    return 0 <= r < GRID and 0 <= c < GRID and grid[r][c]


def put(px, r, c, color):
    for yy in range(PIXEL):
        for xx in range(PIXEL):
            px[c * PIXEL + xx, r * PIXEL + yy] = color


def put_region(px, cells, color):
    for (r, c) in cells:
        put(px, r, c, color)


class Creature:
    """Corpo montado a partir de elipses/retângulos (goblin, orc, troll, dragão, demônio)."""

    def __init__(self, palette):
        self.pal = palette
        self.body_grid = new_grid()
        self.overlay_cells = []  # [(cells, color)]
        self.eye_clusters = []   # [{row,left_col,right_col,pupil}]
        self.mouth_cells_open = []
        self.mouth_cells_closed = []
        self.highlight_rule = lambda r, c: False
        self.shadow_rule = lambda r, c: False

    def add_overlay(self, cells, color):
        self.overlay_cells.append((cells, color))

    def render(self, eyes_closed=False, flash_white=False):
        img = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
        px = img.load()
        grid = self.body_grid
        for r in range(GRID):
            for c in range(GRID):
                if not grid[r][c]:
                    continue
                is_edge = not (is_in(grid, r - 1, c) and is_in(grid, r + 1, c) and
                               is_in(grid, r, c - 1) and is_in(grid, r, c + 1))
                color = self.pal['outline'] if is_edge else self.pal['body']
                if not is_edge and self.highlight_rule(r, c):
                    color = self.pal['highlight']
                if not is_edge and self.shadow_rule(r, c):
                    color = self.pal['shadow']
                if flash_white:
                    color = WHITE
                put(px, r, c, color)

        for cells, color in self.overlay_cells:
            put_region(px, cells, WHITE if flash_white else color)

        if flash_white:
            return img

        for e in self.eye_clusters:
            row, lc, rc, pupil = e['row'], e['left_col'], e['right_col'], e['pupil']
            if eyes_closed:
                for cc in (lc - 1, lc, lc + 1):
                    put(px, row, cc, self.pal['outline'])
                for cc in (rc - 1, rc, rc + 1):
                    put(px, row, cc, self.pal['outline'])
            else:
                for cc in (lc - 1, lc, lc + 1):
                    put(px, row, cc, pupil)
                for cc in (rc - 1, rc, rc + 1):
                    put(px, row, cc, pupil)
                put(px, row - 1, lc - 1, WHITE)
                put(px, row - 1, rc - 1, WHITE)

        put_region(px, self.mouth_cells_closed if eyes_closed else self.mouth_cells_open, self.pal['outline'])
        return img

    def sheet(self):
        idle = self.render(False, False)
        blink = self.render(True, False)
        flash = self.render(False, True)
        sheet = Image.new('RGBA', (FRAME * 3, FRAME), (0, 0, 0, 0))
        sheet.paste(idle, (0, 0))
        sheet.paste(blink, (FRAME, 0))
        sheet.paste(flash, (FRAME * 2, 0))
        return sheet


# ---------------------------------------------------------------------
# SLIME v2 — silhueta em "lóbulos" (3 elipses no topo + corpo principal),
# o que dá aquele contorno recortado no topo. Olhos grandes e simétricos
# (os dois com brilho branco no canto superior-esquerdo), boca reta neutra
# (ou feroz nas variantes fortes), manchas escuras espalhadas pelo corpo e
# sombra elíptica no chão. Essa base é compartilhada por TODOS os slimes —
# só paleta e acessórios (spikes/crown/scar/fierce_mouth) mudam por variante.
# ---------------------------------------------------------------------
SLIME_BODY = new_grid()
set_ellipse(SLIME_BODY, 16, 19, 13, 11)   # corpo principal (deixa espaço embaixo pra sombra aparecer)
set_ellipse(SLIME_BODY, 16, 7, 7, 6)      # lóbulo superior central
set_ellipse(SLIME_BODY, 9, 10, 5.5, 5)    # lóbulo superior esquerdo
set_ellipse(SLIME_BODY, 23, 10, 5.5, 5)   # lóbulo superior direito

# Manchas escuras espalhadas pelo corpo (linha, coluna, largura, altura),
# além do contorno automático — dão a aparência "manchada" da referência.
SLIME_BLOTCHES = [
    (9, 20, 4, 2), (14, 23, 3, 3), (22, 7, 3, 3), (24, 20, 6, 4), (17, 9, 2, 2),
]


def render_slime(palette, spikes=False, fierce_mouth=False, crown=False, scar=False):
    grid = SLIME_BODY

    def frame(eyes_closed=False, flash_white=False):
        img = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
        px = img.load()

        # sombra elíptica no chão, desenhada antes do corpo (fica por baixo,
        # e aparece só nas bordas onde o corpo não a cobre)
        if not flash_white:
            for r in range(28, 32):
                for c in range(GRID):
                    dx = (c + 0.5 - 16) / 10.0
                    dy = (r + 0.5 - 30.5) / 1.3
                    if dx * dx + dy * dy <= 1.0:
                        put(px, r, c, (0, 0, 0, 90))

        for r in range(GRID):
            for c in range(GRID):
                if not grid[r][c]:
                    continue
                is_edge = not (is_in(grid, r - 1, c) and is_in(grid, r + 1, c) and
                               is_in(grid, r, c - 1) and is_in(grid, r, c + 1))
                color = palette['outline'] if is_edge else palette['body']
                if not is_edge and 3 <= r <= 9 and 8 <= c <= 13:
                    color = palette['highlight']
                if not is_edge:
                    for (br, bc, bw, bh) in SLIME_BLOTCHES:
                        if br <= r < br + bh and bc <= c < bc + bw:
                            color = palette['shadow']
                if flash_white:
                    color = WHITE
                put(px, r, c, color)

        if spikes and not flash_white:
            for sc in (9, 16, 23):
                height = 4 if sc == 16 else 3
                for i in range(height):
                    width = height - i
                    row = (1 if sc == 16 else 2) - i
                    if row < 0:
                        continue
                    color = palette.get('spike', hexc('#96ebff')) if i < height - 1 else palette.get('spike_dark', hexc('#5abee6'))
                    for w in range(-((width - 1) // 2 + (width % 2)), (width - 1) // 2 + 1):
                        col = sc + w
                        if 0 <= col < GRID:
                            put(px, row, col, color)

        # coroa (Slime Rei Vermelho): 5 pontas largas cobrindo quase todo o topo
        if crown and not flash_white:
            for sc in (7, 11.5, 16, 20.5, 25):
                sc = int(round(sc))
                height = 5 if sc == 16 else (4 if sc in (11, 12, 20, 21) else 3)
                for i in range(height):
                    width = height - i
                    row = 0 - i + (0 if sc == 16 else 1)
                    if row < 0:
                        continue
                    color = palette.get('crown', hexc('#ffd54a')) if i < height - 1 else palette.get('crown_dark', hexc('#c9941f'))
                    for w in range(-((width - 1) // 2 + (width % 2)), (width - 1) // 2 + 1):
                        col = sc + w
                        if 0 <= col < GRID:
                            put(px, row, col, color)

        if flash_white:
            return img

        # olhos grandes e simétricos — os dois ganham o brilho branco
        if eyes_closed:
            for cols in ((10, 11, 12), (20, 21, 22)):
                for cc in cols:
                    put(px, 14, cc, palette['outline'])
        else:
            for rr in (12, 13, 14):
                for cc in (10, 11, 12):
                    put(px, rr, cc, palette['pupil'])
                for cc in (20, 21, 22):
                    put(px, rr, cc, palette['pupil'])
            put(px, 12, 10, WHITE)
            put(px, 12, 20, WHITE)

        if fierce_mouth:
            for cc in (14, 15, 16, 17):
                put(px, 19, cc, palette['outline'])
            for cc in (14, 17):
                put(px, 20, cc, WHITE)
        else:
            for cc in range(13, 19):
                put(px, 19, cc, palette['outline'])
                put(px, 20, cc, palette['outline'])

        # cicatriz (Slime Azul Bárbaro): risco diagonal por cima do olho esquerdo
        if scar:
            scar_color = palette.get('scar', hexc('#7a1414'))
            for (r, c) in ((9, 8), (10, 9), (11, 10), (12, 11), (13, 12)):
                put(px, r, c, scar_color)

        return img

    idle, blink, flash = frame(False, False), frame(True, False), frame(False, True)
    sheet = Image.new('RGBA', (FRAME * 3, FRAME), (0, 0, 0, 0))
    sheet.paste(idle, (0, 0)); sheet.paste(blink, (FRAME, 0)); sheet.paste(flash, (FRAME * 2, 0))
    return sheet


# ---------------------------------------------------------------------
# Definições de cada monstro (edite aqui e rode o script de novo)
# ---------------------------------------------------------------------
def make_slime_green():
    pal = {'outline': hexc('#1d5c22'), 'body': hexc('#6fd66f'),
           'highlight': hexc('#b8f0b0'), 'shadow': hexc('#3d9a4a'), 'pupil': hexc('#1a1a1a')}
    return render_slime(pal, spikes=False, fierce_mouth=False)


def make_slime_blue():
    pal = {'outline': hexc('#0a1438'), 'body': hexc('#3f8ceb'),
           'highlight': hexc('#c4e8ff'), 'shadow': hexc('#1c4aa8'), 'pupil': hexc('#14ebff'),
           'spike': hexc('#96ebff'), 'spike_dark': hexc('#5abee6')}
    return render_slime(pal, spikes=True, fierce_mouth=True)


def make_slime_green_warrior():
    # verde mais escuro/robusto + crista tipo moicano (reaproveita o desenho de
    # "spikes" com cores de guerra) e boca feroz — chefe do Ciclo 1.
    pal = {'outline': hexc('#0f3d14'), 'body': hexc('#4fae4f'),
           'highlight': hexc('#8fe08f'), 'shadow': hexc('#2d7a35'), 'pupil': hexc('#1a1a1a'),
           'spike': hexc('#d94f2b'), 'spike_dark': hexc('#a8371c')}
    return render_slime(pal, spikes=True, fierce_mouth=True)


def make_slime_red():
    # variante "padrão" como o slime verde, só recolorida — não é chefe.
    pal = {'outline': hexc('#5c1414'), 'body': hexc('#e0574a'),
           'highlight': hexc('#ffb3a8'), 'shadow': hexc('#b8322a'), 'pupil': hexc('#1a1a1a')}
    return render_slime(pal, spikes=False, fierce_mouth=False)


def make_slime_blue_barbarian():
    # azul mais escuro/intenso + cristais de gelo + cicatriz de batalha + olhos
    # âmbar (raiva) — chefe do Ciclo 2, mais forte que o Slime Verde Guerreiro.
    pal = {'outline': hexc('#061029'), 'body': hexc('#2f6bc0'),
           'highlight': hexc('#a8d4ff'), 'shadow': hexc('#123a80'), 'pupil': hexc('#ff8a3d'),
           'spike': hexc('#96ebff'), 'spike_dark': hexc('#5abee6'), 'scar': hexc('#7a1414')}
    return render_slime(pal, spikes=True, fierce_mouth=True, scar=True)


def make_slime_red_king():
    # vermelho profundo + coroa dourada — o mais forte de todos os slimes,
    # chefe do Ciclo 3.
    pal = {'outline': hexc('#3d0a0a'), 'body': hexc('#b8272a'),
           'highlight': hexc('#ff8a70'), 'shadow': hexc('#7a1414'), 'pupil': hexc('#ffd54a'),
           'crown': hexc('#ffd54a'), 'crown_dark': hexc('#c9941f')}
    return render_slime(pal, spikes=False, fierce_mouth=True, crown=True)


# ---------------------------------------------------------------------
# GOBLIN v2 — base compartilhada (cabeça arredondada, corpo curvado, orelhas
# pontudas, presa) reaproveitada pelas 7 variantes do Mapa 2. Cada variante
# só muda paleta/pupila/presa e chama add_overlay pra acessórios extras
# (chapéu, elmo, robe, coroa, etc.) — mesmo espírito do motor dos slimes.
# ---------------------------------------------------------------------
def cone_cells(top_row, center_col, height, base_width):
    """Lista de células formando um triângulo (chapéu/coroa): ponta em cima, base larga embaixo."""
    cells = []
    for i in range(height):
        row = top_row + i
        w = max(1, base_width - (height - 1 - i) * 2)
        half = w // 2
        for c in range(center_col - half, center_col - half + w):
            cells.append((row, c))
    return cells


def build_goblin(pal, pupil=None, tusk=True, big=False):
    scale = 1.15 if big else 1.0
    cr = Creature(pal)
    set_ellipse(cr.body_grid, 16, 11, 7.5 * scale, 7 * scale)
    set_ellipse(cr.body_grid, 16, 24, 7 * scale, 7 * scale)
    set_rect(cr.body_grid, 16, 9, 25, 23)
    cr.highlight_rule = lambda r, c: 5 <= r <= 10 and 10 <= c <= 13
    cr.shadow_rule = lambda r, c: r >= 20 and c >= 20
    ear_l = [(r, c) for r in range(6, 13) for c in range(4, 10) if 0 <= (c - 4) <= (12 - r) * 0.9]
    ear_r = [(r, 32 - 1 - c) for (r, c) in ear_l]
    cr.add_overlay(ear_l, pal['body'])
    cr.add_overlay(ear_r, pal['body'])
    cr.add_overlay([(r, 3) for r in range(7, 12)] + [(6, 4), (12, 4)], pal['outline'])
    cr.add_overlay([(r, 28) for r in range(7, 12)] + [(6, 27), (12, 27)], pal['outline'])
    if tusk:
        cr.add_overlay([(16, 15), (17, 15)], WHITE)
    pupil_color = pupil or hexc('#111111')
    cr.eye_clusters = [
        {'row': 10, 'left_col': 12, 'right_col': 12, 'pupil': pupil_color},
        {'row': 10, 'left_col': 20, 'right_col': 20, 'pupil': pupil_color},
    ]
    cr.mouth_cells_open = [(13, 14), (14, 13), (14, 14), (14, 15), (14, 16), (13, 17)]
    cr.mouth_cells_closed = [(13, 13), (13, 14), (13, 17), (13, 18)]
    return cr


def make_goblin_green():
    # o goblin "padrão" — mais fraco do Mapa 2.
    pal = {'outline': hexc('#122b0d'), 'body': hexc('#8FBF5B'),
           'highlight': hexc('#c8f0a0'), 'shadow': hexc('#5C8A3A')}
    return build_goblin(pal).sheet()


def make_goblin_red():
    # tribo vermelha, um pouco mais forte que a verde.
    pal = {'outline': hexc('#3d0f0a'), 'body': hexc('#c9583f'),
           'highlight': hexc('#f0a888'), 'shadow': hexc('#8a3420')}
    return build_goblin(pal).sheet()


def make_goblin_mage():
    # chapéu de mago roxo com ponta dourada + túnica roxa + olhos brilhantes.
    pal = {'outline': hexc('#171426'), 'body': hexc('#7a9a5b'),
           'highlight': hexc('#b8d494'), 'shadow': hexc('#4f6a3a')}
    cr = build_goblin(pal, pupil=hexc('#66e0ff'))
    cr.add_overlay(cone_cells(1, 16, 5, 9), hexc('#4a2e7a'))
    cr.add_overlay([(1, 15), (1, 16)], hexc('#d4af37'))
    cr.add_overlay([(r, c) for r in range(17, 24) for c in range(13, 20)], hexc('#4a2e7a'))
    return cr.sheet()


def make_goblin_warrior():
    # elmo/faixa de metal na testa + peitoral reforçado, mais robusto.
    pal = {'outline': hexc('#16240f'), 'body': hexc('#6f9b48'),
           'highlight': hexc('#a8d47a'), 'shadow': hexc('#455f30')}
    cr = build_goblin(pal)
    cr.add_overlay([(6, c) for c in range(11, 22)], hexc('#8a8a8a'))
    cr.add_overlay([(r, c) for r in range(17, 23) for c in range(13, 20)], hexc('#6a6a6a'))
    return cr.sheet()


def make_goblin_priest():
    # CHEFE (ciclo 4) — capuz/túnica branca com detalhe dourado, símbolo
    # sagrado no peito, olhos dourados.
    pal = {'outline': hexc('#2a1f0a'), 'body': hexc('#7a9a5b'),
           'highlight': hexc('#b8d494'), 'shadow': hexc('#4f6a3a')}
    cr = build_goblin(pal, pupil=hexc('#ffd54a'))
    cr.add_overlay(cone_cells(2, 16, 4, 8), hexc('#e8e0c8'))
    cr.add_overlay([(r, c) for r in range(17, 25) for c in range(13, 20)], hexc('#e8e0c8'))
    cr.add_overlay([(19, 16), (20, 15), (20, 16), (20, 17), (21, 16)], hexc('#d4af37'))
    return cr.sheet()


def make_goblin_master():
    # CHEFE (ciclo 5) — robe roxo escuro com barra dourada + circlete/coroa
    # pequena, olhos violeta, mais imponente que o Sacerdote.
    pal = {'outline': hexc('#150a1f'), 'body': hexc('#6a7a5f'),
           'highlight': hexc('#9cae8e'), 'shadow': hexc('#3f4a38')}
    cr = build_goblin(pal, pupil=hexc('#c060ff'))
    cr.add_overlay([(r, c) for r in range(17, 25) for c in range(12, 21)], hexc('#5a2a7a'))
    cr.add_overlay([(17, c) for c in range(12, 21)], hexc('#d4af37'))
    for sc in (12, 16, 20):
        h = 3 if sc == 16 else 2
        cr.add_overlay(cone_cells(7 - h, sc, h, 3), hexc('#d4af37'))
    return cr.sheet()


def make_goblin_greater():
    # CHEFE (ciclo 6) — o mais forte do Mapa 2: fisicamente maior, pele
    # escura, pintura de guerra vermelha, olhos vermelhos brilhantes.
    pal = {'outline': hexc('#0a1a05'), 'body': hexc('#4a6a35'),
           'highlight': hexc('#7a9a5f'), 'shadow': hexc('#2c3d20')}
    cr = build_goblin(pal, pupil=hexc('#ff4a3d'), big=True)
    cr.add_overlay([(9, 9), (10, 10), (11, 11)], hexc('#c0342a'))
    cr.add_overlay([(9, 22), (10, 21), (11, 20)], hexc('#c0342a'))
    cr.mouth_cells_open = [(13, c) for c in range(12, 21)]
    cr.mouth_cells_closed = cr.mouth_cells_open
    return cr.sheet()


def make_orc():
    pal = {'outline': hexc('#14160f'), 'body': hexc('#8FA06B'),
           'highlight': hexc('#c4d19a'), 'shadow': hexc('#586b3e')}
    cr = Creature(pal)
    set_ellipse(cr.body_grid, 16, 10, 6.5, 6.5)
    set_ellipse(cr.body_grid, 16, 23, 10, 9)
    set_rect(cr.body_grid, 16, 8, 24, 24)
    cr.highlight_rule = lambda r, c: 5 <= r <= 9 and 11 <= c <= 14
    cr.shadow_rule = lambda r, c: r >= 19 and c >= 22
    armor = [(r, c) for r in range(18, 27) for c in range(11, 21)]
    cr.add_overlay(armor, hexc('#d9d9d9'))
    cr.add_overlay([(18, c) for c in range(11, 21)] + [(26, c) for c in range(11, 21)], pal['outline'])
    cr.add_overlay([(14, 12), (15, 12), (14, 13)], WHITE)
    cr.add_overlay([(14, 19), (15, 19), (14, 18)], WHITE)
    cr.eye_clusters = [
        {'row': 9, 'left_col': 12, 'right_col': 12, 'pupil': hexc('#111111')},
        {'row': 9, 'left_col': 20, 'right_col': 20, 'pupil': hexc('#111111')},
    ]
    cr.mouth_cells_open = [(13, c) for c in range(13, 20)]
    cr.mouth_cells_closed = [(13, c) for c in range(13, 20)]
    return cr.sheet()


def make_troll():
    pal = {'outline': hexc('#150f1c'), 'body': hexc('#A98FBF'),
           'highlight': hexc('#d9c8ec'), 'shadow': hexc('#6b4a8a')}
    cr = Creature(pal)
    set_ellipse(cr.body_grid, 16, 10, 8, 7)
    set_ellipse(cr.body_grid, 16, 23, 12, 9.5)
    set_ellipse(cr.body_grid, 4, 22, 4.5, 6)
    set_ellipse(cr.body_grid, 28, 22, 4.5, 6)
    set_rect(cr.body_grid, 16, 8, 24, 24)
    cr.highlight_rule = lambda r, c: 5 <= r <= 9 and 11 <= c <= 15
    cr.shadow_rule = lambda r, c: r >= 20 and c >= 23
    for (r, c) in [(7, 7), (20, 10), (24, 20), (9, 22)]:
        cr.add_overlay([(r, c), (r, c + 1), (r + 1, c)], hexc('#4a2e5c'))
    cr.eye_clusters = [
        {'row': 9, 'left_col': 12, 'right_col': 12, 'pupil': hexc('#2e2233')},
        {'row': 9, 'left_col': 20, 'right_col': 20, 'pupil': hexc('#2e2233')},
    ]
    cr.mouth_cells_open = [(13, c) for c in range(11, 21)]
    cr.mouth_cells_closed = [(13, c) for c in range(11, 21)]
    return cr.sheet()


def make_dragon():
    pal = {'outline': hexc('#1a0d0a'), 'body': hexc('#ff7a5c'),
           'highlight': hexc('#ffc4a8'), 'shadow': hexc('#b8322a')}
    cr = Creature(pal)
    set_ellipse(cr.body_grid, 16, 21, 9, 9)
    set_ellipse(cr.body_grid, 16, 10, 6.5, 6)
    set_rect(cr.body_grid, 12, 13, 18, 19)
    set_rect(cr.body_grid, 9, 13, 13, 19)
    cr.highlight_rule = lambda r, c: 6 <= r <= 10 and 8 <= c <= 11
    cr.shadow_rule = lambda r, c: r >= 25 and c >= 22
    wing_l = [(r, c) for r in range(12, 26) for c in range(0, 12) if c <= (26 - r) and (r - 12) <= 14]
    wing_r = [(r, 32 - 1 - c) for (r, c) in wing_l]
    cr.add_overlay(wing_l, hexc('#7a1f1a'))
    cr.add_overlay(wing_r, hexc('#7a1f1a'))
    cr.add_overlay([(r, 4 + ((r - 24) // 2)) for r in range(24, 31)], pal['body'])
    cr.add_overlay([(30, 8), (29, 9), (29, 10)], pal['shadow'])
    for c in (11, 16, 21):
        h = 4 if c == 16 else 3
        cells = [(6 - i, c + (i if c < 16 else (-i if c > 16 else 0))) for i in range(h)]
        cr.add_overlay(cells, hexc('#ffd54a'))
    cr.eye_clusters = [
        {'row': 11, 'left_col': 12, 'right_col': 12, 'pupil': hexc('#ffd54a')},
        {'row': 11, 'left_col': 20, 'right_col': 20, 'pupil': hexc('#ffd54a')},
    ]
    cr.mouth_cells_open = [(15, c) for c in range(13, 19)]
    cr.mouth_cells_closed = [(15, c) for c in range(13, 19)]
    return cr.sheet()


def make_demon():
    pal = {'outline': hexc('#0d0505'), 'body': hexc('#b8322a'),
           'highlight': hexc('#e0685c'), 'shadow': hexc('#5c1414')}
    cr = Creature(pal)
    set_ellipse(cr.body_grid, 16, 10, 6.5, 6.5)
    set_ellipse(cr.body_grid, 16, 23, 9.5, 9)
    set_rect(cr.body_grid, 16, 9, 24, 23)
    cr.highlight_rule = lambda r, c: 5 <= r <= 9 and 11 <= c <= 14
    cr.shadow_rule = lambda r, c: r >= 19 and c >= 21
    cr.add_overlay([(2, 9), (3, 9), (3, 10), (4, 10)], hexc('#2b2b2b'))
    cr.add_overlay([(2, 22), (3, 22), (3, 21), (4, 21)], hexc('#2b2b2b'))
    wing_l = [(r, c) for r in range(14, 27) for c in range(0, 9) if c <= (9 - abs(r - 19) * 0.6)]
    wing_r = [(r, 32 - 1 - c) for (r, c) in wing_l]
    cr.add_overlay(wing_l, hexc('#3a0a0a'))
    cr.add_overlay(wing_r, hexc('#3a0a0a'))
    cr.eye_clusters = [
        {'row': 9, 'left_col': 12, 'right_col': 12, 'pupil': hexc('#ffd54a')},
        {'row': 9, 'left_col': 20, 'right_col': 20, 'pupil': hexc('#ffd54a')},
    ]
    cr.mouth_cells_open = [(13, c) for c in range(13, 20)]
    cr.mouth_cells_closed = [(13, c) for c in range(13, 20)]
    return cr.sheet()


MONSTERS = {
    # Mapa 1: Pântano dos Slimes (ciclos 1-3)
    'slime': make_slime_green,
    'slime_blue': make_slime_blue,
    'slime_green_warrior': make_slime_green_warrior,
    'slime_red': make_slime_red,
    'slime_blue_barbarian': make_slime_blue_barbarian,
    'slime_red_king': make_slime_red_king,
    # Mapa 2: Reino Goblin (ciclos 4-6)
    'goblin_green': make_goblin_green,
    'goblin_red': make_goblin_red,
    'goblin_mage': make_goblin_mage,
    'goblin_warrior': make_goblin_warrior,
    'goblin_priest': make_goblin_priest,
    'goblin_master': make_goblin_master,
    'goblin_greater': make_goblin_greater,
    # Mapa 3: Terras Selvagens (ciclo 7 em diante)
    'orc': make_orc,
    'troll': make_troll,
    'dragon': make_dragon,
    'demon': make_demon,
}

if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    for key, fn in MONSTERS.items():
        out_path = os.path.join(OUT_DIR, f'{key}.png')
        fn().save(out_path)
        print('saved', out_path)
