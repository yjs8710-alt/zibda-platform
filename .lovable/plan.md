# 구현 계획

## 1. 네이티브 스플래시 화면 (Zibda 그라데이션)

- `@capacitor/splash-screen` 설치 및 `capacitor.config.ts`에 plugins 설정 추가 (1500ms, 자동 숨김, fade out).
- `assets/splash.png` (2732×2732) 신규 생성: 딥블루→퍼플→핫핑크→오렌지 그라데이션 + 중앙 흰색 "Zibda" 텍스트.
- GitHub Actions 워크플로우(`.github/workflows/android-release-aab.yml`)에 `capacitor-assets generate --splash` 단계 추가 — 모든 `drawable-*/splash.png` 재생성.
- `android/app/src/main/res/values/styles.xml` 의 `AppTheme.NoActionBarLaunch` 가 `@drawable/splash` 사용하는지 확인.

## 2. 뒤로가기로 모달/문의 화면 종료

문제: 매물카드의 "문의하기", "협력공인중개사" 모달이 history에 push되지 않아 뒤로가기 시 모달이 닫히지 않고 페이지가 이동함.

- `src/hooks/useOverlayHistory.tsx` 신규: 모달 열림 시 `history.pushState`, popstate에서 닫기.
- 적용 대상:
  - `PropertyDetailPanel` 의 문의하기 모달
  - `GuestModals` (게스트 문의 모달)
  - `LandlordSearchModal`
  - `PublicRecordModal`
  - `InstallAppModal`
- 모든 모달의 `onOpenChange(false)` 시 `history.back()` 호출하지 않도록 가드 (popstate에서 닫힐 때는 skip).

## 3. 메인/하위 화면에서 뒤로가기 → 앱 종료

문제: 설치된 AAB에서 `useExitConfirm` 의 "종료" 버튼이 동작 안 함.

- 원인: `useExitConfirm` 은 `isMobile` (userAgent 기반) 으로만 분기 → Capacitor 환경 감지 누락. `App.exitApp()` import 가 동적 import 라 production에서 fail 가능.
- 수정: `Capacitor.isNativePlatform()` 으로 가드하고 `@capacitor/app` 정적 import. 네이티브에서는 `App.exitApp()` 직접 호출.
- 메인뿐 아니라 모든 1단계 라우트(`/`, `/residential`, `/commercial`, `/mypage` 등)에서 `useExitConfirm` 활성화.
- Capacitor `App.addListener('backButton')` 로 안드로이드 하드웨어 백버튼 직접 처리 (overlay 있으면 pop, 메인이면 종료 다이얼로그, 그 외엔 history.back).

## 4. 매물 등록 중개사와 1:1 채팅

현재 `chat_conversations` 는 `user_id` 만 가지고 관리자와의 채팅 전용. 매물별 중개사 채팅으로 확장.

### DB 마이그레이션
- `chat_conversations` 에 컬럼 추가:
  - `agent_user_id uuid references auth.users` (대화 상대 중개사, null = 관리자)
  - `property_id uuid references properties` (어느 매물 문의인지)
  - `unread_for_agent integer default 0`
- 인덱스: `(user_id, agent_user_id, property_id)` 유니크.
- RLS 정책 추가: 중개사도 본인이 `agent_user_id` 인 대화의 메시지 read/write 가능.
- `notify_agent_on_chat_message` 트리거: 새 user 메시지 INSERT 시 `notifications` 에 행 추가 (`type='chat_inquiry'`, link='/agent/chat/:conversationId').

### 프론트엔드
- `ChatInquiryWidget` 시그니처 확장: `open-chat-inquiry` 이벤트에 `{ agentUserId, propertyId }` 페이로드 전달.
- `PropertyCard` / `PropertyDetailPanel` 의 "채팅 문의하기" 버튼:
  ```
  window.dispatchEvent(new CustomEvent('open-chat-inquiry', { 
    detail: { agentUserId: property.registered_by, propertyId: property.id }
  }))
  ```
- `ensureConversation` 에서 `(user_id, agent_user_id, property_id)` 키로 조회/생성.
- 중개사용 채팅 인박스 페이지 `/agent/chat` 신규 — 본인이 받은 문의 대화 목록 + 채팅창.
- 알림 페이지(`NotificationsPage`) 에서 `chat_inquiry` 클릭 시 해당 대화로 이동.

## 5. 초기 로딩 속도 개선 (첫 진입)

- `src/App.tsx` 의 라우트들을 `React.lazy` + `Suspense` 로 분리 (현재 일부만 lazy). 모든 페이지 컴포넌트를 lazy 로 전환.
- `index.html` 에 critical CSS 인라인 + 큰 이미지 `loading="lazy"` 일괄 적용 확인.
- Vite 빌드 옵션: `build.rollupOptions.output.manualChunks` 로 react/react-dom, supabase, kakao-maps SDK 분리.
- Kakao Maps SDK 는 `Index`/`MapView` 진입 시에만 동적 로드 (이미 `kakaoMapsLoader` 있음 — 다른 곳에서 prefetch 하지 않는지 확인).
- `useDBProperties` 첫 fetch 시 `limit(50)` + 페이지네이션 (또는 viewport bounds 기반 로드).
- 폰트: 시스템 폰트 우선, `@fontsource` 만 사용.

## 6. 기술 노트

- 채팅 RLS 변경 후 기존 데이터 마이그레이션: 기존 `chat_conversations` 행은 `agent_user_id=null` (관리자 채팅) 유지.
- 스플래시 자산은 PNG 1개 → capacitor-assets 가 모든 mipmap/drawable 사이즈 생성.
- 백버튼 listener 는 React Router 와 충돌 가능 → Capacitor listener 에서 `event.canGoBack` 로직 우회하고 직접 history 관리.

## 7. 검증

- AAB 빌드 후 실기기에서:
  - 앱 시작 → Zibda 스플래시 1.5초 → 메인
  - 매물카드 → 문의하기 → 뒤로가기 → 모달만 닫힘
  - 메인에서 뒤로가기 → "종료하시겠습니까?" → 종료 → 앱 닫힘
  - 채팅 문의하기 → 매물 중개사와 대화 → 중개사 알림 수신
- Lighthouse 모바일 점수: 초기 진입 LCP 측정.
