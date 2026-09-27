# Prompt para gerar a arte da interface (molduras/botões) em outra IA

Use o texto abaixo numa IA de imagem (ou de pixel art). Peça **uma peça por vez**.
Ao terminar, salve cada PNG com o nome indicado em `assets/ui/` (ou mande os
arquivos no chat) — o jogo usa as peças como *9-slice* (os cantos ficam fixos,
as bordas repetem e o miolo estica), então o formato de entrega importa.

---

## Prompt (copiar e colar)

> Crie uma peça de interface em **pixel art de 16 bits** para um RPG de
> fantasia medieval sombrio (estilo SNES / "Octopath Traveler" / "Sea of
> Stars"). Paleta limitada (no máximo 16 cores), **sem anti-aliasing, sem
> desfoque, sem gradiente suave, sem texto**. Luz vindo de cima à esquerda.
> Tema: **pedra escura e ferro com detalhes em ouro envelhecido**, cantos com
> uma pequena pedra preciosa vermelha. Fundo interno escuro (roxo-acinzentado
> quase preto, `#1e1828`), levemente texturizado.
>
> **Peça:** `{NOME DA PEÇA}` — `{DESCRIÇÃO}`
>
> **Regras de formato (obrigatórias):**
> - PNG com **fundo transparente** fora da peça.
> - Tamanho exato de **{L}x{A} pixels** (1 pixel da arte = 1 pixel do arquivo,
>   sem ampliar).
> - Borda de **{B} pixels** em todos os lados: os 4 cantos ({B}x{B}) são
>   ornamentados; as bordas entre os cantos devem ser **repetíveis** (o padrão
>   do meio da borda de cima encaixa consigo mesmo quando repetido); o miolo
>   é uma cor/textura que pode ser esticada.
> - Nada de sombra externa (o jogo desenha a sombra).
> - Entregue também uma versão **ampliada 8x** só para visualização.

### Peças a pedir

| Arquivo (`assets/ui/`) | {L}x{A} | {B} | Descrição |
|---|---|---|---|
| `frame-lg.png` | 40x40 | 12 | Moldura principal de janelas (lojas, diálogos, perfil). |
| `frame-sm.png` | 16x16 | 6 | Moldura pequena (tooltips, placas, balões). |
| `title-plate.png` | 32x14 | 6 | Placa de título dos modais (faixa/estandarte, fundo vermelho-vinho). |
| `btn.png` | 12x12 | 4 | Botão em repouso (pedra/ferro com friso dourado). |
| `btn-hover.png` | 12x12 | 4 | Mesmo botão, mais claro (mouse em cima). |
| `btn-press.png` | 12x12 | 4 | Botão afundado (luz invertida). |
| `btn-disabled.png` | 12x12 | 4 | Botão apagado/cinza. |
| `btn-green.png` / `btn-red.png` / `btn-orange.png` | 12x12 | 4 | Variações de cor (confirmar / sair / comprar). |
| `slot.png` | 12x12 | 4 | Campo rebaixado (slot de inventário, linha de lista). |
| `close.png` | 14x14 | — | Botão "X" de fechar. |

## Como me devolver

1. Os PNGs **no tamanho exato** da tabela (não ampliados), um por peça, com o
   nome do arquivo da tabela.
2. Se a IA só entregar imagem ampliada, mande assim mesmo e diga o fator
   (ex.: "está 8x") — eu reduzo sem perder pixels.
3. Se possível, a paleta usada (lista de cores hex).

Com isso eu converto para o formato do GridFab (`art/ui/<peça>/`, editável),
ajusto as bordas repetíveis se precisar e ligo no `css/ui-skin.css`.
