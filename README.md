# Nuggs Farm

A cartoon animal breeding game for the browser and Android. Walk around your farm, build habitats, and breed, raise and show 68 species, from Pugs and French Bulldogs to Blue-and-gold Macaws, turtles, quokkas and snow leopards.

## Features

- A walkable farm with a farmer you control (tap to walk, drag to steer, or WASD and arrow keys). Every animal you own is visible in its enclosure, wandering, playing, eating, sleeping or flying between perches.
- 68 species across 8 habitats: Kennel, Cattery, Aviary, Hutch, Terrarium, Pond, Paddock and Wildlife Sanctuary.
- Genetics: babies inherit vigour, charm and smarts from their parents, plus traits such as Fertile, Lucky or Sickly. Selective breeding raises your bloodline to five stars.
- Colour mutations (Golden, Albino, Melanistic, Frost, Cosmic and the very rare Rainbow).
- Seven secret cross-species pairings that produce breed-only species.
- Customer orders, timed Show Ring championships, random events (heatwaves, storms, a fox on the prowl), staff, a day and night cycle, daily rewards, 17 guided goals and 20 achievements.
- Animals need feeding, clean habitats and vet care. Neglect brings the welfare inspector.
- Progress saves on the device, with save codes to move a farm between devices.

## Playing locally

```
npm install
npm run dev      # http://localhost:5173
npm test         # headless engine simulation test
```

The game is plain HTML, CSS and JavaScript modules in `www/`. There is no build step.

## Android

```
npm run apk      # syncs www/ into android/ and builds a signed release APK
```

Building needs the Android SDK and JDK 21 (Android Studio's bundled JDK works). The APK lands in `android/app/build/outputs/apk/release/`.

Release signing reads `keystore/keystore.properties` locally, or the `NF_KEYSTORE_*` environment variables in CI. The `keystore/` folder is git-ignored. Keep a backup of it: every future update must be signed with the same key or Android will refuse to install it over the old version.

## Releases and the update channel

On launch, the Android app checks the latest GitHub Release of `nugggy/nuggs-farm` and offers to download the new APK. The web version checks `version.json` and offers a reload.

To ship an update:

```
npm run version -- 1.0.1 "What changed"
git commit -am "Release 1.0.1"
git tag v1.0.1
git push && git push --tags
```

Pushing to `main` redeploys the web game to GitHub Pages. Pushing a `v*` tag builds the signed APK and publishes it as a release. The release workflow needs these repository secrets:

| Secret | Value |
| --- | --- |
| `NF_KEYSTORE_BASE64` | The keystore file, base64 encoded |
| `NF_KEYSTORE_PASSWORD` | Keystore password |
| `NF_KEY_ALIAS` | `nuggsfarm` |
| `NF_KEY_PASSWORD` | Key password |

## Credits

The animals are drawn in code (`www/js/art.js`). The real-life photos shown in the Encyclopaedia come from Wikimedia Commons and are used under their individual free licences (CC BY, CC BY-SA, CC0, public domain and GFDL). The resized copies in `www/img/animals/` keep those licences. Authors and licences are listed in `www/js/credits.js` and on the in-game credits screen.

Fonts: Fredoka and Nunito, SIL Open Font License.
