# YouTube-Kanal: Banner und Profilbild

| Datei | Wofür | Hochladen unter |
|---|---|---|
| `youtube-banner-2560x1440.png` | Kanalbanner | YouTube Studio → Anpassung → Branding → Bannerbild |
| `youtube-profile-800.png` | Profilbild (wird rund zugeschnitten) | YouTube Studio → Anpassung → Branding → Bild |
| `youtube-preview.png` | Vorschau: so sieht das Banner auf TV, PC, Tablet und Handy aus | nur zum Ansehen |

YouTube nimmt ein Bannerbild und schneidet es je nach Gerät selbst zu. Logo, Name und Slogan liegen
komplett im Bereich, den jedes Gerät zeigt (1546×423 in der Mitte). PC und Tablet zeigen links und rechts
mehr Hintergrund, der Fernseher das ganze Bild inklusive der Zeile mit den Märkten.
Beim Hochladen den Zuschnitt in YouTube einfach so lassen, wie er vorgeschlagen wird.

Neu erzeugen (z. B. nach Textänderung in `make-youtube.mjs`): `node brand/render-youtube.mjs`
(braucht Playwright mit Chromium).
