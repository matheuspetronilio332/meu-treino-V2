#!/usr/bin/env python3
"""Gera os ícones do app (PNG) a partir da mesma geometria do icons/favicon.svg.

Uso:  python3 tools/gerar-icones.py        (requer: pip install pillow)
Só é necessário se você quiser mudar o desenho; os PNGs já estão na pasta icons/.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

SAIDA = Path(__file__).resolve().parent.parent / "icons"
FUNDO = (13, 22, 19, 255)       # #0d1613
VERDE = (0, 184, 148, 255)      # #00b894
AMBAR = (240, 180, 41, 255)     # #f0b429
BRANCO = (238, 245, 242, 255)   # #eef5f2
SS = 4                          # supersampling para suavizar as bordas


def desenhar(tamanho, escala_glifo=1.0, cantos=0.0):
    """Desenha o ícone numa tela de 100x100 unidades. `cantos` é o raio relativo (0 = quadrado)."""
    t = tamanho * SS
    img = Image.new("RGBA", (t, t), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = t / 100.0

    def p(v):  # unidades -> pixels
        return v * u

    if cantos > 0:
        d.rounded_rectangle([0, 0, t - 1, t - 1], radius=cantos * t, fill=FUNDO)
    else:
        d.rectangle([0, 0, t, t], fill=FUNDO)

    def g(v):  # aplica a escala do glifo em torno do centro (50, 50)
        return 50 + (v - 50) * escala_glifo

    # anel de 270 graus (abertura embaixo)
    r, esp = 34 * escala_glifo, 7 * escala_glifo
    # o PIL desenha o traço para DENTRO da caixa; por isso a caixa é r + esp/2 (traço centrado em r)
    ext = r + esp / 2
    caixa = [p(g(50) - ext), p(g(50) - ext), p(g(50) + ext), p(g(50) + ext)]
    d.arc(caixa, start=135, end=45, fill=VERDE, width=round(p(esp)))
    for ang in (135, 45):  # pontas arredondadas
        x = g(50) + r * math.cos(math.radians(ang))
        y = g(50) + r * math.sin(math.radians(ang))
        d.ellipse([p(x - esp / 2), p(y - esp / 2), p(x + esp / 2), p(y + esp / 2)], fill=VERDE)
    # ponto âmbar na ponta final (descanso)
    x = g(50) + r * math.cos(math.radians(45))
    y = g(50) + r * math.sin(math.radians(45))
    rr = 5.2 * escala_glifo
    d.ellipse([p(x - rr), p(y - rr), p(x + rr), p(y + rr)], fill=AMBAR)

    # halter
    def retangulo(x1, y1, x2, y2, raio):
        d.rounded_rectangle([p(g(x1)), p(g(y1)), p(g(x2)), p(g(y2))], radius=p(raio * escala_glifo), fill=BRANCO)

    retangulo(41, 48.2, 59, 51.8, 1.0)   # barra
    retangulo(36, 38, 41.5, 62, 1.6)     # anilha interna esquerda
    retangulo(58.5, 38, 64, 62, 1.6)     # anilha interna direita
    retangulo(30, 43.5, 35.5, 56.5, 1.6) # anilha externa esquerda
    retangulo(64.5, 43.5, 70, 56.5, 1.6) # anilha externa direita

    return img.resize((tamanho, tamanho), Image.LANCZOS)


def main():
    SAIDA.mkdir(exist_ok=True)
    desenhar(512, 1.0, 0.22).save(SAIDA / "icon-512.png")
    desenhar(192, 1.0, 0.22).save(SAIDA / "icon-192.png")
    # maskable: sem cantos transparentes e com o desenho dentro da "zona segura" (~72%)
    desenhar(512, 0.72, 0.0).save(SAIDA / "icon-maskable-512.png")
    # iOS arredonda sozinho: quadrado cheio
    desenhar(180, 0.9, 0.0).save(SAIDA / "apple-touch-icon.png")
    print("Ícones gerados em", SAIDA)


if __name__ == "__main__":
    main()
