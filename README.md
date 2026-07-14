# Az ivós játék

Mobil-first React + Vite partyjáték webes és natív Android-kiadással.
Egy telefonon és legfeljebb 15 résztvevős, PeerJS-alapú online szobában is
használható.

## Letöltés

A legfrissebb aláírt Android APK:
[Az ivós játék letöltése](https://github.com/MKristof64/Jatek/releases/latest/download/Az-ivos-jatek.apk).

## Helyi futtatás

Node.js 24 ajánlott.

```bash
npm ci
npm run dev
```

Az alapértelmezett fejlesztői cím: `http://127.0.0.1:5173/Jatek/`.

## Android-alkalmazás

A natív alkalmazás Capacitor 8 alapú. Android 7.0 vagy újabb rendszeren fut,
álló tájolású, és a játékfelületen valódi, élre húzott teljes képernyőt használ.

```bash
npm run android:check
npm run android:release
```

Az aláírt APK helye:
`android/app/build/outputs/apk/release/app-release.apk`.

Az Android Studio projekt frissítése és megnyitása:

```bash
npm run android:sync
npm run android:open
```

A kiadási kulcs és az `android/keystore.properties` helyi titok. Ezeket tilos
verziókezelésbe tenni, a kiadási kulcsról viszont kötelező biztonsági mentést
készíteni, mert nélküle ugyanaz az alkalmazás később nem frissíthető.

## Ellenőrzések

```bash
npm test
npm run validate:data
npm run build
npm run android:check
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
- `public`: webes ikonok és statikus fájlok
- `android`: natív Capacitor Android-projekt
- `assets`: a natív ikon- és splash-generálás forrásképe
