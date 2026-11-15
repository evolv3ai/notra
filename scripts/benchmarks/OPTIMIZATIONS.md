# Implementierte Payload-Optimierungen

Dieser Patch setzt Optimierungen um; der ursprüngliche Audit in `README.md` dokumentiert separat die unveränderte Baseline. Keine Produktionsdaten oder externen Endpunkte wurden für diese Messungen verwendet.

## Vorher / nachher

| Messfall | Baseline | Implementierung | Ersparnis |
| --- | ---: | ---: | ---: |
| Sieben Blog-Screenshots, Bytes | 46,890,855 | 1,241,296 | 97.4 % |
| 20 Home-Karten, synthetisches JSON, Bytes | 41,101 | 4,581 | 88.9 % |
| 80 API-Posts, synthetisches JSON, Bytes | 27,271 | 874 | 96.8 % |

Die Kartenmessung vergleicht die bisherige 2.000-Zeichen-Markdown-Projektion mit der implementierten 160-Zeichen-Home-Vorschau. Collection-Listen behalten die eigene 200-Zeichen-/3-Zeilen-Vorschau; Bildposts behalten Content und Markdown zur Bildauflösung. Detail-/Editor-Endpunkte bleiben unverändert. Die Vorschau wird vor der Kürzung bereinigt; lange Überschriften und Linkziele verschlucken deshalb keinen sichtbaren Text mehr. Dafür liest der Server jetzt das vollständige Markdown aus der Datenbank; die Ersparnis betrifft die Server-Browser-Strecke, nicht die Datenbankabfrage.

Die Bilder verwenden WebP Q90 bei unveränderter Auflösung, feste Dimensionen, Lazy Loading und asynchrones Decoding. Die ursprünglichen PNGs bleiben für bestehende externe Links erhalten. Die Konvertierung ist verlustbehaftet, nicht pixelidentisch.

## API-Kompression

Nur vollständig erzeugte Hono-`c.json()`-Antworten zwischen 1 KiB und 1 MiB werden bei akzeptiertem gzip mit asynchronem gzip Level 1 komprimiert, und nur wenn das Ergebnis kleiner ist. Bereits kodierte Antworten, HEAD, leere/Partial-Antworten, `no-transform`, SSE, NDJSON und unbekannte Streams bleiben unangetastet. `Vary`, Content-Length und ETag werden korrekt angepasst; Status, Cookies und übrige Header bleiben erhalten. Request-Kompression und Chat-History-Verträge werden nicht verändert.

Die Website erzeugt außerhalb Vercels zusätzlich gzip-/Brotli-Varianten ihrer statischen Assets. Auf Vercel bleibt die vorhandene CDN-Kompression zuständig. Das komprimiert nicht automatisch dynamisches HTML und verändert keine Stream-Auslieferung.

## Reproduktion

```sh
bun --no-env-file scripts/benchmarks/optimized-payloads.mjs
```

Gepinnter Bun 1.4.0, 50 Warmups und 500 gemessene Requests je Modus. Jeder Body wird vollständig gelesen und die erste Antwort je Modus auf identisches JSON geprüft. Die API-Messung verwendet die echte Middleware in einem lokalen Hono-Handler, ohne Netzwerk, Datenbank, Auth oder CDN; sie ist kein Produktionslatenzbenchmark.

| API-Modus | Wall ms/Request | CPU ms/Request |
| --- | ---: | ---: |
| baseline | 0.041 | 0.040 |
| identity | 0.038 | 0.040 |
| gzip | 0.290 | 0.280 |

Gemeinsam genutzte Sandbox: Laufzeiten sind Richtwerte. Rohdaten einschließlich Laufzeitversionen und Einzelbildgrößen stehen in `results/optimized.json`. Die ursprünglichen Audit-Rohdaten bleiben unverändert.
