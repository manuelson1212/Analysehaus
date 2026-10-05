# YouTube-Thumbnail: BTC · SOL · Öl · Staatsanleihen (1280×720)

Drei Varianten für den A/B-Test in YouTube Studio („Testen und vergleichen“, bis zu 3 Thumbnails):

| Datei | Idee |
|---|---|
| `thumbnail-a.png` | „ALLES HÄNGT AN 5,34 %“: die 10-J.-Rendite als Strippenzieher für Bitcoin, Solana und Öl |
| `thumbnail-b.png` | „4 MÄRKTE · 1 SIGNAL“: alle vier Märkte nebeneinander |
| `thumbnail-c.png` | „KIPPT JETZT ALLES?“: fallender Chart, roter Hintergrund |

Beschreibung, Titel und Tags fürs Video: `beschreibung.md`.

Die 5,34 % stammen aus der Tagesanalyse vom 05.10.2026. Die rechte untere Ecke bleibt frei, weil dort die Videolänge steht.

## Neu bauen

`node render.mjs [a,b,c]` (Playwright mit Chromium). Texte und Layout stehen in `thumbnail.html`, Variante per `?v=a|b|c`.
Schriften: Anton und Archivo Black (Google Fonts, SIL Open Font License) in `fonts/`.
