#!/bin/sh
# Semua file sumber ada di folder yang sama. Pakai: KS_PASS=... sh build.sh
set -e
cd "$(dirname "$0")"
JAR=/usr/lib/android-sdk/platforms/android-23/android.jar
rm -rf build && mkdir -p build/classes build/src build/assets build/res/values build/res/drawable-nodpi
cp MainActivity.java build/src/
cp index.html config.js online.js build/assets/
cp strings.xml build/res/values/
cp icon.png build/res/drawable-nodpi/
cp AndroidManifest.xml build/
if [ -n "$VERSION_CODE" ]; then
  sed -i "s/android:versionCode=\"[0-9]*\"/android:versionCode=\"$VERSION_CODE\"/" build/AndroidManifest.xml
fi
javac -nowarn --release 8 -encoding utf-8 -cp $JAR -d build/classes build/src/MainActivity.java
dalvik-exchange --dex --output=build/classes.dex build/classes
aapt package -f -M build/AndroidManifest.xml -S build/res -A build/assets -I $JAR -0 arsc -F build/unsigned.apk
(cd build && aapt add unsigned.apk classes.dex >/dev/null)
zipalign -f -p 4 build/unsigned.apk build/aligned.apk
apksigner sign --ks sapaloka.keystore --ks-key-alias sapaloka --ks-pass env:KS_PASS --out Sapaloka.apk build/aligned.apk
echo "Jadi: Sapaloka.apk"
