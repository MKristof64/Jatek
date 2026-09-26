# Az ivós játék

Mobil-first React + Vite partyjáték webes és natív Android-kiadással.
Egy telefonon és legfeljebb 15 résztvevős, PeerJS-alapú online szobában is
használható.

Az **1.3.0** kiadástól a Beállítások → Másik játék választása menüből a
**Darkroom** is megnyitható. A teljes Ország, Város felület az APK része,
26 témával, körönként 7 véletlen témával, hatjegyű online szobakóddal és
házigazdai pontjavítással. A közös szobákhoz internetkapcsolat szükséges.
Az ivós játék adatai és a Darkroom szobája elkülönülnek; játékváltáskor az
aktív szobából csak megerősítés után lehet kilépni.

A Darkroom szoba-API-ja: `https://darkroom.kristof-madarasz159.chatgpt.site/api/game`.
A meghívók a webes alkalmazás `?jatek=darkroom&szoba=123456` útvonalát használják,
és soha nem tartalmaznak játékostokent. Helyi Darkroom-szerverhez a
`VITE_DARKROOM_API_ORIGIN` fejlesztői környezeti változó adható meg.

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

## Átvitel másik gépre

Másik gépre a projekt forrásmappáját, a `package-lock.json` fájlt és – ha szükséges – a `releases/` mappában megőrzött APK-kat vidd át. Az új gépen futtasd:

```bash
npm ci
```

A `node_modules/`, `android/.gradle/` és `android/**/build/` könyvtárak újragenerálható függőségek és build-gyorsítótárak. Ezeket ne vidd át kézzel: nagyon hosszú útvonalakat tartalmazhatnak, és a mentést vagy másolást megnehezíthetik.

## Android-alkalmazás

A natív alkalmazás Capacitor 8 alapú. Android 7.0 vagy újabb rendszeren fut,
és a játékfelületen valódi, élre húzott teljes képernyőt használ. Alapból álló
nézetű, a beállításokban pedig 16:9, 4:3, 3:2 vagy 16:10 fekvő elrendezés
választható; az aktív képarány ismételt megnyomása visszaállítja az álló nézetet.

```bash
npm run android:check
npm run android:release
```

Az aláírt APK helye:
`android/app/build/outputs/apk/release/app-release.apk`. A Google Play Console-ba
feltölthető AAB itt készül el:
`android/app/build/outputs/bundle/release/app-release.aab`.

A natív frissítő az alkalmazáson belül tölti le a hitelesített, verziózott GitHub
APK-t egy elkülönített gyorsítótárba. A fájl SHA-256 lenyomatát, csomagnevét,
verzióját és kiadói aláírását is ellenőrzi, majd a `PackageInstaller` API-val
közvetlenül az Android telepítési jóváhagyását nyitja meg. Nem nyit böngészőt,
GitHub-oldalt vagy Letöltések felületet, és nem exportálja a telepítőt közös
tárhelyre. Az Android 8 vagy újabb rendszereken az első alkalommal engedélyezni
kell az appból történő telepítést. A rendszer jóváhagyása kötelező, nincs csendes
telepítés vagy biztonsági ellenőrzés megkerülése. Megszakítás után a frissítés
újraindítható, háttérbe lépés után a jóváhagyás az appba visszatéréskor folytatódik.

Az 1.2.8 vagy korábbi natív appok még a régi frissítőt tartalmazzák. Az 1.2.9-es
átállási kiadást egyszer a régi telepítési útvonalon kell feltenni; a későbbi
kiadások már az új appon belüli folyamatot használják.

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

### Böngészős regressziós tesztek

Futó helyi Vite szerver és Playwright szükséges. A `UI_BASE_URL` adja meg a
tesztelt alkalmazás címét (alapból `http://127.0.0.1:5180/Jatek/`). Külön
telepített Playwright esetén a `PLAYWRIGHT_MODULE_PATH`, meglévő Chromium
böngészőhöz a `UI_BROWSER_PATH` is megadható.

```bash
npm run test:ui
npm run test:flows
```

Az első teszt az összes beépített kártyát ellenőrzi 11 képernyő/képarány
kombináción, a második a játékoskezelést, szűrést, mentést, folytatást és
billentyűzetes kezelést. A `UI_TEST_ONLINE=1` a második tesztben egy ideiglenes
házigazda/vendég szobát is ellenőriz. A képek és a mérési jelentés az
`artifacts/ui-audit/` mappába kerülnek. A tesztfixture nem része a buildnek.

## Felépítés

- `src/pages`: alkalmazásképernyők
- `src/components`: újrahasznosítható felületi elemek
- `src/data`: beépített paklik és játékmódok
- `src/lib`: játékmenet-, teljesképernyő- és távoli kártyalogika
- `cloudflare/feedback-worker`: D1-alapú kártyakezelő és vezérlőközpont
- `public`: webes ikonok és statikus fájlok
- `android`: natív Capacitor Android-projekt
- `assets`: a natív ikon- és splash-generálás forrásképe
