"""
gen_city_daylight.py
Gera a versão de ENTARDECER/AMANHECER da cidade (assets/backgrounds/
city-dusk.png) a partir da pintura de DIA (dungeon-wallpaper2.png) — usada
pelo ciclo de dia e noite do mapa junto com a pintura de dia e a de noite
(dungeon-wallpaper.png). Ver CITY_MAP.images (js/config.js) e
CityMapModule.applyDaylight (js/citymap.js).

Como funciona: sem recortar o céu (recorte deixava bordas em volta da
torre, das árvores e do morro), a imagem inteira passa por um degradê de
cor vertical — roxo no alto, rosa e laranja no horizonte, luz âmbar no chão
— e escurece um pouco; as luzes quentes (janelas, tochas, forja) são
preservadas por cima.

Como usar:
  python tools/gen_city_daylight.py

Requer Pillow e numpy.
"""
import os

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
DAY = os.path.join(ROOT, 'assets', 'backgrounds', 'dungeon-wallpaper2.png')
OUT = os.path.join(ROOT, 'assets', 'backgrounds', 'city-dusk.png')

# degradê de cor (multiplicador RGB) por altura da imagem: 0 = topo, 1 = base
TINT_STOPS = [
    (0.00, (0.62, 0.46, 0.92)),   # céu alto: roxo
    (0.22, (0.98, 0.58, 0.72)),   # rosa
    (0.40, (1.16, 0.70, 0.46)),   # horizonte: laranja
    (0.60, (1.04, 0.70, 0.52)),   # telhados: âmbar
    (1.00, (0.80, 0.58, 0.52)),   # chão: sombra quente
]
GAMMA = 1.12        # > 1 escurece os meios-tons
BRIGHTNESS = 0.92


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def main():
    day = np.asarray(Image.open(DAY).convert('RGB'), dtype=np.float32) / 255.0
    h, w, _ = day.shape
    ys = np.linspace(0, 1, h)
    tint = np.zeros((h, 3), dtype=np.float32)
    for c in range(3):
        tint[:, c] = np.interp(ys, [s[0] for s in TINT_STOPS], [s[1][c] for s in TINT_STOPS])
    tint = np.repeat(tint[:, None, :], w, axis=1)

    graded = np.power(day, GAMMA) * tint * BRIGHTNESS
    # luzes quentes (janelas/tochas/forja): mantém como na pintura, um pouco mais fortes
    r, g, b = day[..., 0], day[..., 1], day[..., 2]
    lamp = (smoothstep(0.55, 0.85, r) * smoothstep(0.18, 0.4, r - b))[..., None]
    out = graded * (1 - lamp) + np.clip(day * 1.1, 0, 1) * lamp
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(OUT, optimize=True)
    print('ok:', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
