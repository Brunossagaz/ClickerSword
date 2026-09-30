"""
clean_portraits.py
Limpa os retratos dos NPCs pros diálogos: as artes originais (art/portraits/
src/<nome>.png) vieram com borda laranja, fundo preto e o pontilhado azul do
gabarito de enquadramento (_TEMPLATE_128x128) desenhados na própria imagem.

O script:
  1. corta a borda laranja;
  2. remove o fundo preto (flood fill a partir das bordas, só por pixels
     quase pretos — o preto DENTRO do personagem fica);
  3. apaga os quadradinhos azuis do gabarito;
  4. recorta no personagem e redesenha um contorno escuro de 1 px (em escala
     da arte) em volta da silhueta.
Saída: assets/portraits/<nome>.png com fundo transparente — a moldura e o
fundo do quadro vêm do CSS (.npc-portrait em css/ui-skin.css).

Como usar:  python tools/clean_portraits.py
Requer Pillow e numpy.
"""
import os
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'art', 'portraits', 'src')
OUT = os.path.join(ROOT, 'assets', 'portraits')
NAMES = ['anselmo', 'barnabe', 'creiton', 'aldo']
# Opções por retrato. template=False: a arte não tem o pontilhado azul do
# gabarito — pula o passo 3, senão tons verde-azulados (casaco do Aldo, runa
# do livro) seriam tratados como pontilhado e apagados. scale: reduz antes de
# limpar pra ficar na mesma escala dos outros (~550 px de largura).
OPTIONS = {'aldo': {'template': False, 'scale': 0.5}}


def clean(path, template=True, scale=1.0):
    src = Image.open(path).convert('RGB')
    if scale != 1.0:
        src = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
    im = np.asarray(src).astype(np.int16)
    h, w, _ = im.shape
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    # 1. borda laranja: linhas/colunas externas dominadas pelo laranja (230,142,68)
    orange = (abs(r - 230) < 30) & (abs(g - 142) < 30) & (abs(b - 68) < 30)
    top = 0
    while top < h // 4 and orange[top].mean() > 0.5: top += 1
    bot = h - 1
    while bot > 3 * h // 4 and orange[bot].mean() > 0.5: bot -= 1
    left = 0
    while left < w // 4 and orange[:, left].mean() > 0.5: left += 1
    right = w - 1
    while right > 3 * w // 4 and orange[:, right].mean() > 0.5: right -= 1
    im = im[top + 2:bot - 1, left + 2:right - 1]
    h, w, _ = im.shape
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    # 3 (antes do flood fill): quadradinhos azuis do gabarito viram fundo
    # inclui a borda suavizada dos quadradinhos (tons escuros de azul-esverdeado)
    cyan = ((g - r > 12) & (b - r > 12) & (abs(g - b) < 40)) if template else np.zeros((h, w), bool)
    near_black = (lum < 14) | cyan
    # 2. fundo = pixels quase pretos ligados à borda
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near_black[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near_black[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and near_black[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    # ilhas pequenas que sobraram (restos do pontilhado) também são fundo
    fg = ~bg
    alpha = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    fg = np.asarray(alpha) > 127
    # 4. recorta no personagem
    ys, xs = np.where(fg)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb = im[y0:y1, x0:x1].clip(0, 255).astype(np.uint8)
    fg = fg[y0:y1, x0:x1]
    # contorno escuro uniforme: anel de ~5 px (a arte original é ampliada ~4.6x)
    ring = np.asarray(Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 127
    out = np.zeros((fg.shape[0], fg.shape[1], 4), np.uint8)
    out[ring & ~fg] = (22, 14, 26, 255)
    out[fg, :3] = rgb[fg]
    out[fg, 3] = 255
    pad = 8
    canvas = np.zeros((out.shape[0] + pad, out.shape[1] + 2 * pad, 4), np.uint8)
    canvas[pad:, pad:pad + out.shape[1]] = out  # encosta na base (busto sai da borda de baixo)
    return Image.fromarray(canvas)


def main():
    for n in NAMES:
        img = clean(os.path.join(SRC, n + '.png'), **OPTIONS.get(n, {}))
        img.save(os.path.join(OUT, n + '.png'), optimize=True)
        print('ok:', n, img.size)


if __name__ == '__main__':
    main()
