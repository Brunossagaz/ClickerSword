"""
gen_portraits.py
Gerador de retratos pixel art (PNG) para personagens que falam em diálogos
(NPCs da cidade — Clérigo, Barnabé — e, futuramente, monstros também).

Cada retrato é um ÚNICO frame de 128x128 (diferente do spritesheet de 3
frames dos monstros em gen_sprites.py) — diálogo é estático, sem piscar —
salvo em assets/portraits/<key>.png. Usa o mesmo motor de silhueta (grade
32x32 + contorno automático) de gen_sprites.py.

`_TEMPLATE_128x128.png` não é arte final: é só uma referência de tamanho/
enquadramento (borda da tela + guia pontilhado da "zona de rosto") pra abrir
num editor de pixel art externo e desenhar um retrato novo do zero.

Retratos de monstro: não precisam de um template novo — o frame 1 (idle) do
spritesheet que já existe em assets/sprites/<monstro>.png já é 128x128 e
serve como retrato (mesmo motor, mesmo tamanho). Só recorte/referencie esse
1º frame se quiser um monstro "falando" num diálogo.

Como usar:
  python tools/gen_portraits.py

Requer Pillow (pip install pillow).
"""
import os
from PIL import Image

GRID = 32
PIXEL = 4
FRAME = GRID * PIXEL
WHITE = (255, 255, 255, 255)

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'portraits')


def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


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


def cells_in(grid, r0, c0, r1, c1):
    """Células de um retângulo, recortadas pra só as que já fazem parte da
    silhueta (evita pixel "flutuando" fora do contorno do personagem)."""
    return [(r, c) for r in range(max(0, r0), min(GRID, r1))
            for c in range(max(0, c0), min(GRID, c1)) if grid[r][c]]


def ellipse_cells(cx, cy, rx, ry):
    g = new_grid()
    set_ellipse(g, cx, cy, rx, ry)
    return [(r, c) for r in range(GRID) for c in range(GRID) if g[r][c]]


class Portrait:
    """Busto pixel art (só cabeça/ombros) — mesmo motor de silhueta dos
    monstros (Creature em gen_sprites.py), num único frame estático."""

    def __init__(self, palette):
        self.pal = palette
        self.body_grid = new_grid()
        self.overlay_cells = []  # [(cells, color)] — aplicados em ordem
        self.eye_clusters = []
        self.mouth_cells = []

    def add_overlay(self, cells, color):
        self.overlay_cells.append((cells, color))

    def render(self):
        img = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
        px = img.load()
        grid = self.body_grid
        for r in range(GRID):
            for c in range(GRID):
                if not grid[r][c]:
                    continue
                is_edge = not (is_in(grid, r - 1, c) and is_in(grid, r + 1, c) and
                               is_in(grid, r, c - 1) and is_in(grid, r, c + 1))
                put(px, r, c, self.pal['outline'] if is_edge else self.pal['body'])

        for cells, color in self.overlay_cells:
            put_region(px, cells, color)

        for e in self.eye_clusters:
            row, lc, rc, pupil = e['row'], e['left_col'], e['right_col'], e['pupil']
            for cc in (lc - 1, lc, lc + 1):
                put(px, row, cc, pupil)
            for cc in (rc - 1, rc, rc + 1):
                put(px, row, cc, pupil)
            put(px, row - 1, lc - 1, WHITE)
            put(px, row - 1, rc - 1, WHITE)

        put_region(px, self.mouth_cells, self.pal['outline'])
        return img


# ---------------------------------------------------------------------
# TEMPLATE em branco — só a borda da tela (128x128) + guia pontilhado da
# "zona de rosto" sugerida. Abra num editor de pixel art e desenhe por cima.
# ---------------------------------------------------------------------
def make_template():
    img = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
    px = img.load()
    border = hexc('#e8974a', 160)
    guide = hexc('#4fd1c5', 90)
    for c in range(GRID):
        put(px, 0, c, border)
        put(px, GRID - 1, c, border)
    for r in range(GRID):
        put(px, r, 0, border)
        put(px, r, GRID - 1, border)
    for c in range(9, 23, 2):
        put(px, 8, c, guide)
        put(px, 21, c, guide)
    for r in range(8, 22, 2):
        put(px, r, 9, guide)
        put(px, r, 22, guide)
    return img


# ---------------------------------------------------------------------
# Irmão Anselmo (Clérigo da Igreja) — capuz + túnica, expressão serena.
# ---------------------------------------------------------------------
def make_cleric():
    pal = {'outline': hexc('#2a1608'), 'body': hexc('#8a3a3a'),
           'highlight': hexc('#c96a5c'), 'shadow': hexc('#5c2323')}
    p = Portrait(pal)
    set_ellipse(p.body_grid, 16, 10, 10, 10)   # capuz
    set_ellipse(p.body_grid, 16, 25, 12, 9)    # túnica
    set_rect(p.body_grid, 16, 5, 32, 27)       # preenche o pescoço entre os dois

    face = [(r, c) for (r, c) in ellipse_cells(16, 13, 6, 7) if p.body_grid[r][c]]
    p.add_overlay(face, hexc('#e0b48a'))
    p.add_overlay(cells_in(p.body_grid, 19, 12, 23, 20), hexc('#e8e0d0'))   # barba branca
    p.add_overlay(cells_in(p.body_grid, 19, 11, 20, 21), hexc('#d4af37'))  # gola dourada da túnica

    p.eye_clusters = [
        {'row': 12, 'left_col': 13, 'right_col': 13, 'pupil': hexc('#3a2a1a')},
        {'row': 12, 'left_col': 19, 'right_col': 19, 'pupil': hexc('#3a2a1a')},
    ]
    p.mouth_cells = [(17, 14), (18, 15), (18, 16), (17, 17)]
    return p.render()


# ---------------------------------------------------------------------
# Barnabé (dono da Loja) — careca, bigode, avental de mercador.
# ---------------------------------------------------------------------
def make_barnabe():
    pal = {'outline': hexc('#5c4318'), 'body': hexc('#e0b48a'),
           'highlight': hexc('#f0d4b0'), 'shadow': hexc('#b88a5c')}
    p = Portrait(pal)
    set_ellipse(p.body_grid, 16, 13, 9, 9)     # cabeça (careca)
    set_ellipse(p.body_grid, 16, 26, 11, 8)    # corpo
    set_rect(p.body_grid, 16, 5, 32, 27)

    p.add_overlay(cells_in(p.body_grid, 18, 5, 32, 27), hexc('#c9a13f'))    # camisa
    p.add_overlay(cells_in(p.body_grid, 21, 8, 32, 24), hexc('#8a6a2e'))    # avental
    p.add_overlay(cells_in(p.body_grid, 21, 8, 22, 24), hexc('#5c4318'))   # barra do avental
    p.add_overlay(cells_in(p.body_grid, 17, 11, 18, 17), hexc('#5c4a2a'))  # bigode

    p.eye_clusters = [
        {'row': 11, 'left_col': 11, 'right_col': 11, 'pupil': hexc('#2a1a0a')},
        {'row': 11, 'left_col': 18, 'right_col': 18, 'pupil': hexc('#2a1a0a')},
    ]
    p.mouth_cells = [(19, c) for c in range(12, 17)]
    return p.render()


PORTRAITS = {
    '_TEMPLATE_128x128': make_template,
    'cleric': make_cleric,
    'barnabe': make_barnabe,
}

if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    for key, fn in PORTRAITS.items():
        out_path = os.path.join(OUT_DIR, f'{key}.png')
        fn().save(out_path)
        print('saved', out_path)
