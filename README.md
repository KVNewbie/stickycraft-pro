# 📌 StickyCraft Pro - 전문가용 스티커 메모 앱

> **"포스트잇의 친근한 아날로그 감성 + 전문가용 노트 앱의 무한한 확장성"**  
> Google Play(Android) 및 Apple App Store(iOS) 동시 출시 지원 크로스플랫폼 앱

---

## 🌟 주요 특징 및 차별화 기능

1. **무제한 글자 수 & 개별 스티커 내부 부드러운 스크롤**
   - 글자 수 제한 없이 수만 자의 장문 기록도 자유롭게 작성 가능
   - 스티커 고유의 비율을 유지하면서 카드 내부에서 부드럽게 스크롤 지원
   - 카드를 탭하여 전체 화면 모달에서 시원하게 열람 및 편집

2. **고해상도 멀티 사진 첨부**
   - 메모 하나당 여러 장의 사진 첨부 가능
   - 스티커 상단에 미니 썸네일 슬라이더 렌더링
   - 탭 시 고화질 풀스크린 라이트박스 뷰어로 확대 열람

3. **듀얼 뷰 모드 (Dual View Mode)**
   - **[자유 캔버스 보드 뷰]**: 화이트보드/코르크보드 위에서 스티커를 손가락으로 드래그하여 자유롭게 이동 및 마인드맵 배치
   - **[스마트 그리드 뷰]**: Google Keep 스타일의 다단 메이슨리 그리드로 정돈된 탐색

4. **아날로그 감성 스티커 디자인**
   - 실제 포스트잇 파스텔 컬러 12종 (옐로우, 민트, 피치, 코랄, 라벤더, 로즈 등)
   - 스티커 장식 스타일 (마스킹 테이프, 골드/레드 압정 핀, 모서리 접힘, 미니멀 카드)
   - 자연스러운 미세 회전 각도 및 부드러운 종이 그림자

5. **전문가용 생산성 도구**
   - 인터랙티브 할 일 체크리스트 (To-Do List)
   - 워크스페이스 보드 분리 (업무, 일상, 아이디어, 스터디 등) 및 새 보드 무제한 추가
   - 해시태그(#) 자동 등록 및 원클릭 태그 필터링
   - 핀 고정(Pin to top), 실시간 통합 검색, 색상별/사진별 필터링
   - 데이터 오프라인 로컬 저장 (AsyncStorage) 및 JSON 백업/복원

6. **배너 광고 (Google AdMob) 통합 슬롯**
   - UX를 해치지 않도록 하단 Safe Area에 최적화된 고정형 배너
   - Google 공식 AdMob 테스트 광고 단위 탑재
   - 실제 배포 시 상용 Ad Unit ID 교체만으로 즉시 광고 수익화 가능

---

## 🚀 빠른 시작 및 테스트 방법

### 1) 개발 서버 실행
```bash
# 기본 Expo 개발 서버 실행 (모바일 Expo Go 앱으로 QR 스캔 가능)
npm start

# 웹 브라우저에서 즉시 실행
npm run web
```

- 웹 브라우저 접속: **http://localhost:8081**
- 스마트폰(Android/iPhone) 테스트: App Store 또는 Google Play에서 **Expo Go** 앱 설치 후 터미널에 뜨는 QR 코드 스캔

---

## 📱 스토어 배포 (Google Play & Apple App Store)

본 프로젝트는 최신 Expo Application Services (EAS) 기반으로 구성되어 있어 간단한 명령어로 양대 마켓 스토어 빌드가 가능합니다.

### 1) EAS CLI 설치 및 로그인
```bash
npm install -g eas-cli
eas login
```

### 2) 빌드 설정 초기화
```bash
eas build:configure
```

### 3) 안드로이드 구글 플레이 빌드 (.aab / .apk)
```bash
# 구글 플레이 스토어 제출용 AAB 빌드
eas build --platform android

# 기기 직접 설치용 APK 빌드
eas build --platform android --profile preview
```

### 4) 애플 앱스토어 빌드 (.ipa)
```bash
eas build --platform ios
```

---

## 💰 Google AdMob 실제 광고 단위 연동 방법

`src/components/AdBannerSlot.tsx` 파일에서 발급받으신 AdMob 배너 광고 단위 ID를 입력하시면 즉시 실제 상용 광고가 송출됩니다:

```typescript
export const ADMOB_PROD_UNIT_IDS = {
  android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // 발급받은 안드로이드 배너 ID
  ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ',     // 발급받은 iOS 배너 ID
};
```

---

## 📁 프로젝트 구조

```
Note app/
├── App.tsx                     # 메인 엔트리 및 화면 조합 (헤더, 뷰, 배너, 모달)
├── app.json                    # Expo 앱 메타데이터 및 권한/스토어 설정
├── index.ts                    # 앱 진입점
├── package.json                # 의존성 및 스크립트
└── src/
    ├── types/
    │   └── note.ts             # 스티커 메모, 보드, 태그 데이터 모델
    ├── constants/
    │   ├── colors.ts           # 12가지 파스텔 스티커 색상 및 테마 설정
    │   └── mockData.ts         # 가이드 예시 스티커 메모 데이터
    ├── store/
    │   └── useNoteStore.ts     # Zustand 로컬 영속화 스토어 (CRUD, 검색, 필터, 캔버스 좌표)
    └── components/
        ├── Header.tsx          # 브랜드 헤더, 듀얼 뷰 스위치, 보드 탭
        ├── SearchBar.tsx       # 실시간 검색 및 다채로운 필터 툴바
        ├── StickyCard.tsx      # 개별 스티커 카드 (무제한 텍스트, 내부 스크롤, 사진, 테이프/핀)
        ├── GridView.tsx        # 반응형 스마트 메이슨리 그리드 뷰
        ├── CanvasView.tsx      # 2D 자유 드래그 캔버스 보드 뷰 (PanResponder 제스처)
        ├── NoteEditorModal.tsx # 고도화된 작성/수정 모달 (사진 첨부, 체크리스트, 팔레트)
        ├── ImageViewerModal.tsx# 고화질 사진 풀스크린 라이트박스 뷰어
        ├── BackupSettingsModal.tsx # JSON 백업/복원 및 앱 설정 모달
        └── AdBannerSlot.tsx    # Google AdMob 배너 광고 슬롯
```
