import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidDir = path.join(root, 'android');
const appGradlePath = path.join(androidDir, 'app', 'build.gradle');
const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
const variablesPath = path.join(androidDir, 'variables.gradle');
const keystorePropertiesPath = path.join(androidDir, 'keystore.properties');

const requireFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${path.relative(root, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
};

const writeIfChanged = (filePath, next) => {
  const prev = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (prev !== next) fs.writeFileSync(filePath, next);
};

const findMatchingBrace = (text, openBraceIndex) => {
  let depth = 0;
  for (let i = openBraceIndex; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    if (text[i] === '}') depth -= 1;
    if (depth === 0) return i;
  }
  throw new Error('Could not parse android/app/build.gradle block braces.');
};

const findGradleBlock = (text, blockName, startIndex = 0, endIndex = text.length) => {
  const blockPattern = new RegExp(`\\b${blockName}\\s*\\{`, 'g');
  blockPattern.lastIndex = startIndex;
  const match = blockPattern.exec(text);
  if (!match || match.index >= endIndex) return null;
  const open = text.indexOf('{', match.index);
  if (open < 0 || open >= endIndex) return null;
  const close = findMatchingBrace(text, open);
  return { start: match.index, open, close };
};

const insertAfterManifestOpen = (xml, snippet) => {
  if (xml.includes('android.permission.POST_NOTIFICATIONS')) return xml;
  return xml.replace(/(<manifest\b[^>]*>)/, `$1\n${snippet}`);
};

const permissions = `
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.location" android:required="false" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />

    <queries>
        <intent>
            <action android:name="android.intent.action.DIAL" />
            <data android:scheme="tel" />
        </intent>
        <intent>
            <action android:name="android.intent.action.SENDTO" />
            <data android:scheme="mailto" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="https" />
        </intent>
    </queries>`;

let manifest = requireFile(manifestPath);
manifest = insertAfterManifestOpen(manifest, permissions);
manifest = manifest.replace(/android:label="[^"]*"/, 'android:label="집다 (Zibda)"');
if (!manifest.includes('android:usesCleartextTraffic=')) {
  manifest = manifest.replace(/(<application\b[^>]*)(>)/, '$1\n        android:usesCleartextTraffic="false"$2');
}
writeIfChanged(manifestPath, manifest);

let variables = requireFile(variablesPath);
variables = variables
  .replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 36')
  .replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 36')
  .replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 24');
writeIfChanged(variablesPath, variables);

const keystore = {
  storeFile: process.env.ANDROID_KEYSTORE_PATH || '../zibda-release.keystore',
  storePassword: process.env.ANDROID_KEYSTORE_PASSWORD,
  keyAlias: process.env.ANDROID_KEY_ALIAS || 'zibda',
  keyPassword: process.env.ANDROID_KEY_PASSWORD,
};

for (const [key, value] of Object.entries(keystore)) {
  if (!value) throw new Error(`Missing signing value: ${key}`);
}

writeIfChanged(
  keystorePropertiesPath,
  `storeFile=${keystore.storeFile}\nstorePassword=${keystore.storePassword}\nkeyAlias=${keystore.keyAlias}\nkeyPassword=${keystore.keyPassword}\n`,
);

let gradle = requireFile(appGradlePath);
if (!gradle.includes('def keystorePropertiesFile')) {
  gradle = `def keystoreProperties = new Properties()\ndef keystorePropertiesFile = rootProject.file("keystore.properties")\nif (keystorePropertiesFile.exists()) {\n    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))\n}\n\n${gradle}`;
}

gradle = gradle.replace(/namespace\s*=\s*"[^"]+"|namespace\s+"[^"]+"/, 'namespace = "kr.co.zibda.app"');
gradle = gradle.replace(/applicationId\s*=\s*"[^"]+"|applicationId\s+"[^"]+"/, 'applicationId "kr.co.zibda.app"');
gradle = gradle.replace(/versionCode\s*=\s*\d+|versionCode\s+\d+/, `versionCode ${process.env.ANDROID_VERSION_CODE || '1'}`);
gradle = gradle.replace(/versionName\s*=\s*"[^"]+"|versionName\s+"[^"]+"/, `versionName "${process.env.ANDROID_VERSION_NAME || '1.0.0'}"`);

if (!gradle.includes('signingConfigs {')) {
  gradle = gradle.replace(
    /(\n\s*buildTypes\s*\{)/,
    `\n    signingConfigs {\n        release {\n            storeFile file(keystoreProperties['storeFile'])\n            storePassword keystoreProperties['storePassword']\n            keyAlias keystoreProperties['keyAlias']\n            keyPassword keystoreProperties['keyPassword']\n        }\n    }\n$1`,
  );
}

const signingConfigsBlock = findGradleBlock(gradle, 'signingConfigs');
const signingConfigReleaseBlock = signingConfigsBlock
  ? findGradleBlock(gradle, 'release', signingConfigsBlock.open + 1, signingConfigsBlock.close)
  : null;
if (signingConfigReleaseBlock) {
  const body = gradle.slice(signingConfigReleaseBlock.open + 1, signingConfigReleaseBlock.close);
  const cleanedBody = body.replace(/\n\s*signingConfig\s+signingConfigs\.release/g, '');
  gradle = `${gradle.slice(0, signingConfigReleaseBlock.open + 1)}${cleanedBody}${gradle.slice(signingConfigReleaseBlock.close)}`;
}

const buildTypesBlock = findGradleBlock(gradle, 'buildTypes');
const buildTypeReleaseBlock = buildTypesBlock
  ? findGradleBlock(gradle, 'release', buildTypesBlock.open + 1, buildTypesBlock.close)
  : null;
if (!buildTypeReleaseBlock) throw new Error('Could not find buildTypes.release in android/app/build.gradle.');

const releaseBody = gradle.slice(buildTypeReleaseBlock.open + 1, buildTypeReleaseBlock.close);
const releaseBodyWithoutSigning = releaseBody.replace(/\n\s*signingConfig\s+signingConfigs\.release/g, '');
gradle = `${gradle.slice(0, buildTypeReleaseBlock.open + 1)}\n            signingConfig signingConfigs.release${releaseBodyWithoutSigning}${gradle.slice(buildTypeReleaseBlock.close)}`;

const finalSigningConfigsBlock = findGradleBlock(gradle, 'signingConfigs');
const finalSigningConfigReleaseBlock = finalSigningConfigsBlock
  ? findGradleBlock(gradle, 'release', finalSigningConfigsBlock.open + 1, finalSigningConfigsBlock.close)
  : null;
const finalBuildTypesBlock = findGradleBlock(gradle, 'buildTypes');
const finalBuildTypeReleaseBlock = finalBuildTypesBlock
  ? findGradleBlock(gradle, 'release', finalBuildTypesBlock.open + 1, finalBuildTypesBlock.close)
  : null;
const finalSigningConfigBody = finalSigningConfigReleaseBlock
  ? gradle.slice(finalSigningConfigReleaseBlock.open + 1, finalSigningConfigReleaseBlock.close)
  : '';
const finalBuildTypeBody = finalBuildTypeReleaseBlock
  ? gradle.slice(finalBuildTypeReleaseBlock.open + 1, finalBuildTypeReleaseBlock.close)
  : '';

if (!finalSigningConfigReleaseBlock || !finalBuildTypeReleaseBlock) {
  throw new Error('Release signing blocks were not created correctly in android/app/build.gradle.');
}
if (finalSigningConfigBody.includes('signingConfig signingConfigs.release')) {
  throw new Error('Invalid Gradle signing syntax: signingConfig was placed inside signingConfigs.release.');
}
if (!finalBuildTypeBody.includes('signingConfig signingConfigs.release')) {
  throw new Error('Invalid Gradle signing syntax: buildTypes.release is missing signingConfig signingConfigs.release.');
}

writeIfChanged(appGradlePath, gradle);
console.log('Prepared Capacitor Android project for signed Zibda release AAB.');