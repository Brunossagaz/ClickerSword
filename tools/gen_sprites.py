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
import math
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
# SLIME — silhueta "blob" por função de meia-largura por linha (mesma forma
# do slime original slime.js, agora congelada em PNG). Reaproveitada para o
# Slime normal (verde) e o Slime Azul (mais forte, com cristais de gelo).
# ---------------------------------------------------------------------
def slime_half_width(r):
    top, bottom_start = 7, 25
    if r <= top:
        k = (top - r) / top
        return math.sqrt(max(0, 1 - k * k)) * 13
    if r >= bottom_start:
        k2 = (r - bottom_start) / 6
        return 13 - k2 * 4
    return 13


SLIME_INSIDE = []
for r in range(GRID):
    hw = slime_half_width(r)
    SLIME_INSIDE.append([abs((c + 0.5) - GRID / 2) <= hw for c in range(GRID)])


def slime_is_inside(r, c):
    return 0 <= r < GRID and 0 <= c < GRID and SLIME_INSIDE[r][c]


def render_slime(palette, spikes=False, fierce_mouth=False):
    def frame(eyes_closed=False, flash_white=False):
        img = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
        px = img.load()
        for r in range(GRID):
            for c in range(GRID):
                if not SLIME_INSIDE[r][c]:
                    continue
                is_edge = not (slime_is_inside(r - 1, c) and slime_is_inside(r + 1, c) and
                               slime_is_inside(r, c - 1) and slime_is_inside(r, c + 1))
                dx = (c + 0.5) - GRID / 2
                color = palette['outline'] if is_edge else palette['body']
                if not is_edge and 3 <= r <= 10 and -11 < dx < -3:
                    color = palette['highlight']
                if not is_edge and r >= 17 and dx > 4:
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

        if flash_white:
            return img

        if eyes_closed:
            for cols in ((9, 10, 11), (19, 20, 21)):
                for cc in cols:
                    put(px, 13, cc, palette['outline'])
        else:
            for ri, rr in enumerate((12, 13, 14)):
                for ci, (lc, rc) in enumerate(zip((9, 10, 11), (19, 20, 21))):
                    color = WHITE if (ri == 0 and ci == 0) else palette['pupil']
                    put(px, rr, lc, color)
                    put(px, rr, rc, color)

        if fierce_mouth:
            for cc in (14, 15, 16, 17):
                put(px, 19, cc, palette['outline'])
            for cc in (14, 17):
                put(px, 20, cc, WHITE)
        else:
            for cc, rr in ((14, 19), (17, 19)):
                put(px, rr, cc, palette['outline'])
            for cc, rr in ((15, 20), (16, 20)):
                put(px, rr, cc, palette['outline'])
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


def make_goblin():
    pal = {'outline': hexc('#122b0d'), 'body': hexc('#8FBF5B'),
           'highlight': hexc('#c8f0a0'), 'shadow': hexc('#5C8A3A')}
    cr = Creature(pal)
    set_ellipse(cr.body_grid, 16, 11, 7.5, 7)
    set_ellipse(cr.body_grid, 16, 24, 7, 7)
    set_rect(cr.body_grid, 16, 9, 25, 23)
    cr.highlight_rule = lambda r, c: 5 <= r <= 10 and 10 <= c <= 13
    cr.shadow_rule = lambda r, c: r >= 20 and c >= 20
    ear_l = [(r, c) for r in range(6, 13) for c in range(4, 10) if 0 <= (c - 4) <= (12 - r) * 0.9]
    ear_r = [(r, 32 - 1 - c) for (r, c) in ear_l]
    cr.add_overlay(ear_l, pal['body'])
    cr.add_overlay(ear_r, pal['body'])
    cr.add_overlay([(r, 3) for r in range(7, 12)] + [(6, 4), (12, 4)], pal['outline'])
    cr.add_overlay([(r, 28) for r in range(7, 12)] + [(6, 27), (12, 27)], pal['outline'])
    cr.add_overlay([(16, 15), (17, 15)], WHITE)
    cr.eye_clusters = [
        {'row': 10, 'left_col': 12, 'right_col': 12, 'pupil': hexc('#111111')},
        {'row': 10, 'left_col': 20, 'right_col': 20, 'pupil': hexc('#111111')},
    ]
    cr.mouth_cells_open = [(13, 14), (14, 13), (14, 14), (14, 15), (14, 16), (13, 17)]
    cr.mouth_cells_closed = [(13, 13), (13, 14), (13, 17), (13, 18)]
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
    'slime': make_slime_green,
    'slime_blue': make_slime_blue,
    'goblin': make_goblin,
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
