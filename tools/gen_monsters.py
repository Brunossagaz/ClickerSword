"""
gen_monsters.py
Gerador dos sprites pixel art 64x64 dos monstros (tudo menos os slimes, que
continuam vindo de gen_sprites.py).

Cada monstro é montado com partes "3D" simples — elipsoides, cápsulas
afuniladas (membros, caudas, cabos) e polígonos com bisel (armas, roupas,
asas) — e sombreado em faixas com luz de cima/esquerda. Contorno externo
automático + linha interna na parte de trás quando duas partes de grupos
diferentes se encostam. Pose frontal: a maioria é desenhada pela
metade esquerda e espelhada (Monster.sym). O Lagarto de Fogo é o único de
perfil — quadrúpede baixo de frente vira uma bolha difícil de ler.

Saída: assets/sprites/<arquivo>.png, spritesheet horizontal de 3 quadros de
128x128 (arte 64x64 ampliada 2x): [ parado | piscando | flash de dano ].

Como usar:
  python tools/gen_monsters.py            # gera todos
  python tools/gen_monsters.py orc troll  # só esses
"""
import math
import os
import sys
from PIL import Image

N = 64
UP = 2
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites')
OUTLINE = '#1A161E'
_l = (-0.5, -0.65, 0.57)
_ln = math.sqrt(sum(v * v for v in _l))
LIGHT = tuple(v / _ln for v in _l)


def hexc(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def _hash(x, y, seed=0):
    v = (x * 374761393 + y * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    v = (v ^ (v >> 13)) * 1274126177 & 0xFFFFFFFF
    return (v ^ (v >> 16)) / 0xFFFFFFFF


# ---------------------------------------------------------------------
# Material: rampa de 5 cores [linha, sombra, base, luz, brilho] + textura
# ---------------------------------------------------------------------
class Mat:
    def __init__(self, ramp, texture=None, name=None):
        assert len(ramp) == 5
        self.ramp = ramp
        self.texture = texture
        self.name = name or ramp[2]

    def level(self, n):
        d = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]
        if d < 0.2:
            return 1
        if d < 0.72:
            return 2
        if d < 0.9:
            return 3
        return 4

    def color(self, n, x, y):
        lv = self.level(n)
        t = self.texture
        if t == 'scales' and lv >= 2 and y % 3 == 2 and (x + (y // 3) * 2) % 4 == 0:
            lv -= 1
        elif t == 'spots' and lv >= 2 and _hash(x // 2, y // 2, 7) < 0.14:
            lv -= 1
        elif t == 'bands' and lv >= 2 and y % 3 == 0:
            lv -= 1
        elif t == 'wood' and lv >= 2 and _hash(x, y // 3, 3) < 0.18:
            lv -= 1
        elif t == 'fur' and lv >= 2 and (x + y) % 3 == 0 and _hash(x, y, 5) < 0.5:
            lv -= 1
        return self.ramp[lv]


def M(*ramp, texture=None):
    return Mat(list(ramp), texture)


# ---------------------------------------------------------------------
# Formas: cada uma devolve a normal (nx, ny, nz) do ponto ou None
# ---------------------------------------------------------------------
def ellipse(cx, cy, rx, ry, flat=0.0):
    def f(x, y):
        dx, dy = (x - cx) / rx, (y - cy) / ry
        d2 = dx * dx + dy * dy
        if d2 >= 1:
            return None
        k = 1 - flat
        return (dx * k, dy * k, math.sqrt(max(0.0, 1 - d2 * k * k)))
    return f


def capsule(x1, y1, x2, y2, r1, r2=None):
    r2 = r1 if r2 is None else r2
    vx, vy = x2 - x1, y2 - y1
    L2 = vx * vx + vy * vy or 1e-6

    def f(x, y):
        t = max(0.0, min(1.0, ((x - x1) * vx + (y - y1) * vy) / L2))
        px, py = x1 + vx * t, y1 + vy * t
        r = r1 + (r2 - r1) * t
        ox, oy = x - px, y - py
        d = math.hypot(ox, oy)
        if d >= r:
            return None
        return (ox / r, oy / r, math.sqrt(max(0.0, 1 - (d / r) ** 2)))
    return f


def chain(points, radii):
    """Cápsulas encadeadas (cauda, pescoço, chifre curvo)."""
    segs = [capsule(*points[i], *points[i + 1], radii[i], radii[i + 1]) for i in range(len(points) - 1)]

    def f(x, y):
        best = None
        for s in segs:
            n = s(x, y)
            if n and (best is None or n[2] < best[2] or True):
                if best is None or n[2] > best[2]:
                    best = n
        return best
    return f


def polygon(pts, bevel=1.4, tilt=(0.0, 0.0)):
    edges = [(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]

    def inside(x, y):
        c = False
        for (ax, ay), (bx, by) in edges:
            if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
                c = not c
        return c

    def f(x, y):
        if not inside(x, y):
            return None
        best, bn = 1e9, (0, 0)
        for (ax, ay), (bx, by) in edges:
            vx, vy = bx - ax, by - ay
            l2 = vx * vx + vy * vy or 1e-6
            t = max(0, min(1, ((x - ax) * vx + (y - ay) * vy) / l2))
            px, py = ax + vx * t, ay + vy * t
            d = math.hypot(x - px, y - py)
            if d < best:
                best = d
                ln = math.sqrt(l2)
                bn = (vy / ln, -vx / ln)
        nx, ny = tilt
        if best < bevel:
            # normal inclinada pra fora na borda (lado certo decidido pelo centro)
            cx = sum(p[0] for p in pts) / len(pts)
            cy = sum(p[1] for p in pts) / len(pts)
            if bn[0] * (x - cx) + bn[1] * (y - cy) < 0:
                bn = (-bn[0], -bn[1])
            nx, ny = nx + bn[0] * 0.75, ny + bn[1] * 0.75
        nz = math.sqrt(max(0.05, 1 - nx * nx - ny * ny))
        return (nx, ny, nz)
    return f


def _mirrored(f):
    def g(x, y):
        n = f(N - x, y)
        return None if n is None else (-n[0], n[1], n[2])
    return g


# ---------------------------------------------------------------------
# Monstro
# ---------------------------------------------------------------------
class Monster:
    def __init__(self):
        self.parts = []      # (shape, mat, group)
        self.details = {}    # (x, y) -> cor (por cima de tudo, sem sombra)
        self.eyes = []       # pixels que viram pálpebra no quadro "piscando"
        self.lid = None

    def add(self, shape, mat, group=None, before=None):
        """before = nome de um grupo já adicionado: a peça entra ATRÁS dele
        (ex.: manto por baixo do braço da frente)."""
        part = (shape, mat, group if group is not None else mat.name)
        if before is None:
            self.parts.append(part)
        else:
            i = next(i for i, p in enumerate(self.parts) if p[2] == before)
            self.parts.insert(i, part)
        return self

    def ell(self, cx, cy, rx, ry, mat, group=None, flat=0.0, before=None):
        return self.add(ellipse(cx, cy, rx, ry, flat), mat, group, before)

    def cap(self, x1, y1, x2, y2, r1, r2, mat, group=None, before=None):
        return self.add(capsule(x1, y1, x2, y2, r1, r2), mat, group, before)

    def chain(self, pts, radii, mat, group=None, before=None):
        return self.add(chain(pts, radii), mat, group, before)

    def poly(self, pts, mat, group=None, bevel=1.4, tilt=(0, 0), before=None):
        return self.add(polygon(pts, bevel, tilt), mat, group, before)

    def px(self, pts, color):
        for p in pts:
            self.details[(int(p[0]), int(p[1]))] = color

    def eye(self, x, y, w, h, white, pupil, lid, pupil_at=None, glow=False):
        """Olho retangular pequeno: esclera + pupila; entra na lista de
        piscar. pupil_at = coluna da pupila (padrão: lado esquerdo, olhando
        pro jogador)."""
        pts = [(x + i, y + j) for j in range(h) for i in range(w)]
        self.px(pts, white)
        px_ = x if pupil_at is None else pupil_at
        if pupil:
            self.px([(px_, y + j) for j in range(h)], pupil)
        if glow:
            self.px([(x, y)], glow)
        self.eyes += pts
        self.lid = lid

    # ----- simetria (pose frontal) -----
    def sym(self, draw):
        """Roda draw() (que desenha só a metade ESQUERDA) e espelha em x=32
        tudo que ela adicionou. Mesmo grupo nos dois lados = sem linha
        interna onde as metades se encostam."""
        start = len(self.parts)
        draw()
        for shape, mat, grp in list(self.parts[start:]):
            self.parts.append((_mirrored(shape), mat, grp))

    def pxs(self, pts, color):
        """Pixels de detalhe + o espelho deles."""
        pts = [(int(x), int(y)) for x, y in pts]
        self.px(pts, color)
        self.px([(N - 1 - x, y) for x, y in pts], color)

    def eyes_sym(self, x, y, w, h, white, pupil, lid, glow=None):
        """Par de olhos: esquerdo começa em x; pupila no canto de dentro
        (olhando pra frente), brilho no canto de cima/esquerda dos dois."""
        xr = N - 1 - (x + w - 1)
        self.eye(x, y, w, h, white, pupil, lid, pupil_at=x + w - 1, glow=glow)
        self.eye(xr, y, w, h, white, pupil, lid, pupil_at=xr, glow=glow)

    # ----- render -----
    def render(self, blink=False):
        owner = [[None] * N for _ in range(N)]
        normal = [[None] * N for _ in range(N)]
        for idx, (shape, mat, grp) in enumerate(self.parts):
            for y in range(N):
                for x in range(N):
                    n = shape(x + .5, y + .5)
                    if n:
                        owner[y][x] = idx
                        normal[y][x] = n
        img = [[None] * N for _ in range(N)]
        for y in range(N):
            for x in range(N):
                o = owner[y][x]
                if o is None:
                    continue
                shape, mat, grp = self.parts[o]
                c = mat.color(normal[y][x], x, y)
                # linha interna: esta parte encosta numa parte (de outro
                # grupo) que está NA FRENTE dela
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx_, ny_ = x + dx, y + dy
                    if 0 <= nx_ < N and 0 <= ny_ < N:
                        o2 = owner[ny_][nx_]
                        if o2 is not None and o2 > o and self.parts[o2][2] != grp:
                            c = mat.ramp[0]
                            break
                img[y][x] = c
        for (x, y), c in self.details.items():
            if 0 <= x < N and 0 <= y < N:
                img[y][x] = c
        if blink and self.lid:
            eyeset = set(self.eyes)
            for (x, y) in self.eyes:
                below = (x, y + 1) not in eyeset
                img[y][x] = OUTLINE if below else self.lid
        # contorno externo
        out = [row[:] for row in img]
        for y in range(N):
            for x in range(N):
                if img[y][x] is not None:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx_, ny_ = x + dx, y + dy
                    if 0 <= nx_ < N and 0 <= ny_ < N and img[ny_][nx_] is not None:
                        out[y][x] = OUTLINE
                        break
        return out

    def sheet(self):
        frames = [self.render(), self.render(blink=True)]
        flash = [[('#FFFFFF' if c else None) for c in row] for row in frames[0]]
        frames.append(flash)
        im = Image.new('RGBA', (N * 3, N), (0, 0, 0, 0))
        for f, g in enumerate(frames):
            for y in range(N):
                for x in range(N):
                    if g[y][x]:
                        im.putpixel((f * N + x, y), hexc(g[y][x]))
        return im.resize((N * 3 * UP, N * UP), Image.NEAREST)


# ---------------------------------------------------------------------
# Paletas
# ---------------------------------------------------------------------
IRON = M('#1E1C24', '#46444E', '#6E6C78', '#9E9CA8', '#D0CED8')
STEEL = M('#1E2028', '#56606C', '#8A96A4', '#BCC6D0', '#EEF2F6')
GOLD = M('#3A2408', '#9A6A12', '#D8A42A', '#F4CE5A', '#FFF0A8')
WOOD = M('#24140A', '#5A361C', '#80522C', '#A87444', '#C8965E', texture='wood')
LEATHER = M('#1E120A', '#4A2C18', '#6A4226', '#8C5C36', '#A87448')
BONE = M('#3A3226', '#9A8C70', '#CCBE9C', '#E8DCC0', '#FFF8E8')
DARKLEATHER = M('#140C0A', '#2E2018', '#443024', '#5E4434', '#7A5A44')
WHITE_TEETH = '#F4ECD8'
EYE_Y = '#FFD54A'
EYE_R = '#FF4A3A'
PUPIL = '#1A161E'

# ---------------------------------------------------------------------
# Goblins (base frontal + variações)
# ---------------------------------------------------------------------
def goblin(skin, *, s=1.0, cloth=None, eye=EYE_Y, fangs=False):
    """Goblin base de frente. s = escala a partir dos pés (y=61). Devolve
    (monster, T, R): T(x, y) e R(r) aplicam a escala, pra quem monta
    acessórios por cima. Mãos: esquerda em T(20.5, 47.5), direita no
    espelho, T(43.5, 47.5)."""
    m = Monster()
    T = lambda x, y: (32 + (x - 32) * s, 61 - (61 - y) * s)
    R = lambda r: r * s

    def ell(cx, cy, rx, ry, mat, **k):
        m.ell(*T(cx, cy), R(rx), R(ry), mat, **k)

    def cap(x1, y1, x2, y2, r1, r2, mat, **k):
        m.cap(*T(x1, y1), *T(x2, y2), R(r1), R(r2), mat, **k)

    def poly(pts, mat, **k):
        m.poly([T(*p) for p in pts], mat, **k)

    def back():
        poly([(24, 22), (8, 14), (11, 19), (9, 20.5), (24, 29)], skin, group='ear')
        cap(28, 49, 27, 59, 3.4, 2.8, skin, group='leg')
        ell(26, 60, 4.2, 1.9, DARKLEATHER, group='foot')
    m.sym(back)
    ell(32, 42, 9.5, 9, skin, group='body')
    if cloth:
        poly([(23, 45), (41, 45), (40, 52), (35, 55), (32, 52), (29, 55), (24, 52)], cloth, group='cloth')
        poly([(23, 44), (41, 44), (41, 46.5), (23, 46.5)], LEATHER, group='belt')
    ell(32, 26, 10.5, 9.2, skin, group='head')
    ell(32, 29, 2.1, 2.5, skin, group='nose')

    def arms():
        cap(24, 36, 21, 46, 2.9, 2.5, skin, group='armL')
        ell(20.5, 47.5, 3.2, 3, skin, group='hand')
    m.sym(arms)

    def P(x, y):
        tx, ty = T(x, y)
        return round(tx), round(ty)
    ex, ey = P(25, 24)
    m.eyes_sym(ex, ey, 3, 2, eye, PUPIL, skin.ramp[1])
    bx, by = P(24, 22)
    m.pxs([(bx, by), (bx + 1, by), (bx + 2, by + 1), (bx + 3, by + 1)], skin.ramp[0])   # sobrancelha brava
    mx, my = P(28, 33)
    m.pxs([(mx, my - 1), (mx + 1, my), (mx + 2, my), (mx + 3, my)], OUTLINE)            # boca
    m.pxs([(mx + 1, my + 1)] + ([(mx + 1, my + 2)] if fangs else []), WHITE_TEETH)       # presas
    return m, T, R


GOB_GREEN = M('#16301A', '#3A6A2A', '#5E9A3A', '#86C24E', '#B8E27A')
GOB_RED = M('#301010', '#7A2A22', '#B0443A', '#D8705A', '#F4A080')
GOB_TEAL = M('#10302A', '#2E6A5A', '#4E9A7E', '#76C2A0', '#A8E2C6')
GOB_OLIVE = M('#2A2A12', '#5E6A2A', '#8A9A3E', '#AEC05A', '#D4E28A')
GOB_DARK = M('#101E12', '#284A26', '#3E6E36', '#5A904A', '#82B46A')
GOB_GREATER = M('#10240E', '#2A5220', '#447A30', '#62A044', '#8CC862', texture='spots')
HAND_L = (20.5, 47.5)
HAND_R = (43.5, 47.5)


def dagger(m, hx, hy, ang=-2.3, length=11):
    """Adaga saindo da mão (hx, hy) na direção ang (rad)."""
    ex, ey = hx + math.cos(ang) * length, hy + math.sin(ang) * length
    m.cap(hx - math.cos(ang) * 2, hy - math.sin(ang) * 2, hx + math.cos(ang) * 1.5, hy + math.sin(ang) * 1.5, 1.1, 1.1, LEATHER, group='hilt')
    px_, py_ = -math.sin(ang), math.cos(ang)
    gx, gy = hx + math.cos(ang) * 2, hy + math.sin(ang) * 2
    m.cap(gx - px_ * 2.5, gy - py_ * 2.5, gx + px_ * 2.5, gy + py_ * 2.5, 1, 1, IRON, group='guard')
    m.poly([(gx - px_ * 1.6, gy - py_ * 1.6), (ex, ey), (gx + px_ * 1.6, gy + py_ * 1.6)], STEEL, group='blade', bevel=1)


def regrip(m, skin, hand, R=lambda r: r):
    """Redesenha a mão por cima do cabo de uma arma (dedos fechados nele)."""
    m.ell(*hand, R(3.2), R(3), skin, group='grip')


def make_goblin_green():
    m, T, R = goblin(GOB_GREEN, cloth=LEATHER)
    dagger(m, *HAND_L, ang=-2.2)
    return m


def make_goblin_red():
    m, T, R = goblin(GOB_RED, cloth=DARKLEATHER, fangs=True)
    m.cap(44, 50, 50, 29, 1.3, 3.4, BONE, group='club')
    m.px([(49, 31), (50, 34), (48, 36)], BONE.ramp[1])
    regrip(m, GOB_RED, HAND_R)
    return m


def make_goblin_mage():
    m, T, R = goblin(GOB_TEAL, eye='#7FE8FF')
    robe = M('#1A0E2E', '#3E2268', '#5E3A9A', '#8260C4', '#A88AE0', texture='bands')
    m.poly([(23, 36), (41, 36), (46, 60), (18, 60)], robe, group='robe', before='armL')
    m.poly([(24, 37), (40, 37), (40, 39), (24, 39)], GOLD, group='trim', before='armL')
    m.cap(45, 61, 45, 17, 1.2, 1.2, WOOD, group='staff')
    crystal = M('#1A2A4A', '#2E6AB0', '#5FB0F0', '#A8E0FF', '#FFFFFF')
    m.poly([(45, 7), (48, 12.5), (45, 18), (42, 12.5)], crystal, group='crystal', bevel=1)
    regrip(m, GOB_TEAL, HAND_R)
    # chapéu pontudo com a ponta caída pro lado
    m.poly([(19, 20), (45, 20), (40, 14), (35, 6), (41, 2), (31, 2), (24, 13)], robe, group='hat')
    m.poly([(16, 19), (48, 19), (48, 22), (16, 22)], robe, group='brim')
    m.px([(32, 8), (29, 13), (36, 15), (39, 3)], '#F4CE5A')
    m.px([(17, 45), (18, 44), (16, 47), (19, 50)], '#A8E0FF')   # brilho de magia na mão
    return m


def make_goblin_warrior():
    m, T, R = goblin(GOB_GREEN, cloth=LEATHER)
    armor = Mat(IRON.ramp, 'scales', 'armor')
    m.poly([(23, 34), (41, 34), (42, 47), (22, 47)], armor, group='armor', before='armL')
    m.poly([(22, 46), (42, 46), (42, 48.5), (22, 48.5)], LEATHER, group='belt2', before='armL')
    m.sym(lambda: m.ell(24, 34.5, 4.6, 3.2, IRON, group='pauldron'))
    # espada curta na mão direita
    m.cap(43.5, 50, 43.5, 46, 1.2, 1.2, LEATHER, group='hilt')
    m.cap(40.5, 45, 46.5, 45, 1, 1, IRON, group='guard')
    m.poly([(42, 44.5), (43.5, 28), (45, 44.5)], STEEL, group='blade', bevel=1)
    regrip(m, GOB_GREEN, HAND_R)
    # elmo com protetor de nariz
    m.poly([(20, 22), (44, 22), (43, 17), (38, 13), (32, 12), (26, 13), (21, 17)], IRON, group='helm')
    m.cap(32, 12, 32, 7, 1, 0.6, IRON, group='spike')
    m.poly([(19, 21), (45, 21), (45, 23.5), (19, 23.5)], IRON, group='helmrim')
    m.cap(32, 23, 32, 27.5, 0.9, 0.9, IRON, group='nasal')
    # escudo redondo no braço esquerdo
    shield = Mat(WOOD.ramp, 'wood', 'shield')
    m.ell(19, 45, 7.5, 8, shield, group='shield', flat=0.4)
    m.ell(19, 45, 2.4, 2.4, IRON, group='boss')
    m.px([(19 + round(6.8 * math.cos(a)), 45 + round(7.2 * math.sin(a))) for a in [i * math.pi / 6 for i in range(12)]], IRON.ramp[2])
    return m


def make_goblin_priest():
    m, T, R = goblin(GOB_OLIVE, eye='#FFE88A')
    robe = M('#3A342A', '#9A907A', '#D8D0BC', '#F0EADC', '#FFFFFF', texture='bands')
    m.poly([(23, 35), (41, 35), (45, 60), (19, 60)], robe, group='robe', before='armL')
    m.poly([(30, 35), (34, 35), (34.5, 61), (29.5, 61)], GOLD, group='stole', before='armL')
    m.ell(32, 42, 2.6, 2.6, GOLD, group='amulet', before='armL')
    m.pxs([(27, 37), (28, 38), (29, 39), (30, 40)], GOLD.ramp[2])
    m.px([(31, 41), (32, 41), (31, 42), (32, 42)], '#D23C3C')
    # mitra
    m.poly([(22, 19), (42, 19), (41, 12), (32, 3), (23, 12)], robe, group='mitre')
    m.poly([(31, 5), (33, 5), (33, 19), (31, 19)], GOLD, group='mitreband')
    m.poly([(21, 18), (43, 18), (43, 20.5), (21, 20.5)], GOLD, group='mitrerim')
    # cajado sagrado
    m.cap(45, 61, 45, 18, 1.2, 1.2, GOLD, group='staff')
    m.ell(45, 14, 3.2, 3.2, GOLD, group='orb', flat=0.3)
    m.px([(45, 13), (44, 14), (45, 14), (46, 14), (45, 15)], '#FFFFFF')
    regrip(m, GOB_OLIVE, HAND_R)
    return m


def make_goblin_master():
    m, T, R = goblin(GOB_DARK, cloth=DARKLEATHER, eye=EYE_R, fangs=True)
    cloak = M('#0E0A16', '#241A36', '#3A2A52', '#54406E', '#6E5A8A')
    m.poly([(20, 30), (44, 30), (52, 61), (12, 61)], cloak, group='cloak', before='ear')
    m.poly([(22, 31), (42, 31), (41, 35), (23, 35)], cloak, group='collar', before='armL')
    m.px([(x, 35) for x in range(24, 40)], GOLD.ramp[3])
    m.ell(32, 41, 2.8, 2.8, M('#3A0A0A', '#7A1E1A', '#C0392B', '#E86A5A', '#FFB0A0'), group='seal', before='armL')
    dagger(m, *HAND_L, ang=-2.3)
    dagger(m, *HAND_R, ang=-0.84)
    m.px([(26, 21), (27, 22), (26, 23), (27, 26)], GOB_DARK.ramp[0])   # cicatriz
    m.px([(11, 21), (11, 22)], GOLD.ramp[3])                           # brinco
    return m


def make_goblin_greater():
    m, T, R = goblin(GOB_GREATER, s=1.16, cloth=DARKLEATHER, eye=EYE_R, fangs=True)
    m.sym(lambda: m.ell(*T(24, 35), 5.2, 3.6, BONE, group='pad'))
    cy = T(0, 17.5)[1]
    m.poly([(25, cy + 3), (25, cy - 3), (28.5, cy), (32, cy - 5), (35.5, cy), (39, cy - 3), (39, cy + 3)], GOLD, group='crown', bevel=1)
    m.px([(32, round(cy) - 1), (27, round(cy) + 1), (36, round(cy) + 1)], '#D23C3C')
    hx, hy = T(*HAND_R)
    m.cap(hx, hy + 4, hx + 4, hy - 20, 1.6, 4, WOOD, group='club')
    for (dx, dy) in ((5, -18), (7, -14), (2, -12), (6, -9)):
        m.px([(round(hx + dx), round(hy + dy))], IRON.ramp[3])
    regrip(m, GOB_GREATER, (hx, hy), R)
    return m


# ---------------------------------------------------------------------
# Terras Selvagens
# ---------------------------------------------------------------------
ORC_SKIN = M('#1A2412', '#3E5428', '#5E7A3A', '#809E52', '#A8C274')


def make_orc():
    m = Monster()
    skin = ORC_SKIN

    def legs():
        m.cap(28, 46, 27, 58, 4.8, 4.2, LEATHER, group='leg')
        m.ell(26.5, 60, 5.2, 2.3, IRON, group='boot')
        m.ell(22.5, 19, 2, 3, skin, group='ear')
    m.sym(legs)
    m.ell(32, 35, 12.5, 12, skin, group='body')
    m.poly([(21, 38), (43, 38), (44, 48), (20, 48)], LEATHER, group='harness')
    m.cap(23, 26, 41, 44, 1.4, 1.4, DARKLEATHER, group='strap')
    m.poly([(20, 46), (44, 46), (44, 49), (20, 49)], DARKLEATHER, group='belt')
    m.ell(32, 47.5, 2.4, 2, IRON, group='buckle')
    # cabeça
    m.ell(32, 19.5, 9.5, 9, skin, group='head')
    m.ell(32, 25.5, 8, 5, skin, group='jaw')
    m.ell(32, 10.5, 3.2, 3, DARKLEATHER, group='topknot')
    m.ell(32, 21.5, 2.8, 2, skin, group='nose')
    m.sym(lambda: m.poly([(26.5, 27.5), (28.5, 27.5), (27.5, 23)], BONE, group='tusk', bevel=0.6))

    def arms():
        m.cap(21, 30, 18, 42, 4.6, 4, skin, group='arm')
        m.ell(17.5, 44, 4.2, 4, skin, group='hand')
    m.sym(arms)
    # machado na mão esquerda
    m.cap(17, 61, 17, 12, 1.3, 1.3, WOOD, group='haft')
    m.poly([(16.5, 14), (7, 9), (4, 17), (5, 24), (8, 28), (16.5, 22)], STEEL, group='axe')
    m.px([(x, 18) for x in range(6, 16)], STEEL.ramp[1])
    regrip(m, skin, (17.5, 44), lambda r: r * 1.3)
    # ombreira de ferro no ombro esquerdo
    m.ell(20.5, 31, 6.5, 4.5, IRON, group='pauldron')
    m.px([(17, 30), (20, 28), (24, 30)], IRON.ramp[4])
    # rosto
    m.eyes_sym(26, 18, 3, 2, EYE_Y, PUPIL, skin.ramp[1])
    m.pxs([(25, 16), (26, 16), (27, 17), (28, 17), (29, 17)], skin.ramp[0])
    m.pxs([(30, 22)], skin.ramp[0])
    m.px([(x, 27) for x in range(28, 36)], OUTLINE)
    return m


TROLL_SKIN = M('#141E22', '#2E4648', '#4A6A68', '#6A8E88', '#90B2A8', texture='spots')
TROLL_BELLY = M('#26261E', '#5A5A44', '#848462', '#A6A480', '#C8C6A2')


def make_troll():
    m = Monster()
    skin = TROLL_SKIN
    m.cap(54, 61, 56, 22, 3, 6.5, WOOD, group='club')
    m.px([(55, 30), (57, 36), (55, 44)], WOOD.ramp[0])

    def back():
        m.cap(26, 50, 25, 59, 5.8, 5.2, skin, group='leg')
        m.ell(24, 60.5, 6.5, 2.4, skin, group='foot')
        m.ell(23.5, 21, 2, 3, skin, group='ear')
    m.sym(back)
    m.ell(32, 36, 16.5, 14, skin, group='body')
    m.ell(32, 44, 10, 8, TROLL_BELLY, group='belly')
    m.poly([(20, 49), (44, 49), (42, 56), (35, 54), (32, 57), (29, 54), (22, 56)], LEATHER, group='loin')
    m.ell(32, 22.5, 8.5, 7.5, skin, group='head')
    m.ell(32, 15.5, 5, 2.5, M('#12200E', '#28401E', '#3E5C2C', '#587A3E', '#789A56'), group='moss')
    m.ell(32, 26, 3.5, 3.2, skin, group='nose')

    def arms():
        m.cap(19, 30, 12, 50, 5.8, 4.6, skin, group='arm')
        m.ell(11, 54, 5.5, 4.8, skin, group='hand')
    m.sym(arms)
    m.pxs([(7, 57), (9, 58), (12, 58), (15, 57)], BONE.ramp[2])
    # rosto
    m.eyes_sym(26, 21, 2, 2, '#FFB84A', PUPIL, skin.ramp[1])
    m.pxs([(25, 19), (26, 19), (27, 20), (28, 20)], skin.ramp[0])
    m.px([(x, 30) for x in range(27, 37)], OUTLINE)
    m.pxs([(28, 29)], BONE.ramp[3])
    return m


# ---------------------------------------------------------------------
# Andar do Dragão
# ---------------------------------------------------------------------
LIZ = M('#2A0E06', '#8A2E0E', '#D0561E', '#F0842E', '#FFB860', texture='scales')
LIZ_BELLY = M('#3A2208', '#A06A1A', '#E0A63A', '#F4CE6A', '#FFEEA8', texture='bands')
FLAME = M('#5A1206', '#C8321A', '#FF7A1E', '#FFC23A', '#FFF4A0')


def make_fire_lizard():
    m = Monster()
    far = Mat([LIZ.ramp[0], LIZ.ramp[0], LIZ.ramp[1], LIZ.ramp[2], LIZ.ramp[3]], 'scales', 'lizfar')
    # cauda enrolada pra cima com chama
    m.chain([(44, 48), (54, 50), (60, 42), (58, 32)], [5, 4, 3, 2], LIZ, group='tail')
    m.poly([(55, 33), (57, 20), (59, 26), (62, 19), (62, 30), (60, 36)], FLAME, group='flame', bevel=1)
    # pernas de trás (lado de lá)
    m.cap(42, 50, 46, 58, 3.2, 2.6, far, group='legRB')
    m.cap(22, 50, 24, 58, 3, 2.5, far, group='legRF')
    # corpo
    m.ell(34, 46, 15, 8, LIZ, group='body')
    m.ell(31, 50, 11, 4, LIZ_BELLY, group='belly')
    # espinhos de fogo nas costas
    for i, x in enumerate(range(24, 46, 5)):
        h = 5 + (i % 2) * 2
        m.poly([(x - 2, 40), (x + 1, 40 - h), (x + 2.5, 40)], FLAME, group='spike%d' % i, bevel=0.8)
    # pernas da frente (lado de cá)
    m.cap(38, 50, 36, 59, 3.4, 2.8, LIZ, group='legLB')
    m.cap(20, 48, 16, 58, 3.4, 2.8, LIZ, group='legLF')
    m.px([(33, 60), (35, 61), (37, 61), (13, 59), (15, 60), (17, 60)], BONE.ramp[3])
    # pescoço + cabeça
    m.cap(24, 44, 17, 37, 5.5, 4.5, LIZ, group='neck')
    m.ell(15, 34, 7.5, 6, LIZ, group='head')
    m.ell(8, 37, 5.5, 3.6, LIZ, group='snout')
    m.poly([(3, 38.5), (12, 38.5), (12, 40.5), (4, 40)], LIZ_BELLY, group='jaw')
    # olho de réptil (pupila em fenda) + narina + fumaça
    m.eye(13, 31, 3, 3, EYE_Y, None, LIZ.ramp[1])
    m.px([(14, 31), (14, 32), (14, 33)], PUPIL)
    m.px([(4, 36)], OUTLINE)
    m.px([(2, 33), (1, 31), (3, 30)], '#9A8C8C')
    m.px([(x, 38) for x in range(4, 12)], OUTLINE)
    return m


DRAGON = M('#2A0808', '#7A1A1A', '#B8322A', '#E0583E', '#FF9070', texture='scales')
DRAGON_BELLY = M('#3A2A10', '#9A7A3A', '#D4B06A', '#EED49A', '#FFF2CC', texture='bands')
WING = M('#1E0808', '#4A1414', '#6E2222', '#8E3030', '#AE4444')


def make_dragon():
    m = Monster()
    bone = Mat(DRAGON.ramp, None, 'wingbone')

    def wing():
        m.poly([(27, 27), (6, 3), (8, 12), (0, 15), (6, 21), (0, 28), (9, 31), (5, 38), (17, 37), (27, 38)], WING, group='wing', bevel=0.8)
        for (a, b) in [((27, 27), (6, 3)), ((26, 29), (0, 15)), ((26, 31), (0, 28)), ((27, 34), (5, 38))]:
            m.cap(*a, *b, 1.3, 0.7, bone, group='wingbone')
    m.sym(wing)
    # cauda saindo pro lado direito
    m.chain([(38, 54), (50, 58), (58, 53), (60, 45)], [5, 3.8, 2.8, 1.8], DRAGON, group='tail')
    m.poly([(57, 46), (60, 37), (63, 46), (60, 44)], DRAGON, group='tailtip', bevel=0.8)

    def legs():
        m.cap(27, 48, 26, 58, 5.8, 4.8, DRAGON, group='leg')
        m.ell(25, 60, 6, 2.5, DRAGON, group='foot')
    m.sym(legs)
    m.pxs([(20, 61), (22, 61), (24, 61)], BONE.ramp[3])
    m.ell(32, 42, 11.5, 13.5, DRAGON, group='body')
    m.ell(32, 44, 6.5, 11.5, DRAGON_BELLY, group='belly', flat=0.3)
    # pescoço + cabeça de frente
    m.cap(32, 34, 32, 19, 6, 4.8, DRAGON, group='neck')
    m.cap(32, 35, 32, 22, 3, 2.3, DRAGON_BELLY, group='throat')
    m.sym(lambda: m.chain([(27.5, 10), (24, 5), (22, 0.5)], [2.2, 1.4, 0.6], BONE, group='horn'))
    m.ell(32, 13.5, 7.5, 6, DRAGON, group='head')
    m.ell(32, 18.5, 5, 3.8, DRAGON, group='snout')
    m.sym(lambda: m.cap(25, 39, 22, 45, 3, 2.4, DRAGON, group='arm'))
    m.pxs([(20, 46), (21, 47), (22, 47)], BONE.ramp[3])
    # rosto
    m.eyes_sym(26, 12, 3, 2, EYE_Y, None, DRAGON.ramp[1])
    m.pxs([(27, 12), (27, 13)], PUPIL)                  # pupila em fenda
    m.pxs([(25, 10), (26, 10), (27, 10), (28, 11)], DRAGON.ramp[0])
    m.pxs([(30, 18)], OUTLINE)                          # narinas
    m.px([(x, 21) for x in range(28, 36)], OUTLINE)
    m.pxs([(29, 22), (31, 22)], WHITE_TEETH)
    m.px([(29, 16), (28, 14), (35, 16), (36, 14)], '#8A7A7A')   # fumacinha
    return m


# ---------------------------------------------------------------------
# Andar do Demônio
# ---------------------------------------------------------------------
SHADE = M('#06040C', '#140E22', '#241A38', '#382A52', '#4E3E6E')
VOID = '#06030A'
GLOW = '#C080FF'
CLAW = M('#1A1024', '#3E2E56', '#6A5A8A', '#9A8AB8', '#C8BCE0')


def make_shadow():
    m = Monster()
    # manto flutuante com barra esfarrapada (simétrico)
    m.poly([(22, 22), (42, 22), (50, 44), (54, 54), (48, 51), (46, 58), (41, 52), (37, 61),
            (32, 54), (27, 61), (23, 52), (18, 58), (16, 51), (10, 54), (14, 44)], SHADE, group='robe')

    def sleeve():
        m.cap(22, 30, 13, 40, 3.6, 3, SHADE, group='sleeve')
        m.ell(11.5, 42, 3, 2.8, CLAW, group='hand')
        for (a, b) in [((10.5, 44), (7, 49)), ((12.5, 45), (11, 51)), ((9.5, 42), (4, 45))]:
            m.cap(*a, *b, 0.9, 0.5, CLAW, group='talon')
    m.sym(sleeve)
    m.ell(32, 20, 11.5, 12, SHADE, group='hood')
    m.poly([(29, 9), (32, 2), (35, 9)], SHADE, group='hood')
    m.ell(32, 22, 7, 7.5, M(VOID, VOID, VOID, '#0E0818', '#140C22'), group='face')
    m.eyes_sym(28, 21, 2, 2, GLOW, None, VOID, glow='#FFFFFF')
    m.px([(8, 30), (56, 26), (58, 46), (4, 56), (60, 60), (14, 14), (48, 12)], '#6A4A9A')
    m.px([(9, 29), (57, 45)], GLOW)
    return m


IMP = M('#2A0A1A', '#6A1E3A', '#A0325A', '#C85680', '#EA8AAA')


def make_mini_servo():
    m = Monster()
    wing = Mat(WING.ramp, None, 'impwing')
    m.sym(lambda: m.poly([(28, 42), (14, 33), (15, 39), (10, 41), (16, 45), (14, 49), (26, 48)], wing, group='wing', bevel=0.7))
    m.chain([(34, 54), (42, 58), (47, 53)], [1.5, 1.1, 0.8], IMP, group='tail')
    m.poly([(46, 51), (50, 49), (49, 54)], IMP, group='tailtip', bevel=0.5)

    def back():
        m.cap(29, 52, 28, 60, 1.9, 1.6, IMP, group='leg')
        m.ell(23.5, 37, 1.6, 2.4, IMP, group='ear')
    m.sym(back)
    m.pxs([(26, 61), (27, 61), (29, 61)], OUTLINE)
    m.ell(32, 48, 6.5, 6, IMP, group='body')
    m.ell(32, 37, 8.5, 7.5, IMP, group='head')
    m.sym(lambda: m.chain([(27, 31), (24, 28), (24, 25)], [1.5, 1, 0.5], BONE, group='horn'))

    def arm():
        m.cap(27, 45, 22, 50, 1.8, 1.6, IMP, group='arm')
        for (a, b) in [((21, 51), (17, 53)), ((22, 52), (19, 56)), ((23, 51), (22, 56))]:
            m.cap(*a, *b, 0.9, 0.5, BONE, group='claw')
    m.sym(arm)
    m.eyes_sym(27, 35, 3, 2, EYE_Y, PUPIL, IMP.ramp[1])
    m.px([(x, 40) for x in range(27, 37)] + [(26, 39), (37, 39)], OUTLINE)   # sorrisão
    m.px([(28, 41), (30, 41), (33, 41), (35, 41)], WHITE_TEETH)
    return m


DEMON = M('#2A0606', '#6E1414', '#A82620', '#D04838', '#F07A5E')
HORN = M('#0E0A0E', '#2A2030', '#4A0E18', '#8A1E2A', '#C04050')
HOOF = M('#0A0808', '#1E1A1E', '#3A3438', '#5A525A', '#7A7278')


def make_demon():
    m = Monster()
    wing = Mat(['#0E0404', '#240A0A', '#3E1212', '#5A1C1C', '#782828'], None, 'dwing')

    def wings():
        m.poly([(26, 24), (4, 2), (6, 12), (0, 16), (6, 22), (0, 30), (10, 31), (6, 38), (22, 36)], wing, group='wing', bevel=0.8)
        for (a, b) in [((26, 24), (4, 2)), ((25, 26), (0, 16)), ((24, 28), (0, 30)), ((24, 31), (6, 38))]:
            m.cap(*a, *b, 1.3, 0.6, HORN, group='wingbone')
    m.sym(wings)
    m.chain([(38, 50), (50, 56), (56, 50)], [2.2, 1.6, 1.2], DEMON, group='tail')
    m.poly([(54, 49), (58, 43), (60, 51)], HORN, group='tailtip', bevel=0.6)

    def legs():
        m.chain([(28, 46), (24, 53), (27, 59)], [5.6, 4, 3.2], DEMON, group='leg')
        m.ell(26.5, 60.5, 4, 1.9, HOOF, group='hoof')
    m.sym(legs)
    m.poly([(23, 44), (41, 44), (40, 51), (32, 55), (24, 51)], DARKLEATHER, group='loin')
    m.ell(32, 33, 13, 12.5, DEMON, group='body')
    m.sym(lambda: m.ell(27, 30, 5.5, 4.5, DEMON, group='pec'))
    m.px([(31, y) for y in range(34, 43)], DEMON.ramp[1])
    m.pxs([(28, 38), (29, 38), (28, 41), (29, 41)], DEMON.ramp[1])   # abdômen

    def arms():
        m.cap(20, 25, 15, 38, 4.6, 3.8, DEMON, group='arm')
        m.ell(14, 41, 4, 3.8, DEMON, group='hand')
        for (a, b) in [((12, 43), (9, 48)), ((14, 44), (13, 49)), ((16, 44), (17, 48))]:
            m.cap(*a, *b, 0.9, 0.5, HORN, group='claw')
    m.sym(arms)
    m.ell(32, 17, 7, 7.5, DEMON, group='head')
    m.ell(32, 22, 5.5, 3.8, DEMON, group='jaw')
    m.sym(lambda: m.chain([(27, 13), (21, 10), (18, 4), (20, 0.5)], [2.6, 2, 1.3, 0.5], HORN, group='horn'))
    m.eyes_sym(27, 16, 3, 2, '#FFE24A', None, DEMON.ramp[1], glow='#FFFFFF')
    m.pxs([(26, 14), (27, 14), (28, 15), (29, 15)], DEMON.ramp[0])
    m.px([(x, 23) for x in range(28, 36)], OUTLINE)
    m.pxs([(29, 24), (29, 22)], WHITE_TEETH)
    return m


MONSTERS = {
    'goblin_green': make_goblin_green,
    'goblin_red': make_goblin_red,
    'goblin_mage': make_goblin_mage,
    'goblin_warrior': make_goblin_warrior,
    'goblin_priest': make_goblin_priest,
    'goblin_master': make_goblin_master,
    'goblin_greater': make_goblin_greater,
    'orc': make_orc,
    'troll': make_troll,
    'fire_lizard': make_fire_lizard,
    'dragon': make_dragon,
    'shadow': make_shadow,
    'mini_servo': make_mini_servo,
    'demon': make_demon,
}

if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    only = sys.argv[1:] or list(MONSTERS)
    for key in only:
        out = os.path.join(OUT_DIR, f'{key}.png')
        MONSTERS[key]().sheet().save(out)
        print('saved', out)
