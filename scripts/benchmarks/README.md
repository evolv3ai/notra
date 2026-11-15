# Request-/Response-Audit

Stand: 18.10.2026, Repository-Basis `2c41e2a`. Keine App-Verträge, Hosting-Einstellungen oder Produktionsdaten verändert. Ergebnisse unter `results/` sind lokale Messungen und ausdrücklich keine Produktionsbenchmarks.

## Kurzfazit

1. **Bilder zuerst:** Mehrere Blog-PNGs sind 6–9 MB groß. Verlustfreies WebP spart bei den getesteten Bildern 47–58 % mit nachgewiesen identischen dekodierten RGBA-Pixeln. Verlustbehaftete/reskalierte Varianten sparen deutlich mehr, sind aber vor einem Austausch visuell und auf Textlesbarkeit zu prüfen.
2. **Komprimierung je Deployment prüfen:** Dashboard-Nitro konfiguriert bereits gzip/Brotli außerhalb Vercels (`apps/dashboard/nitro.config.ts:20–26`). Website-Nitro konfiguriert das nicht. Der lokale Website-Produktionsbuild liefert die gemessenen Antworten unkomprimiert. Das beweist keinen Fehler im Vercel-CDN.
3. **Weniger Daten vor besserer Komprimierung:** Chat sendet bestehende History erneut; Listen können kleinere Projektionen/Pagination erhalten. Die Zahlen dazu sind synthetische Vertragsvergleiche, keine implementierten Verbesserungen.
4. **Keine globale gzip-Middleware auf Verdacht:** Keine zusätzliche Komprimierung für schon kodierte Bodies, SSE/NDJSON, `no-transform`, Bilder, Videos oder Fonts erzwingen. Bei Streams wären TTFT und Chunk-Abstände eigene Pflichtmessungen.

## Methode und Grenzen

- Website mit `env -i` ohne Projekt-Credentials und ohne `.env` gebaut und als Nitro-Produktionsartefakt auf Loopback gestartet. Alle HTTP-Proben verwenden `127.0.0.1`.
- Node 24.11.1, zlib `1.3.1-470d3a2`, Brotli 1.1.0, Sharp 0.35.5. Sandbox: burstbar bis 4 vCPU / 8 GiB; CPU-Modell wird vom Gast als `unknown` gemeldet. Keine dedizierte Benchmarkmaschine.
- Textkompression: 3 Aufwärmungen, 15 gemessene synchrone Kompressionen je Datei/Algorithmus/Stufe; Median und nearest-rank p95 (bei n=15 das Maximum). Dekompressions-Roundtrip wird geprüft.
- Bilder: 1 Aufwärmung, 5 Messungen, Median und Maximum. Lossless-WebP zusätzlich pixelweise mit dem PNG verglichen. Keine visuelle Qualitätsprüfung verlustbehafteter Varianten vorgenommen; diese wurden nicht eingebaut.
- HTTP: je Pfad und Encoding 3 Aufwärmungen plus 30 sequenzielle GETs mit Keep-Alive; Status 200 geprüft; echte Body-Bytes über `node:http`, nicht automatisch dekomprimierendes `fetch`. Zeiten umfassen den ganzen Body, nicht nur TTFB. Header, Größenbereich und letzter Body-Hash werden gespeichert.
- Die Versuche liefen in derselben Sandbox; zeitweise parallel zu anderen lokalen Prüfungen. CPU-/HTTP-Zeiten sind daher Richtwerte, keine belastbaren Durchsatz- oder SLA-Aussagen. Encoding-Reihenfolge ist fest, nicht randomisiert. Unterschiedliche HTTP-Zeiten ohne unterschiedliche Kodierung sind **kein** Kompressionsgewinn.
- Dateikompression ist ein isolierter Größen-/CPU-Vergleich, kein End-to-End-Test einer eingebauten Middleware. Keine Lasttests, keine authentifizierten Browser-Sessions, kein Produktions-CDN-Test, keine Streams oder bezahlten Modellaufrufe gemessen.
- Größtes JS im allgemeinen Dateitest ist ein lazy ladbarer Base64-Font-Chunk, nicht automatisch initial geladenes JS. `entry.json` misst separat das tatsächlich per HTTP getestete `index-*.js`. `payloads.json` enthält außerdem die größte CSS-Datei, ein öffentliches Report-JSON aus dem Repository und ein kleines SVG. Das Report-JSON ist kein gemessener API-Response.

## HTTP-Istzustand des lokalen Website-Builds

Alle vier Pfade liefern bei `identity`, `gzip` und `br` denselben Body-Umfang und **kein `Content-Encoding`**. Die HTML-Inhalte selbst können dynamische Kennungen enthalten; die Größe war konstant.

| Pfad | Body-Bytes | Cache-Verhalten |
| --- | ---: | --- |
| `/` | 466.763 | public, s-maxage=300, stale-while-revalidate=60 |
| `/llms.txt` | 24.675 | kein Cache-Control in der gemessenen Antwort |
| `/assets/index-BCGSC3lP.js` | 814.982 | public, max-age=31536000, immutable |
| `/assets/free-hat-Cj6wDIx1.css` | 14.632 | public, max-age=31536000, immutable |

Vercel dokumentiert automatische gzip-/Brotli-Aushandlung über `Accept-Encoding` für geeignete MIME-Typen: <https://vercel.com/docs/how-vercel-cdn-works/compression>. Die tatsächliche Deployment-Auslieferung und Accountregeln bleiben ungemessen. Die Dokumentation allein belegt nicht die Komprimierung jeder dynamischen oder gestreamten Antwort.

## Gemessene Textkompression

Alle Größen sind Body-Bytes, ohne HTTP-Header/TLS. HTML ist ein einzelner lokal gerenderter Startseiten-Body. Die Tabelle wird aus den gespeicherten Ergebnissen abgeleitet.

| Sample | Original B | gzip 6 B | Brotli 4 B | Brotli 6 B | Brotli 11 B |
| --- | ---: | ---: | ---: | ---: | ---: |
| Startseite HTML | 466.763 | 70.316 | 55.806 | 51.501 | 45.129 |
| Website index JS | 814.982 | 259.776 | 256.590 | 238.229 | 216.623 |
| Globales CSS | 345.050 | 52.740 | 50.660 | 45.605 | 39.879 |
| Öffentliches Report-JSON | 702.485 | 145.819 | 135.449 | 118.692 | 102.209 |

### Kompressionskosten Startseite

| Verfahren | Median ms | p95 ms |
| --- | ---: | ---: |
| gzip 1 | 2.695 | 15.624 |
| gzip 6 | 5.287 | 6.328 |
| gzip 9 | 6.591 | 19.65 |
| br 4 | 3.616 | 4.349 |
| br 6 | 6.235 | 7.572 |
| br 11 | 472.193 | 689.901 |

Brotli 11 ist für Offline-/Build-Kompression denkbar, nicht die Standardwahl für dynamische Requests. Gegenüber Brotli 6 spart es beim HTML nur weitere 6.372 B, benötigt hier aber wesentlich mehr Rechenzeit. Für Origin-Kompression sind gzip 6 beziehungsweise Brotli 4–6 die sinnvolleren Messkandidaten; auf Vercel zuerst den Edge-Pfad prüfen.

## Gemessene Bildkonvertierung

| Datei | Original PNG B | gzip 6 B | WebP lossless B | WebP Q80, Originalgröße B | WebP Q80, Breite 1600 B | AVIF Q50, Breite 1600 B |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| grok-bot-submit-dark | 9.266.666 | 9.268.638 | 3.925.312 | 100.430 | 34.082 | 21.352 |
| grok-bot-marketplace-light | 6.491.881 | 6.361.096 | 2.951.712 | 119.918 | 45.512 | 30.495 |
| upstash-content-workflow | 1.422.475 | 1.408.033 | 750.812 | 71.592 | 51.516 | 32.512 |

Erste zwei Bilder: 3840×2160; drittes: 2032×856. Resizing erhält das Seitenverhältnis. Qualitätszahlen von WebP und AVIF sind nicht direkt vergleichbar. Lossless behält die dekodierten Pixel, nicht zwangsläufig alle Metadaten. Zeitwerte und Codec-Versionen stehen in `results/payloads.json`.

Die großen Dateien sind tatsächlich im Blog referenziert (`apps/web/src/content/blog/how-to-create-a-grok-bot-plugin.mdx`). Der Website-`next/image`-Shim ist ein `<img>` ohne Bildoptimierung (`apps/web/src/lib/shims/next-image.tsx`); rohe MDX-`img`s durchlaufen ihn ohnehin nicht. Ein sinnvoller Folgepatch wäre generierte responsive Bildvarianten mit `picture`/`srcset`, nicht gzip für PNG. Auch `loading` und Theme-Varianten gezielt im Browser prüfen, statt aus CSS-Sichtbarkeit auf ausbleibende Downloads zu schließen.

## Synthetische Payload-Verkleinerung

Deterministische kompakte UTF-8-JSON-Fixtures; keine Kompression, keine RPC-Hüllen. Alle Zielverträge sind Vorschläge, **nicht implementiert**. Genaue Fixture-Annahmen stehen im Skript und in `results/synthetic.txt`.

| Szenario | Ist-Fixture B | Ziel-Fixture B | Weniger |
| --- | ---: | ---: | ---: |
| Chat-POST, 100 Nachrichten → letzte Nachricht + Revisions-ID | 156.538 | 1.204 | 99,231 % |
| Chat-GET, 100 → letzte 20 Nachrichten + Cursor | 156.582 | 30.654 | 80,423 % |
| 20 Content-Karten, 2.000 Markdown-Zeichen → 200 Vorschauzeichen | 45.201 | 8.921 | 80,264 % |
| Chat-Liste, 1.000 Sessions → erste 50 + Cursor | 184.014 | 9.241 | 94,978 % |
| Logs, 200 Zusammenfassungen → erste 10 + Pagination | 56.410 | 2.901 | 94,857 % |

### Quellcodebelege und Vertragsrisiken

- **Chat-POST:** `apps/dashboard/src/lib/chat/standalone-chat-transport.ts:33–37` sendet das Nachrichtenarray. Der Server lädt bereits Zustand (`apps/dashboard/src/app/api/organizations/[organizationId]/chat/route.ts:134`). Delta-Sends brauchen serverseitigen Merge, Revisionsprüfung und gesonderte Unterstützung für Approvals, Editieren, Regeneration, Steering und parallele Tabs. Nicht einfach `.slice(-1)` einsetzen.
- **Chat-GET:** `apps/dashboard/src/lib/chat/history.ts:15–44` gibt die komplette angereicherte History zurück. History-Pagination erst nach einem kompatiblen serverautoritativen Send-Vertrag einführen; sonst droht Überschreiben durch einen unvollständigen Client-Verlauf.
- **Content-Karten:** `apps/dashboard/src/lib/orpc/routers/content.ts:184–205` projiziert bereits und begrenzt Markdown auf 2.000 Zeichen; `apps/dashboard/src/utils/content-preview.ts:48–83` zeigt maximal 160/200 Zeichen. Preview mit derselben Formatbereinigung serverseitig erzeugen; Bildposts separat behandeln. Nicht bloß Markdown auf 200 Rohzeichen abschneiden.
- **Sessions:** `packages/ai/src/chat/history.ts:545–565` liest ohne Limit. Cursor-Pagination muss Pinning, Projektscope, Suche und optimistische Sessions erhalten.
- **Logs:** `apps/dashboard/src/components/settings/panes/logs-pane.tsx:68–82` paginiert im Browser. Das Overview entfernt Payloads bereits und ist auf 200 Logs begrenzt. Nachrangiger Hebel; Pagination erzeugt zusätzliche Requests bei Seitenwechseln.

## Weitere Transportbefunde

- Die API ist entgegen der älteren CONTRIBUTING-Beschreibung keine hier belegte Worker-Auslieferung: `apps/api/Dockerfile` startet Hono mit Bun; Die Demo-API läuft auf Unkey. Der Produktionshostingpfad bleibt offen. Keine eigene API-Kompressionsmiddleware gefunden. Große JSON-Antworten und `/openapi.json` sind Kandidaten für Origin-/Edge-Proben; öffentliches OpenAPI zusätzlich für ETag/Revalidation. Private API-Caches nicht aufweichen.
- Sites läuft auf Cloudflare und hat bereits R2-/Edge-Caches, ETag/304 sowie immutable Assets. Keine zusätzliche Worker-Kompression auf Verdacht nötig. `apps/sites/src/serve-file.ts` behandelt `If-None-Match` derzeit nur als exakte Zeichenkette; robustere Revalidation wäre ein separater kleiner Hebel.
- Console ist Next.js und deaktiviert dessen Standardkompression nicht. Öffentliche Store-Endpunkte sind ausdrücklich `no-store`; ein kurzes TTL/ETag wäre nur nach Klärung der Aktualisierungssemantik sinnvoll.
- Ingest-Drains können bereits gzip-Requests entpacken (`packages/geo-core/src/ingest/drain.ts`), mit begrenzter entpackter Größe. Das ist keine allgemeine gzip-Unterstützung aller API-Requests. Request-Kompression erst mit explizitem Serververtrag, Limits nach Dekompression und Kompatibilität für Signaturen/Proxies erwägen.

## Reproduktion

Aus dem Repository-Root, mit installierten gepinnten Abhängigkeiten. Keine Projektvariablen in die lokale App übernehmen:

```sh
env -i PATH="$PATH" HOME="$HOME" CI=1 bash -c 'cd apps/web && bun run build'
env -i PATH="$PATH" HOME="$HOME" HOST=127.0.0.1 PORT=4317 NODE_ENV=production \
  node apps/web/.output/server/index.mjs
```

In einem zweiten Terminal:

```sh
node scripts/benchmarks/http-responses.mjs > /tmp/notra-http-benchmarks.json
node scripts/benchmarks/http-payloads.mjs > /tmp/notra-payload-benchmarks.json
node scripts/benchmarks/http-payloads.mjs apps/web/.output/public/assets/index-BCGSC3lP.js
python3 scripts/benchmarks/chat-payloads.py
```

Den JS-Dateinamen nach einem anderen Build anpassen. HTML-Dateiprobe mit dem unveränderten Loopback-Body:

```sh
node --input-type=module -e 'import {writeFile} from "node:fs/promises"; await writeFile("/tmp/notra-homepage.html", Buffer.from(await (await fetch("http://127.0.0.1:4317/")).arrayBuffer()))'
node scripts/benchmarks/http-payloads.mjs /tmp/notra-homepage.html
```

Das optionale Dateiargument misst nur diese Datei und überspringt die Bildtests. Der HTTP-Benchmark lehnt andere Hosts als `127.0.0.1` ab. Die Bildkonvertierung kann mehrere Minuten dauern. Keine konvertierten Bilder werden ins Repository geschrieben.

Verifikation: erfolgreicher Website-Produktionsbuild; alle Benchmarkskripte ausgeführt; Text/gzip-Roundtrips und lossless Bildpixel geprüft. Kein Produktiv-Deployment, kein PR, keine funktionalen App-Änderungen.

Zusätzliche Checks: `bun run check` erfolgreich (0 Fehler; 9.339 bestehende Warnungen, überwiegend Design-/Theme-Diagnostik). Gezieltes `bunx ultracite check` für die neuen JS-/Markdown-/JSON-Dateien ohne Warnungen oder Fehler. Beide JS-Skripte zusätzlich mit `node --check` geprüft. Keine funktionalen App-Tests ausgeführt, weil keine App-Implementierung verändert wurde.
