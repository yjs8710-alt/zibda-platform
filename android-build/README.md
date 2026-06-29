# Zibda (집다) — Android AAB 빌드 가이드

이 문서는 GitHub Export 후 **GitHub Actions 클라우드 빌드** 또는 본인 PC에서
Google Play Console 업로드용 **서명된 release AAB** 파일을 만들기까지의 전 과정을 정리한 것입니다.

> PC의 Android Studio/Gradle에서 `AEADBadTagException` 다운로드 오류가 반복되면
> 아래 **A. GitHub Actions 클라우드 빌드**를 사용하세요. 최종 결과물은
> `app-release.aab` 이며 Google Play Console에 바로 업로드할 수 있습니다.

---

## A. GitHub Actions로 app-release.aab 생성 (권장)

### A-1. GitHub에 프로젝트 연결

Lovable에서 GitHub Export를 완료하면 저장소에 아래 파일이 포함됩니다.

- `.github/workflows/android-release-aab.yml`
- `android-build/ci/prepare-capacitor-android.mjs`
- `resources/icon.png`
- `resources/splash.png`

워크플로우는 클라우드에서 다음 작업을 자동 수행합니다.

1. 웹 앱 빌드
2. Capacitor Android 프로젝트 생성/동기화
3. 패키지명 `kr.co.zibda.app` 적용
4. 앱 이름 `집다 (Zibda)` 적용
5. Android 권한 적용: 인터넷, 카메라, 사진, 위치, 전화, 알림
6. 아이콘/스플래시 생성
7. release 서명
8. `app-release.aab` 생성 및 다운로드 아티팩트 업로드

### A-2. release keystore 생성 (1회만)

로컬 PC에서 아래 명령으로 서명 키를 한 번만 생성합니다.

```bash
keytool -genkey -v \
  -keystore zibda-release.keystore \
  -alias zibda \
  -keyalg RSA -keysize 2048 -validity 10000
```

⚠️ `zibda-release.keystore` 파일과 비밀번호는 앱 업데이트에 계속 필요하므로 절대 분실하면 안 됩니다.

### A-3. keystore를 Base64로 변환

Mac/Linux:

```bash
base64 -w 0 zibda-release.keystore > keystore-base64.txt
```

Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("zibda-release.keystore")) | Set-Content keystore-base64.txt
```

### A-4. GitHub Secrets 등록

GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret** 에 아래 4개를 등록합니다.

| Secret 이름 | 값 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `keystore-base64.txt` 안의 전체 문자열 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 생성 시 입력한 비밀번호 |
| `ANDROID_KEY_ALIAS` | `zibda` |
| `ANDROID_KEY_PASSWORD` | alias/key 비밀번호 |

### A-5. AAB 빌드 실행

GitHub 저장소 → **Actions → Build Android release AAB → Run workflow**

- `version_code`: 처음은 `1`, Play Console에 새 버전을 올릴 때마다 `2`, `3`처럼 증가
- `version_name`: 예: `1.0.0`

빌드가 끝나면 실행 결과 화면 하단 **Artifacts**에서
`zibda-google-play-app-release-aab`를 다운로드합니다.

압축을 풀면 아래 파일이 있습니다.

```text
app-release.aab
app-release.aab.sha256
```

`app-release.aab`를 Google Play Console의 앱 번들 업로드 영역에 올리면 됩니다.

---

## B. PC에서 직접 빌드하는 방법

## 0. 준비물 (PC에 설치)

| 항목 | 버전 |
| --- | --- |
| Node.js | 20 LTS 이상 |
| JDK | 17 (Android Studio 내장 사용 가능) |
| Android Studio | 최신 (Hedgehog 이상) |
| Android SDK | API 34 (compileSdk 34) |

---

## 1. 프로젝트 가져오기

```bash
# Lovable 오른쪽 위 → GitHub → Export 후
git clone <your-repo-url> zibda
cd zibda
npm install
npm run build        # dist/ 폴더 생성
```

---

## 2. Capacitor 설정 (이미 적용됨)

다음 파일이 저장소에 포함되어 있습니다:

- `capacitor.config.ts`
  - `appId`: **kr.co.zibda.app**
  - `appName`: **집다**
  - `server.url`: **https://zibda.co.kr** ← 시작 URL
  - `allowNavigation`: zibda.co.kr / jibda.co.kr / Kakao / Supabase 허용

추가로 설치된 네이티브 플러그인:

```
@capacitor/core, @capacitor/cli, @capacitor/android
@capacitor/camera, @capacitor/geolocation
@capacitor/app, @capacitor/browser, @capacitor/push-notifications
```

> 푸시알림(Firebase) 연동은 출시 이후 별도 진행 예정. 플러그인만 미리 설치되어 있습니다.

---

## 3. Android 플랫폼 추가

```bash
npx cap add android
npx cap sync android
```

`android/` 폴더가 새로 생성됩니다.

---

## 4. AndroidManifest 권한 추가

`android/app/src/main/AndroidManifest.xml` 파일을 열고,
**`<manifest ...>` 바로 아래 / `<application>` 위**에
`android-build/AndroidManifest-permissions.xml` 파일의 내용을 통째로 붙여넣습니다.

붙여 넣어야 하는 권한:

- 인터넷 / 네트워크 상태
- 카메라, 사진(READ_MEDIA_IMAGES / READ_EXTERNAL_STORAGE ≤32)
- 위치 (FINE / COARSE)
- 전화걸기 (CALL_PHONE)
- 알림 (POST_NOTIFICATIONS, VIBRATE)
- `<queries>` (tel:, mailto:, https: 외부 인텐트)

그리고 `<application ...>` 태그 속성이 다음과 같은지 확인:

```xml
<application
    android:label="집다"
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:usesCleartextTraffic="false"
    ...>
```

---

## 5. 앱 아이콘 적용

가장 쉬운 방법 — **@capacitor/assets 자동 생성** (권장):

```bash
npm i -D @capacitor/assets

# 프로젝트 루트에 resources/ 폴더 만들고 아래 파일 배치
#   resources/icon.png          (1024 x 1024, 알파 없음, 정사각형)
#   resources/icon-foreground.png  (1024 x 1024, 알파 있음, 가운데 로고)
#   resources/icon-background.png  (1024 x 1024, 단색 배경)
#   resources/splash.png        (2732 x 2732, 가운데 로고)

npx capacitor-assets generate --android
```

→ `android/app/src/main/res/mipmap-*` 모든 해상도 아이콘 자동 생성됨.

**수동으로 교체할 경우 경로:**

```
android/app/src/main/res/
  mipmap-mdpi/ic_launcher.png            (48x48)
  mipmap-hdpi/ic_launcher.png            (72x72)
  mipmap-xhdpi/ic_launcher.png           (96x96)
  mipmap-xxhdpi/ic_launcher.png          (144x144)
  mipmap-xxxhdpi/ic_launcher.png         (192x192)
  mipmap-anydpi-v26/ic_launcher.xml      (Adaptive icon 정의)
```

Play Console 등록용 **512×512 고해상도 아이콘**은
Lovable 다운로드 파일 `zibda-icon-512.png` 를 그대로 업로드하면 됩니다.

---

## 6. 앱 버전 설정

`android/app/build.gradle` 의 `defaultConfig` 블록 확인:

```gradle
defaultConfig {
    applicationId "kr.co.zibda.app"
    minSdkVersion 23
    targetSdkVersion 34
    compileSdk 34
    versionCode 1          // 업로드할 때마다 +1
    versionName "1.0.0"
}
```

---

## 7. 서명 키스토어 생성 (1회만)

```bash
keytool -genkey -v \
  -keystore zibda-release.keystore \
  -alias zibda \
  -keyalg RSA -keysize 2048 -validity 10000
```

⚠️ **이 keystore 파일과 비밀번호는 절대 분실 금지.**
Play Store 업데이트 시 같은 키로 서명해야 합니다.

---

## 8. 서명 설정 추가

`android/app/build.gradle` 의 `android { ... }` 블록에 추가:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file("../../zibda-release.keystore")
            storePassword System.getenv("ZIBDA_KS_PWD")
            keyAlias "zibda"
            keyPassword System.getenv("ZIBDA_KEY_PWD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'),
                          'proguard-rules.pro'
        }
    }
}
```

빌드 전 환경변수 지정:

```bash
export ZIBDA_KS_PWD='키스토어비번'
export ZIBDA_KEY_PWD='키알리아스비번'
```

(Windows PowerShell: `$env:ZIBDA_KS_PWD="..."`)

---

## 9. AAB 빌드

```bash
npm run build              # 웹 빌드
npx cap sync android       # dist 동기화
cd android
./gradlew bundleRelease    # Mac/Linux
# 또는: gradlew.bat bundleRelease   (Windows)
```

결과물 위치:

```
android/app/build/outputs/bundle/release/app-release.aab
```

→ 이 파일을 Google Play Console **앱 번들** 영역에 업로드.

---

## 10. Android Studio에서 열어 GUI로 빌드하는 경우

```bash
npx cap open android
```

상단 메뉴: **Build → Generate Signed Bundle / APK → Android App Bundle**
키스토어 선택 → release → Finish.

---

## 11. Play Console 등록 정보

| 항목 | 값 |
| --- | --- |
| 앱 이름 | 집다 (Zibda) |
| 패키지명 | kr.co.zibda.app |
| 카테고리 | 비즈니스 / 부동산 |
| 개인정보처리방침 URL | https://zibda.co.kr/privacy |
| 서비스 약관 URL | https://zibda.co.kr/terms |
| 데이터 보안 | 카메라, 사진, 위치, 연락처(전화) 권한 사용 명시 |
| 콘텐츠 등급 설문 | 대상 연령에 맞게 답변 |
| 아이콘 (512×512) | zibda-icon-512.png |
| 그래픽 이미지 (1024×500) | 별도 제작 필요 |
| 스크린샷 (최소 2장, 16:9 또는 9:16) | 실제 앱 화면 캡처 |

---

## 12. 자주 발생하는 문제

- **`Default FirebaseApp is not initialized`** → 푸시알림 미설정 상태에서 무시 가능. 출시 차단 안 됨.
- **WebView에서 카메라/위치 권한 안 뜸** → AndroidManifest 권한 누락. 4번 단계 재확인.
- **카카오지도 흰 화면** → `allowNavigation` 에 `*.daumcdn.net`, `*.kakao.com` 포함 여부 확인 (이미 적용됨).
- **release 빌드 실패 (signing)** → 환경변수 설정 또는 절대경로로 keystore 지정.

---

## 13. 푸시알림 추가 (출시 후)

`@capacitor/push-notifications` 플러그인은 이미 설치되어 있으므로,
나중에 Firebase 프로젝트만 만들어 `google-services.json` 을 추가하고
`device_tokens` 테이블 + Edge Function 으로 발송 로직만 붙이면 됩니다.
