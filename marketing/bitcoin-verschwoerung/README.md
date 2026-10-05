# Bitcoin-Verschwörungen: 9:16-Short (Remotion)

- `bitcoin-verschwoerung.mp4`: fertiges Video mit Stimme und Musik (1080×1920, 30 fps, H.264/AAC, ca. 58 s).
- `bitcoin-verschwoerung-nur-musik.mp4`: dasselbe Video nur mit Musik, falls du selbst einsprechen willst.

## Aufbau

Hook („Wurde Bitcoin vom Geheimdienst erfunden?“), 5 Theorien mit Faktencheck-Stempel, Call-to-Action (Nummer kommentieren, folgen für Teil 2).

| # | Theorie | Stempel |
|---|---------|---------|
| 1 | NSA-Paper „How to Make a Mint“ (1996) | KEIN BEWEIS: Paper echt, NSA-Bitcoin unbelegt |
| 2 | SAmsung, TOSHIba, NAKAmichi, MOTOrola | ZUFALL?: Wortspiel, kein Beleg |
| 3 | Rund 1 Mio. BTC von Satoshi, nie bewegt | UNGEKLÄRT: Menge geschätzt |
| 4 | Bitcoin-Whitepaper in macOS (seit Mojave 2018, entdeckt 2023) | FAKT |
| 5 | Schlagzeile der Times im Genesis-Block | FAKT |

Die Stempel trennen bewusst Belegtes von Spekulation. Das schützt vor Fehlinformations-Meldungen und sorgt für Diskussion in den Kommentaren.

Schnitt und Effekte: harte Schnitte mit Weißblitz und Whoosh, Jump-Cut-Zooms auf Schlüsselwörtern (`Camera` in `src/fx.tsx`), Kamerawackeln bei Treffern, RGB-Glitch, Wort-für-Wort-Untertitel im TikTok-Stil, Filmkorn, Scanlines und Vignette.

## Bearbeiten

```console
npm i
npm run dev        # Remotion Studio (Vorschau)
```

- **Text ändern:** in `script.json` ist `say` das, was die Stimme liest, und `show` die Untertitelzeile. Danach neu bauen (siehe unten).
- **Eigene Clips:** Datei nach `public/clips/` legen und im Studio unter den Props der Composition `BitcoinVerschwoerung` z. B. `clips.nsa = "clips/nsa.mp4"` setzen. Der Clip läuft abgedunkelt mit langsamem Zoom hinter den Grafiken dieser Szene. Nutze nur Material, an dem du die Rechte hast.

## Neu bauen

```console
pip install numpy piper-tts
# deutsche Stimme: https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-de-thorsten-low.tar.gz
python3 tools/build.py --voice de-thorsten-low.onnx
npx remotion render BitcoinVerschwoerung out/bitcoin-verschwoerung.mp4
```

`tools/build.py` spricht jede Zeile mit Piper ein, schreibt das Timing nach `src/timeline.json` (Szenenlängen, Wort-Timing der Untertitel, Zeitpunkte der Stempel) und erzeugt mit `tools/audio.py` die Musik, Whooshes, Treffer und den Mix nach `public/soundtrack.wav` (−14 LUFS) sowie `public/music-only.wav`. Bild und Ton bleiben dadurch auch nach Textänderungen frame-genau synchron.

Schriften (Anton, Inter, JetBrains Mono, OFL-Lizenz) liegen in `public/fonts`, damit das Rendern ohne Internet funktioniert.
