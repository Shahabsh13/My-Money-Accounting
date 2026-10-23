const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Kotlin and Compose are configured alongside the existing Android app', () => {
  const rootGradle = read('build.gradle');
  const appGradle = read('app/build.gradle');
  const workflow = read('.github/workflows/build-debug-apk.yml');

  assert.match(rootGradle, /org\.jetbrains\.kotlin\.android' version '2\.2\.0' apply false/);
  assert.match(rootGradle, /org\.jetbrains\.kotlin\.plugin\.compose' version '2\.2\.0' apply false/);
  assert.match(appGradle, /id 'org\.jetbrains\.kotlin\.android'/);
  assert.match(appGradle, /id 'org\.jetbrains\.kotlin\.plugin\.compose'/);
  assert.match(appGradle, /jvmTarget\s*=\s*'17'/);
  assert.match(appGradle, /buildFeatures\s*\{\s*compose true\s*\}/);
  assert.match(appGradle, /androidx\.compose:compose-bom:2024\.12\.01/);
  assert.match(appGradle, /androidx\.activity:activity-compose:1\.9\.3/);
  assert.match(appGradle, /androidx\.compose\.material3:material3/);
  assert.match(appGradle, /testImplementation 'junit:junit:4\.13\.2'/);
  assert.ok(workflow.includes('./gradlew --no-daemon testDebugUnitTest'),
    'CI must run the Kotlin/JVM unit tests before building the debug APK');
  assert.ok(workflow.indexOf('testDebugUnitTest') < workflow.indexOf('assembleDebug'),
    'Kotlin/JVM unit tests must run before the APK build');
});

test('the existing WebView launcher is preserved and the Native preview is debug-only', () => {
  const productionManifest = read('app/src/main/AndroidManifest.xml');
  const debugManifest = read('app/src/debug/AndroidManifest.xml');
  const previewSource = read('app/src/debug/java/com/maymoney/app/nativepreview/NativeMigrationPreviewActivity.kt');

  assert.match(productionManifest, /android:name="\.MainActivity"[\s\S]*?android:exported="true"[\s\S]*?android.intent.action.MAIN[\s\S]*?android.intent.category.LAUNCHER/);
  assert.doesNotMatch(productionManifest, /NativeMigrationPreviewActivity/);
  assert.match(debugManifest, /android:name="\.nativepreview\.NativeMigrationPreviewActivity"/);
  assert.match(previewSource, /class NativeMigrationPreviewActivity\s*:\s*ComponentActivity/);
  assert.match(previewSource, /CompositionLocalProvider\(LocalLayoutDirection provides LayoutDirection\.Rtl\)/);
  assert.match(previewSource, /پیش‌نمایش آزمایشی Kotlin و Compose/);
  assert.match(previewSource, /بستن پیش‌نمایش/);
});
