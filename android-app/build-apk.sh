#!/usr/bin/env bash
# ============================================================
#  Med Rep — APK Build Script (no Gradle / no Android Studio needed)
#  Requirements:
#    - JDK 11+ (javac)
#    - Android SDK: build-tools 34.0.0  +  platforms/android-34
#  Usage:
#    1. Edit the SDK / JAVA paths below
#    2. (Optional) Rebuild the web app first — see step 0
#    3. bash build-apk.sh
#  Output: MedRep.apk  (signed, ready to install)
# ============================================================
set -e

# ------- EDIT THESE PATHS -------
SDK="${ANDROID_SDK_ROOT:-$HOME/android-sdk}"
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
KEYSTORE="medrep.keystore"        # signing key (password: medrep123)
# --------------------------------

# ------------------------------------------------------------
# STEP 0 (optional): rebuild the web app after editing it
#   cd ../Med-Rep-Waleed
#   npm install
#   npx vite build
#   rm -rf ../android-app/assets/www
#   cp -r dist ../android-app/assets/www
# ------------------------------------------------------------

echo "[1/6] Compiling resources (aapt2)..."
"$BT/aapt2" compile --dir res -o compiled_res.zip
"$BT/aapt2" link -o app-unsigned.apk -I "$PLATFORM" \
    --manifest AndroidManifest.xml -R compiled_res.zip \
    --java gen --auto-add-overlay -A assets

echo "[2/6] Compiling Java sources (javac)..."
mkdir -p classes
javac -classpath "$PLATFORM" -d classes $(find src gen -name "*.java")

echo "[3/6] Dexing (d8)..."
mkdir -p dexout
"$BT/d8" --release --lib "$PLATFORM" --output dexout $(find classes -name "*.class")

echo "[4/6] Packaging classes.dex into APK..."
cd dexout && zip -q ../app-unsigned.apk classes.dex && cd ..

echo "[5/6] Zipaligning..."
"$BT/zipalign" -f -p 4 app-unsigned.apk app-aligned.apk

echo "[6/6] Signing..."
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias medrep \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass medrep123 -keypass medrep123 \
    -dname "CN=Med Rep, OU=MedRep, O=MedRep, L=Sanaa, C=YE"
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias medrep \
    --ks-pass pass:medrep123 --key-pass pass:medrep123 \
    --out MedRep.apk app-aligned.apk

# cleanup intermediates
rm -rf classes dexout gen compiled_res.zip app-unsigned.apk app-aligned.apk

echo ""
echo "DONE ✓  ->  MedRep.apk"
