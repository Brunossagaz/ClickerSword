"""
gen_building_icons.py
Ícones pixel art dos prédios da Cidade (assets/icons/ferreiro.png, guilda.png,
caverna.png, loja.png, igreja.png, dungeon.png, inventario.png, academia.png).

Silhuetas bem mais simples e ousadas que um retrato/sprite normal — um ícone
de prédio aparece pequeno (48-56px na tela), então poucos detalhes grandes
leem melhor que muito detalhe fino. Por isso a grade aqui é mais grosseira
(24x24) que a dos sprites/retratos (32x32).

NÃO mexe nos outros ícones (gear/trophy/lock/gold/essence/boss/golden-monster/
item-*/weapon-*) — esses não foram os que o jogador reportou como difíceis de
entender, só os 8 prédios.

Faz backup dos 8 PNGs anteriores (os desenhados à mão) em
assets/icons/handdrawn_backup/ antes de sobrescrever, caso o jogador queira
comparar ou recuperar.

Como usar:
  python tools/gen_building_icons.py

Requer Pillow (pip install pillow).
"""
import os
import shutil
from PIL import Image

GRID = 24
PIXEL = 4
FRAME = GRID * PIXEL

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')
BACKUP_DIR = os.path.join(OUT_DIR, 'handdrawn_backup')


def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def new_grid():
    return [[False] * GRID for _ in range(GRID)]


def set_rect(grid, r0, c0, r1, c1):
    for r in range(max(0, r0), min(GRID, r1)):
        for c in range(max(0, c0), min(GRID, c1)):
            grid[r][c] = True


def set_ellipse(grid, cx, cy, rx, ry):
    for r in range(GRID):
        for c in range(GRID):
            dx = (c + 0.5 - cx) / rx
            dy = (r + 0.5 - cy) / ry
            if dx * dx + dy * dy <= 1.0:
                grid[r][c] = True


def set_diag(grid, r0, c0, r1, c1, thickness=1):
    """Linha diagonal grossa (degraus, estilo pixel art de propósito — sem
    antialiasing) entre dois pontos da grade."""
    steps = max(abs(r1 - r0), abs(c1 - c0)) * 2
    for i in range(steps + 1):
        t = i / steps
        r = round(r0 + (r1 - r0) * t)
        c = round(c0 + (c1 - c0) * t)
        for dr in range(-thickness, thickness + 1):
            for dc in range(-thickness, thickness + 1):
                rr, cc = r + dr, c + dc
                if 0 <= rr < GRID and 0 <= cc < GRID:
                    grid[rr][cc] = True


def is_in(grid, r, c):
    return 0 <= r < GRID and 0 <= c < GRID and grid[r][c]


def put(px, r, c, color):
    for yy in range(PIXEL):
        for xx in range(PIXEL):
            px[c * PIXEL + xx, r * PIXEL + yy] = color


def cells_in(grid, r0, c0, r1, c1):
    return [(r, c) for r in range(max(0, r0), min(GRID, r1))
            for c in range(max(0, c0), min(GRID, c1)) if grid[r][c]]


def ellipse_cells(cx, cy, rx, ry):
    g = new_grid()
    set_ellipse(g, cx, cy, rx, ry)
    return [(r, c) for r in range(GRID) for c in range(GRID) if g[r][c]]


class Icon:
    """Silhueta com contorno automático (mesmo motor de gen_sprites.py/
    gen_portraits.py) + camadas de cor sólida por cima (sem contorno próprio
    — usadas pra detalhes internos: janelas, portas, brasa, etc.)."""

    def __init__(self, body_color, outline_color=None):
        self.grid = new_grid()
        self.body_color = body_color
        self.outline_color = outline_color or hexc('#1a1208')
        self.overlays = []  # [(cells, color)]

    def overlay(self, cells, color):
        self.overlays.append((cells, color))

    def render(self):
        img = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
        px = img.load()
        g = self.grid
        for r in range(GRID):
            for c in range(GRID):
                if not g[r][c]:
                    continue
                edge = not (is_in(g, r - 1, c) and is_in(g, r + 1, c) and
                            is_in(g, r, c - 1) and is_in(g, r, c + 1))
                put(px, r, c, self.outline_color if edge else self.body_color)
        for cells, color in self.overlays:
            for (r, c) in cells:
                put(px, r, c, color)
        return img


# ---------------------------------------------------------------------
# Ferreiro — bigorna clássica (topo largo e reto, cintura estreita, base
# alargada com 2 pés) + brilho quente no topo. Sem "chifre" separado — só
# atrapalhava a silhueta em tamanho pequeno (virava outra coisa qualquer).
# ---------------------------------------------------------------------
def make_ferreiro():
    ic = Icon(hexc('#8a8a94'))
    g = ic.grid
    set_rect(g, 7, 3, 10, 21)
    set_rect(g, 10, 8, 13, 16)
    set_rect(g, 13, 4, 18, 20)
    set_rect(g, 18, 6, 21, 9)
    set_rect(g, 18, 15, 21, 18)
    ic.overlay(cells_in(g, 7, 14, 9, 19), hexc('#e8974a'))
    return ic.render()


# ---------------------------------------------------------------------
# Guilda — escudo (afunilado em degraus, topo reto) com faixa central clara.
# ---------------------------------------------------------------------
def make_guilda():
    ic = Icon(hexc('#4a6fa5'))
    g = ic.grid
    set_rect(g, 3, 5, 7, 19)
    set_rect(g, 7, 4, 12, 20)
    set_rect(g, 12, 5, 16, 19)
    set_rect(g, 16, 7, 19, 17)
    set_rect(g, 19, 9, 21, 15)
    set_rect(g, 21, 11, 22, 13)
    ic.overlay(cells_in(g, 8, 10, 17, 14), hexc('#dfe6ef'))
    return ic.render()


# ---------------------------------------------------------------------
# Caverna — montanha em degraus com entrada escura e um veio de minério.
# ---------------------------------------------------------------------
def make_caverna():
    ic = Icon(hexc('#6b6b76'))
    g = ic.grid
    set_rect(g, 16, 2, 20, 22)
    set_rect(g, 13, 4, 20, 20)
    set_rect(g, 10, 7, 20, 17)
    set_rect(g, 7, 10, 20, 14)
    ic.overlay(cells_in(g, 8, 11, 10, 13), hexc('#8fd9c4'))
    ic.overlay(cells_in(g, 14, 9, 20, 15), hexc('#241a14'))
    return ic.render()


# ---------------------------------------------------------------------
# Loja — fachada com toldo listrado, 2 janelas e porta.
# ---------------------------------------------------------------------
def make_loja():
    ic = Icon(hexc('#c9a13f'))
    g = ic.grid
    set_rect(g, 8, 3, 20, 21)
    set_rect(g, 4, 2, 9, 22)
    for i, c in enumerate(range(2, 22, 4)):
        ic.overlay(cells_in(g, 4, c, 9, c + 2), hexc('#8a3a3a') if i % 2 == 0 else hexc('#e8e0d0'))
    ic.overlay(cells_in(g, 13, 9, 20, 15), hexc('#5c3a1c'))
    ic.overlay(cells_in(g, 10, 5, 12, 8), hexc('#dfe6ef'))
    ic.overlay(cells_in(g, 10, 16, 12, 19), hexc('#dfe6ef'))
    return ic.render()


# ---------------------------------------------------------------------
# Igreja — capela com telhado em degraus, cruz no topo, porta e 2 janelas.
# ---------------------------------------------------------------------
def make_igreja():
    ic = Icon(hexc('#6a4fb0'))
    g = ic.grid
    set_rect(g, 11, 4, 21, 20)
    set_rect(g, 9, 6, 11, 18)
    set_rect(g, 7, 8, 9, 16)
    set_rect(g, 5, 10, 7, 14)
    set_rect(g, 2, 11, 5, 13)
    set_rect(g, 3, 10, 4, 14)
    ic.overlay(cells_in(g, 14, 10, 21, 14), hexc('#3a2a5c'))
    ic.overlay(cells_in(g, 11, 7, 14, 9), hexc('#dfe6ef'))
    ic.overlay(cells_in(g, 11, 15, 14, 17), hexc('#dfe6ef'))
    return ic.render()


# ---------------------------------------------------------------------
# Dungeon — portal em arco de pedra com vão escuro.
# ---------------------------------------------------------------------
def make_dungeon():
    ic = Icon(hexc('#6b6b76'))
    g = ic.grid
    set_ellipse(g, 12, 11, 8, 9)
    set_rect(g, 11, 3, 21, 21)
    inner = new_grid()
    set_ellipse(inner, 12, 12, 5, 6)
    set_rect(inner, 12, 6, 21, 18)
    dark_cells = [(r, c) for (r, c) in cells_in(g, 0, 0, GRID, GRID) if inner[r][c]]
    ic.overlay(dark_cells, hexc('#1a1420'))
    return ic.render()


# ---------------------------------------------------------------------
# Inventário — mochila com topo arredondado, aba e bolso frontal.
# ---------------------------------------------------------------------
def make_inventario():
    ic = Icon(hexc('#c9a13f'))
    g = ic.grid
    set_ellipse(g, 12, 8, 6, 4)
    set_rect(g, 8, 5, 20, 19)
    set_rect(g, 4, 9, 8, 15)
    ic.overlay(cells_in(g, 12, 8, 17, 16), hexc('#8a6a2e'))
    ic.overlay(cells_in(g, 14, 11, 15, 13), hexc('#5c4318'))
    return ic.render()


# ---------------------------------------------------------------------
# Academia — espadas cruzadas (X), guardas e cabos nas pontas inferiores.
# ---------------------------------------------------------------------
def make_academia():
    ic = Icon(hexc('#c94f3f'))
    g = ic.grid
    set_diag(g, 4, 4, 20, 20, thickness=1)
    set_diag(g, 4, 20, 20, 4, thickness=1)
    set_rect(g, 18, 3, 22, 7)
    set_rect(g, 18, 17, 22, 21)
    ic.overlay(cells_in(g, 2, 2, 6, 6), hexc('#dfe6ef'))
    ic.overlay(cells_in(g, 2, 18, 6, 22), hexc('#dfe6ef'))
    return ic.render()


ICONS = {
    'ferreiro': make_ferreiro,
    'guilda': make_guilda,
    'caverna': make_caverna,
    'loja': make_loja,
    'igreja': make_igreja,
    'dungeon': make_dungeon,
    'inventario': make_inventario,
    'academia': make_academia,
}

if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(BACKUP_DIR, exist_ok=True)
    for key in ICONS:
        old_path = os.path.join(OUT_DIR, f'{key}.png')
        if os.path.exists(old_path):
            backup_path = os.path.join(BACKUP_DIR, f'{key}.png')
            if not os.path.exists(backup_path):
                shutil.copy2(old_path, backup_path)
    for key, fn in ICONS.items():
        out_path = os.path.join(OUT_DIR, f'{key}.png')
        fn().save(out_path)
        print('saved', out_path)
