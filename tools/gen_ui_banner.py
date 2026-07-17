"""
gen_ui_banner.py
Faixa/ribbon pixel art (assets/icons/menu-ribbon.png) usada como fundo do
hover nos botões de texto do menu (ver .main-menu-actions .menu-btn:hover e
.pre-splash__cta:hover em style.css) — pediu pra trocar a faixa vermelha lisa
por algo no estilo de uma fita/ribbon desgastada (ponta em bandeirola à
esquerda com um retalho escuro dobrado por baixo, ponta bifurcada à direita,
sombreado claro/escuro e bordas puídas em vez de retas).

Mesmo motor de grade+contorno automático de gen_building_icons.py/
gen_sprites.py, só que numa grade bem mais larga que alta (faixa horizontal)
em vez de quadrada. É esticada via CSS (background-size:100% 100% +
image-rendering:pixelated), então a arte só precisa fazer sentido no aspect
ratio largo em que já nasce — sem preocupação com repetição/9-slice.

---------------------------------------------------------------------------
PARÂMETROS PRINCIPAIS (pra mexer sem quebrar a silhueta)
---------------------------------------------------------------------------
Ficam todos dentro de make_ribbon(), logo no topo da função:

  band_height   Altura (em linhas da grade) do corpo principal da fita.
                Maior = fita mais "grossa". O corpo fica sempre centralizado
                verticalmente em GRID_H sozinho (calculado a partir disso),
                não precisa mexer em mais nada pra recentralizar.
  left_w        Largura (em colunas) da ponta esquerda (a bandeirola que
                afunila até um ponto). Maior = ponta mais comprida/gradual.
  right_w       Largura da ponta direita bifurcada (o "V" vazado). Maior =
                garfo mais comprido.
  flap_w        Largura do retalho escuro dobrado que sai por baixo da ponta
                esquerda. Não precisa ficar exatamente igual a left_w.

O corpo central (a parte reta do meio) SEMPRE começa em left_w e termina em
GRID_W - right_w — é calculado a partir dos dois de propósito, então mudar
left_w/right_w/GRID_W nunca abre um buraco no meio da fita (antes essas
colunas eram números fixos digitados à mão — por isso mudar GRID_W ou as
pontas sem also mudar esses números manualmente quebrava a silhueta em
pedaços soltos).

Já GRID_W/GRID_H/PIXEL (logo abaixo, fora da função) controlam a "resolução"
do desenho, não a arte em si:
  GRID_W, GRID_H  Tamanho da grade em células. Mudar GRID_W deixa a faixa
                  proporcionalmente mais larga (sobra mais espaço reto no
                  meio, já que left_w/right_w não mudam). Mudar GRID_H sobra/
                  falta espaço em branco acima/abaixo do corpo (que sempre
                  fica centralizado — só cresce a margem, não o desenho).
  PIXEL           Tamanho em pixels reais de cada célula da grade. Só deixa
                  a imagem final maior/mais nítida, não muda o desenho.

Cores (body_light/body_mid/fold_dark/outline) e RNG_SEED (semente das
mordidas puídas da borda — mesma semente = mesmo desgaste sempre) ficam
dentro de make_ribbon() também, comentados no lugar.

Como usar:
  python tools/gen_ui_banner.py

Requer Pillow (pip install pillow).
"""
import os
import random
from PIL import Image

GRID_W = 60
GRID_H = 14
PIXEL = 6
FRAME_W = GRID_W * PIXEL
FRAME_H = GRID_H * PIXEL

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')
OUT_PATH = os.path.join(OUT_DIR, 'menu-ribbon.png')

RNG_SEED = 7  # fixo pra puídos/entalhes sempre saírem iguais entre execuções


def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def new_grid(w=GRID_W, h=GRID_H):
    return [[False] * w for _ in range(h)]


def set_rect(grid, r0, c0, r1, c1):
    for r in range(max(0, r0), min(GRID_H, r1)):
        for c in range(max(0, c0), min(GRID_W, c1)):
            grid[r][c] = True


def clear_rect(grid, r0, c0, r1, c1):
    for r in range(max(0, r0), min(GRID_H, r1)):
        for c in range(max(0, c0), min(GRID_W, c1)):
            grid[r][c] = False


def is_in(grid, r, c):
    return 0 <= r < GRID_H and 0 <= c < GRID_W and grid[r][c]


def put(px, r, c, color):
    for yy in range(PIXEL):
        for xx in range(PIXEL):
            px[c * PIXEL + xx, r * PIXEL + yy] = color


def cells_in(grid, r0, c0, r1, c1):
    return [(r, c) for r in range(max(0, r0), min(GRID_H, r1))
            for c in range(max(0, c0), min(GRID_W, c1)) if grid[r][c]]


class Banner:
    """Silhueta com contorno automático (mesmo princípio do Icon em
    gen_building_icons.py) + camadas de cor sólida por cima pro sombreado."""

    def __init__(self, body_color, outline_color):
        self.grid = new_grid()
        self.body_color = body_color
        self.outline_color = outline_color
        self.overlays = []  # [(cells, color)]

    def overlay(self, cells, color):
        self.overlays.append((cells, color))

    def render(self):
        img = Image.new('RGBA', (FRAME_W, FRAME_H), (0, 0, 0, 0))
        px = img.load()
        g = self.grid
        for r in range(GRID_H):
            for c in range(GRID_W):
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
# Corpo principal da faixa + ponta em bandeirola à esquerda (afunila num só
# ponto) + ponta bifurcada à direita (estilo "swallowtail" de estandarte,
# dois bicos com um V vazado no meio). Ver bloco "PARÂMETROS PRINCIPAIS" no
# topo do arquivo antes de mexer nos números abaixo.
# ---------------------------------------------------------------------
def make_ribbon():
    body_light = hexc('#e8503f')   # topo iluminado
    body_mid = hexc('#c9432f')     # metade de baixo, em sombra (--blood)
    fold_dark = hexc('#7a2418')    # retalho dobrado da ponta esquerda
    outline = hexc('#2a0e08')

    bn = Banner(body_light, outline)
    g = bn.grid

    # ---- Dimensões principais (mexer aqui, ver comentário no topo do
    # arquivo) — band_top/band_bot saem centralizados sozinhos a partir de
    # band_height, e main_start/main_end saem de left_w/right_w, então o
    # corpo central sempre encosta nas duas pontas sem buraco no meio. ----
    band_height = 14
    band_top = (GRID_H - band_height) // 2
    band_bot = band_top + band_height
    left_w = 8
    right_w = 14
    flap_w = 11
    main_start, main_end = left_w, GRID_W - right_w

    # ---- Corpo central (sem as pontas ainda) ----
    set_rect(g, band_top, main_start, band_bot, main_end)

    # ---- Ponta esquerda: afunila de um ponto (col 0) até a largura cheia
    # (col left_w) — bandeirola simples, sem bifurcação (diferente da
    # direita). ----
    for c in range(0, left_w):
        t = c / left_w
        half = max(1, round(3 * t))  # metade da altura ocupada, cresce com t
        mid = (band_top + band_bot) // 2
        set_rect(g, mid - half, c, mid + half, c + 1)

    # ---- Ponta direita: bifurcada (swallowtail) — corte retangular vazando
    # as linhas centrais, deixando os bicos de cima/baixo com 2 linhas de
    # espessura cada (nunca 1 linha só — um traço de 1px vira só contorno no
    # Banner.render(), já que toda célula sem vizinho vira outline_color e
    # some a cor do corpo). ----
    set_rect(g, band_top, main_end, band_top + 2, main_end + right_w)
    set_rect(g, band_bot - 2, main_end, band_bot, main_end + right_w)
    # O bico de cima fica "flutuando" (vazio em cima E embaixo dele, por
    # causa do V vazado) — nenhuma célula tem os 4 vizinhos preenchidos, então
    # o auto-contorno pintaria a tira inteira de outline_color, sumindo com o
    # vermelho. Repintamos à força de body_light (o bico de baixo já escapa
    # dessa por causa do overlay de sombra logo abaixo, que cobre as mesmas
    # linhas). Uma linha de contorno manual em cima mantém a nitidez pixel art.
    top_prong_cells = cells_in(g, band_top, main_end, band_top + 2, main_end + right_w)
    top_prong_edge = cells_in(g, band_top, main_end, band_top + 1, main_end + right_w)

    # ---- Retalho escuro dobrado, saindo por baixo da ponta esquerda (dá a
    # leitura de fita real dobrada sobre si mesma, como na referência). ----
    for c in range(0, flap_w):
        t = c / flap_w
        depth = round(5 * t)  # cresce conforme se aproxima do corpo principal
        if depth <= 0:
            continue
        set_rect(g, band_bot, c, band_bot + depth, c + 1)
    flap_cells = cells_in(g, band_bot, 0, GRID_H, flap_w + 1)

    # ---- Sombra na metade inferior do corpo principal (não no retalho, que
    # já é escuro) — dá volume de fita em vez de faixa lisa. ----
    shade_cells = [(r, c) for (r, c) in cells_in(g, (band_top + band_bot) // 2, 0, band_bot, GRID_W)
                   if r >= band_bot - 3]

    bn.overlay(shade_cells, body_mid)
    bn.overlay(flap_cells, fold_dark)
    bn.overlay(top_prong_cells, body_light)
    bn.overlay(top_prong_edge, outline)

    # ---- Bordas puídas: mordidas aleatórias (mas com seed fixo) nas bordas
    # de cima/baixo do corpo principal, pra não ficar um retângulo perfeito
    # — leitura de fita desgastada/pixel art em vez de banner vetorial liso. ----
    rng = random.Random(RNG_SEED)
    for c in range(left_w + 1, main_end - 1):
        if rng.random() < 0.22:
            bite_top = rng.choice([1, 2])
            clear_rect(g, band_top, c, band_top + bite_top, c + 1)
        if rng.random() < 0.22:
            bite_bot = rng.choice([1, 2])
            clear_rect(g, band_bot - bite_bot, c, band_bot, c + 1)

    return bn.render()


if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    make_ribbon().save(OUT_PATH)
    print('saved', OUT_PATH)
