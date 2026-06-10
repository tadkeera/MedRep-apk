# Med Rep — Android App Source Code | كود مصدر تطبيق الأندرويد

تطبيق أندرويد (WebView + خادم محلي مدمج) يغلّف تطبيق الويب **Med-Rep-Waleed** كما هو 100% بدون أي تعديل على ملفاته.

## 📂 بنية المشروع | Project Structure

```
source-code/
├── Med-Rep-Waleed/                  ← كود الويب الأصلي (clone من GitHub) — عدّل هنا واجهات/منطق التطبيق
│   ├── src/                         ← مكونات React (الصفحات، الفواتير، الزيارات، الخرائط...)
│   ├── public/                      ← manifest.json + service worker
│   ├── server.ts                    ← خادم Express + نقاط Gemini AI
│   └── package.json
│
├── android-app/                     ← مشروع الأندرويد (غلاف APK)
│   ├── AndroidManifest.xml          ← الصلاحيات (GPS + التخزين) واسم التطبيق
│   ├── src/com/medrep/app/
│   │   └── MainActivity.java        ← كل المنطق الأصلي:
│   │                                   • خادم HTTP محلي يقدّم ملفات الويب من assets/www
│   │                                   • منح صلاحية GPS للـ WebView تلقائياً
│   │                                   • إنشاء مجلدي  /Med Rep/backup  و  /Med Rep/download
│   │                                   • جسر JS يحفظ النسخ الاحتياطية والملفات فعلياً للهاتف
│   ├── assets/www/                  ← نسخة الويب المبنية (مخرجات vite build) — تُعرض داخل التطبيق
│   ├── res/                         ← الأيقونات (mipmap) + الستايل
│   ├── icon_src.png                 ← الأيقونة الأصلية عالية الدقة
│   └── build-apk.sh                 ← سكربت بناء APK كامل (بدون Android Studio)
│
└── medrep.keystore                  ← مفتاح التوقيع (كلمة السر: medrep123) — ضروري للتحديثات
```

## 🔧 كيف تعدّل التطبيق؟ | How to Modify

### أ) تعديل واجهات/منطق التطبيق (الصفحات، النصوص، الميزات):
1. عدّل الملفات داخل `Med-Rep-Waleed/src/`
2. أعد بناء الويب:
   ```bash
   cd Med-Rep-Waleed
   npm install
   npx vite build
   ```
3. انسخ الناتج إلى مشروع الأندرويد:
   ```bash
   rm -rf ../android-app/assets/www
   cp -r dist ../android-app/assets/www
   ```
4. أعد بناء الـ APK (انظر أدناه)

### ب) تعديل الجزء الأندرويدي (الصلاحيات، اسم التطبيق، المجلدات، الأيقونة):
- الصلاحيات والاسم: `android-app/AndroidManifest.xml`
- منطق المجلدات (backup/download) والجسر: `android-app/src/com/medrep/app/MainActivity.java`
  - اسم المجلد الرئيسي: ثابت `APP_FOLDER = "Med Rep"`
- الأيقونة: استبدل `res/mipmap-*/ic_launcher.png` (المقاسات: 48/72/96/144/192)

## 📦 بناء الـ APK | Build the APK

### المتطلبات:
- JDK 11 أو أحدث
- Android SDK مع: `build-tools;34.0.0` و `platforms;android-34`
  ```bash
  sdkmanager "build-tools;34.0.0" "platforms;android-34"
  ```

### البناء:
```bash
cd android-app
cp ../medrep.keystore .        # مفتاح التوقيع
export ANDROID_SDK_ROOT=/path/to/android-sdk
bash build-apk.sh
# الناتج: MedRep.apk
```

> **مهم:** استخدم نفس `medrep.keystore` (كلمة السر `medrep123`) في كل إصدار حتى يقبل الهاتف التحديث فوق النسخة القديمة بدون حذفها.

## 🛠 بديل: استخدام Android Studio
يمكنك أيضاً إنشاء مشروع Android Studio فارغ (Empty Views Activity, package `com.medrep.app`) ثم نسخ:
- `AndroidManifest.xml` → مع دمج الصلاحيات
- `MainActivity.java` → إلى `app/src/main/java/com/medrep/app/`
- `assets/` → إلى `app/src/main/assets/`
- `res/mipmap-*` و `res/values/styles.xml` → إلى `app/src/main/res/`

## ℹ️ ملاحظات تقنية
- التطبيق يعمل عبر خادم HTTP محلي على `127.0.0.1` (منفذ عشوائي) = سياق آمن يسمح بعمل GPS وlocalStorage وIndexedDB بشكل كامل.
- مزامنة تلقائية كل 3 ثوانٍ: أي ملف في سجل التطبيق الافتراضي (BACKUP/DOWNLOAD) يُكتب فعلياً إلى `/Med Rep/backup/` أو `/Med Rep/download/`.
- أي تنزيل `blob:` (مثل PDF من jsPDF أو CSV) يُلتقط ويُحفظ في `/Med Rep/download/`.
- ميزات الذكاء الاصطناعي (`/api/ai/...`) تتطلب خادم `server.ts` يعمل على الإنترنت مع مفتاح `GEMINI_API_KEY`؛ باقي التطبيق يعمل أوفلاين بالكامل.
