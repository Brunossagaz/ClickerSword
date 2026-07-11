"""
resize_sprite.py
Redimensiona um spritesheet de monstro desenhado à mão (3 frames iguais lado
a lado, qualquer tamanho) para o padrão do jogo: 3 frames de 128x128
(384x128 total) — ver MONSTER_TYPES em js/config.js, todo monstro espera
frameW:128/frameH:128 nesse arquivo.

Cada frame é encaixado (mantendo a proporção original, sem esticar/distorcer
a arte) dentro de um quadrado 128x128 e centralizado, sobrando borda
transparente nos lados que não preenchem o quadrado.

Faz backup do arquivo original (antes do redimensionamento) em
"<nome>_before_resize.png", caso ainda não exista — não mexe em nenhum
"<nome>_bkp.png" que já exista (esse costuma ser a versão procedural antiga
gerada por gen_sprites.py, não o desenho novo).

Como usar:
  python tools/resize_sprite.py assets/sprites/slime.png

Requer Pillow (pip install pillow).
"""
import sys
import os
from PIL import Image

FRAME = 128


def main(path):
    img = Image.open(path).convert('RGBA')
    w, h = img.size

    if w == FRAME * 3 and h == FRAME:
        print(f'{path} já está no tamanho padrão ({FRAME*3}x{FRAME}) — nada a fazer.')
        return

    if w % 3 != 0:
        print(f'Aviso: largura {w} não é múltiplo de 3 — os 3 frames podem sair desalinhados.')
    frame_w = w // 3
    frame_h = h

    backup_path = os.path.splitext(path)[0] + '_before_resize.png'
    if not os.path.exists(backup_path):
        img.save(backup_path)
        print('backup do desenho original salvo em', backup_path)

    out = Image.new('RGBA', (FRAME * 3, FRAME), (0, 0, 0, 0))
    for i in range(3):
        frame = img.crop((i * frame_w, 0, (i + 1) * frame_w, frame_h))
        # encaixa mantendo a proporção (sem distorcer) — o lado que sobrar
        # vira borda transparente, centralizada
        scale = min(FRAME / frame_w, FRAME / frame_h)
        new_w, new_h = max(1, round(frame_w * scale)), max(1, round(frame_h * scale))
        frame_resized = frame.resize((new_w, new_h), Image.LANCZOS)
        off_x = (FRAME - new_w) // 2
        off_y = (FRAME - new_h) // 2
        out.paste(frame_resized, (i * FRAME + off_x, off_y), frame_resized)

    out.save(path)
    print(f'salvo {path} — {w}x{h} -> {out.size[0]}x{out.size[1]}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print('uso: python tools/resize_sprite.py <caminho-do-png>')
        sys.exit(1)
    main(sys.argv[1])
