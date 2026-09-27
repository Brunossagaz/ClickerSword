"""
gen_city_daylight.py
Gera as versões de NOITE e de ENTARDECER/AMANHECER da cidade a partir da
pintura de DIA (assets/backgrounds/dungeon-wallpaper2.png), usadas pelo ciclo
de dia e noite do mapa (ver CITY_MAP.images em js/config.js e
CityMapModule.applyDaylight em js/citymap.js).

Sem recortar o céu (recorte deixava bordas em volta da torre, das árvores e
do morro): a imagem inteira passa por um degradê de cor vertical, e as luzes
quentes da pintura (janelas, lanternas, forja) são preservadas por cima.
  - entardecer (city-dusk.png): roxo no alto, rosa/laranja no horizonte,
    luz âmbar no chão;
  - noite (dungeon-wallpaper.png): azul escuro, luzes com brilho em volta,
    estrelas e lua desenhadas só sobre pixels de céu azul (pixel a pixel,
    então não aparece borda em volta de nada).

Como usar:
  python tools/gen_city_daylight.py

Requer Pillow e numpy.
"""
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
BG = os.path.join(ROOT, 'assets', 'backgrounds')
DAY = os.path.join(BG, 'dungeon-wallpaper2.png')
OUT_DUSK = os.path.join(BG, 'city-dusk.png')
OUT_NIGHT = os.path.join(BG, 'dungeon-wallpaper.png')

# degradê de cor (multiplicador RGB) por altura: 0 = topo, 1 = base
DUSK_STOPS = [
    (0.00, (0.78, 0.44, 0.78)),   # céu alto: roxo
    (0.22, (0.98, 0.58, 0.72)),   # rosa
    (0.40, (1.16, 0.70, 0.46)),   # horizonte: laranja
    (0.60, (1.04, 0.70, 0.52)),   # telhados: âmbar
    (1.00, (0.80, 0.58, 0.52)),   # chão: sombra quente
]
NIGHT_STOPS = [
    (0.00, (0.16, 0.20, 0.42)),   # céu alto: azul-marinho
    (0.35, (0.22, 0.27, 0.50)),
    (0.60, (0.30, 0.33, 0.52)),   # casas
    (1.00, (0.34, 0.34, 0.50)),   # praça (um pouco mais clara, luar)
]


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def gradient(h, w, stops):
    ys = np.linspace(0, 1, h)
    g = np.zeros((h, 3), dtype=np.float32)
    for c in range(3):
        g[:, c] = np.interp(ys, [s[0] for s in stops], [s[1][c] for s in stops])
    return np.repeat(g[:, None, :], w, axis=1)


# Fontes de luz da pintura de dia (x, y, raio em px da imagem): janelas,
# lanternas, velas, tochas da caverna e a forja. Marcadas à mão porque o sol
# forte da pintura (pedras, rocha, telhas) tem a mesma cor quente e clara das
# lâmpadas e engana qualquer detecção automática. Se a pintura mudar, é só
# ajustar os pontos (dá pra conferir desenhando os círculos por cima).
LIGHTS = [
    (30, 590, 22), (140, 612, 16),                      # loja: lanterna e janela
    (480, 355, 26), (398, 515, 18), (550, 515, 18),     # vitrais da igreja
    (453, 562, 12), (567, 562, 12),                     # velas da escadaria
    (400, 815, 24),                                     # lanterna do poste (frente)
    (790, 495, 70),                                     # janelas da casa do meio
    (1157, 455, 18),                                    # lanterna do poste (caminho)
    (1375, 660, 42), (1265, 625, 16), (1430, 625, 16), (1512, 617, 18),  # forja e lanternas
    (1132, 265, 10), (1200, 265, 10),                   # tochas da caverna
    (1640, 405, 20),                                    # janela à direita
]


def lamp_mask(day, strict=False):
    """Luzes quentes da pintura. Modo normal (entardecer): qualquer pixel
    quente e claro. Modo estrito (noite): só dentro dos círculos de LIGHTS."""
    r, g, b = day[..., 0], day[..., 1], day[..., 2]
    m = smoothstep(0.55, 0.85, r) * smoothstep(0.18, 0.4, r - b)
    if not strict:
        return m
    h, w = r.shape
    yy, xx = np.mgrid[0:h, 0:w]
    near = np.zeros((h, w), bool)
    for x, y, rad in LIGHTS:
        near |= (xx - x) ** 2 + (yy - y) ** 2 <= rad ** 2
    lum = day.mean(axis=2)
    warm = (r > 0.78) & (r - b > 0.22) & (lum > 0.5)
    return np.where(near & warm, np.maximum(m, 0.7), 0.0).astype(np.float32)


def blur(arr, radius):
    img = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0


def make_dusk(day):
    h, w, _ = day.shape
    graded = np.power(day, 1.12) * gradient(h, w, DUSK_STOPS) * 0.92
    lamp = lamp_mask(day)[..., None]
    return graded * (1 - lamp) + np.clip(day * 1.1, 0, 1) * lamp


def make_night(day):
    h, w, _ = day.shape
    lum = day.mean(axis=2, keepdims=True)
    # meio dessaturado (à noite as cores somem) e bem mais escuro
    base = day * 0.55 + lum * 0.45
    # curva que comprime os claros: o sol forte da pintura não vira mancha branca
    night = np.power(base, 1.35) * (1 - 0.4 * base) * gradient(h, w, NIGHT_STOPS) * 1.25

    # luzes: mantém a cor da pintura, mais fortes, com brilho quente em volta
    lamp = lamp_mask(day, strict=True)
    lamp3 = lamp[..., None]
    night = night * (1 - lamp3) + np.clip(day * 1.2, 0, 1) * lamp3
    warm = np.array([1.0, 0.62, 0.28], dtype=np.float32)
    # halo radial em volta de cada fonte + brilho curto colado na chama/vidro
    yy, xx = np.mgrid[0:h, 0:w]
    halo = np.zeros((h, w), np.float32)
    for x, y, rad in LIGHTS:
        d = np.hypot(xx - x, yy - y)
        halo += np.exp(-d / (rad * 1.6 + 10)) * (0.5 if rad < 40 else 0.8)
    glow = np.clip(halo, 0, 1) * 0.55 + blur(lamp, 5) * 0.4
    night = night + glow[..., None] * warm

    # céu azul da pintura (só pra posicionar estrelas/lua — sem recorte)
    r, g, b = day[..., 0], day[..., 1], day[..., 2]
    ys = np.arange(h)[:, None] / h
    sky = (b > 0.62) & (b - r > 0.18) & (b > g) & (ys < 0.4)
    rng = np.random.default_rng(7)
    stars = np.zeros((h, w), np.float32)
    cand = np.argwhere(sky)
    for y, x in cand[rng.random(len(cand)) < 0.0028]:
        # estrela de 1 px, algumas maiores em cruz
        v = rng.uniform(0.55, 1.0)
        stars[y, x] = max(stars[y, x], v)
        if v > 0.93 and 1 <= y < h - 1 and 1 <= x < w - 1 and sky[y - 1:y + 2, x - 1:x + 2].all():
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                stars[y + dy, x + dx] = max(stars[y + dy, x + dx], v * 0.55)
    night = night + stars[..., None] * np.array([0.85, 0.9, 1.0], dtype=np.float32)

    # lua: primeiro lugar (varrendo o topo) com um disco inteiro de céu
    R = 22
    moon_at = None
    for cy in range(R + 12, int(h * 0.22)):
        for cx in range(int(w * 0.35), int(w * 0.62), 6):
            ys_, xs_ = np.ogrid[-R - 4:R + 5, -R - 4:R + 5]
            disc = ys_ ** 2 + xs_ ** 2 <= (R + 4) ** 2
            patch = sky[cy - R - 4:cy + R + 5, cx - R - 4:cx + R + 5]
            if patch.shape == disc.shape and patch[disc].all():
                moon_at = (cy, cx)
                break
        if moon_at:
            break
    if moon_at:
        cy, cx = moon_at
        yy, xx = np.mgrid[0:h, 0:w]
        d = np.hypot(yy - cy, xx - cx)
        # halo suave + disco com crateras em pixel (tons frios)
        night = night + (np.exp(-np.clip(d - R, 0, None) / 38.0) * 0.28 * (d > R))[..., None] * np.array([0.55, 0.65, 0.95], dtype=np.float32)
        disc = d <= R
        shade = np.clip(((xx - cx) - (yy - cy)) / (R * 2.2), -1, 1)   # luz vindo da esquerda/cima
        moon = np.stack([0.90 - 0.12 * shade, 0.92 - 0.12 * shade, 0.98 - 0.08 * shade], axis=-1)
        for (oy, ox, rr) in ((-7, -6, 5), (6, 4, 4), (-2, 9, 3), (10, -8, 3)):
            crater = np.hypot(yy - (cy + oy), xx - (cx + ox)) <= rr
            moon[crater] *= 0.86
        night[disc] = moon[disc]
    return night


def save(arr, path):
    Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).save(path, optimize=True)
    print('ok:', os.path.relpath(path, ROOT))


def main():
    day = np.asarray(Image.open(DAY).convert('RGB'), dtype=np.float32) / 255.0
    save(make_dusk(day), OUT_DUSK)
    save(make_night(day), OUT_NIGHT)


if __name__ == '__main__':
    main()
