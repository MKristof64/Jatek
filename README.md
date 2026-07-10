# Az ivós játék

Mobil-first, telepíthető React + Vite partyjáték. Egy telefonon és legfeljebb
15 résztvevős, PeerJS-alapú online szobában is használható.

## Helyi futtatás

Node.js 24 ajánlott.

```bash
npm ci
npm run dev
```

Az alapértelmezett fejlesztői cím: `http://127.0.0.1:5173/Jatek/`.

## Ellenőrzések

```bash
npm test
npm run validate:data
npm run build
```

A GitHub Actions minden feltöltésnél lefuttatja a függőségi auditot, a
játékmenet- és Worker-biztonsági teszteket, a kártyaadatok validálását és a
production buildet.

## Felépítés

- `src/pages`: alkalmazásképernyők
- `src/components`: újrahasznosítható felületi elemek
- `src/data`: beépített paklik és játékmódok
- `src/lib`: játékmenet-, teljesképernyő- és távoli kártyalogika
- `cloudflare/feedback-worker`: D1-alapú kártyakezelő és vezérlőközpont
- `public`: PWA manifest, service worker és alkalmazásikonok
