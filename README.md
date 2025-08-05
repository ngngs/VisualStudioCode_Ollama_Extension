# VSCode Ollama Extension

완전히 오프라인 환경에서 작동하는 VSCode Extension입니다.

## 개발 환경

- **VSCode 버전**: 1.52.1
- **Node.js 버전**: 12.14.1
- **운영체제**: Windows
- **언어**: TypeScript

## 주요 특징

- ✅ VSCode 내장 채팅 인터페이스
- ✅ 프로젝트 파일 컨텍스트 지원
- ✅ 채팅 히스토리 관리
- ✅ Ollama 서버 연결 및 설정
- ✅ 한국어 인터페이스
- ✅ 로컬 파일 시스템 접근

## 설치 방법

### 개발자용
1. 프로젝트 클론
```bash
git clone https://github.com/your-username/vsCode-ollama-extension.git
cd vsCode-ollama-extension
```

2. 의존성 설치
```bash
npm install
```

3. 개발 모드 실행
```bash
npm run watch
```

4. VSCode에서 F5를 눌러 디버그 모드로 실행

### 사용자용
1. VSCode에서 확장 프로그램 설치
2. Ollama 서버 실행 (기본: http://localhost:11434)
3. 명령 팔레트에서 "Ollama 서버 설정" 실행
4. "Ollama Chat 열기" 명령으로 채팅 시작

## 빌드 및 패키징

```bash
# 컴파일
npm run compile

# 린트 검사
npm run lint

# 테스트 실행
npm test

# 패키징 (vsce 필요)
vsce package
```

## 프로젝트 구조

```
vsCode-ollama-extension/
├── src/                    # 소스 코드
│   ├── extension.ts        # 메인 extension 파일
│   ├── commands/           # 명령어들
│   │   └── chatCommand.ts  # 채팅 명령어 처리
│   ├── providers/          # 제공자들
│   │   └── chatProvider.ts # 채팅 패널 제공자
│   └── utils/              # 유틸리티 함수들
│       ├── ollamaClient.ts # Ollama API 클라이언트
│       └── chatStorage.ts  # 채팅 저장소
├── out/                    # 컴파일된 JavaScript 파일
├── package.json            # extension 매니페스트
├── tsconfig.json           # TypeScript 설정
├── .eslintrc.js           # ESLint 설정
├── .prettierrc            # Prettier 설정
└── README.md              # 이 파일
```

## 사용 방법

### 1. Ollama 서버 설정
- 명령 팔레트 (Ctrl+Shift+P)에서 "Ollama 서버 설정" 실행
- Ollama 서버 주소 입력 (기본: http://localhost:11434)

### 2. 채팅 시작
- 명령 팔레트에서 "Ollama Chat 열기" 실행
- 왼쪽 사이드바에서 채팅 히스토리 확인
- "새 채팅" 버튼으로 새로운 대화 시작

### 3. 프로젝트 컨텍스트
- 현재 열린 파일들이 자동으로 컨텍스트에 포함됨
- Ollama가 프로젝트 파일을 참조하여 답변 생성

### 4. 채팅 히스토리
- 모든 대화는 자동으로 저장됨
- 왼쪽 사이드바에서 이전 대화 확인 및 재개 가능

## 개발 규칙

자세한 개발 규칙은 `.cursor/rules/` 디렉토리의 다음 파일들을 참조하세요:

- [vscode-extension-rules.mdc](./.cursor/rules/vscode-extension-rules.mdc) - 메인 개발 규칙
- [typescript-coding-standards.mdc](./.cursor/rules/typescript-coding-standards.mdc) - TypeScript 코딩 표준
- [offline-development.mdc](./.cursor/rules/offline-development.mdc) - 오프라인 개발 규칙
- [korean-localization.mdc](./.cursor/rules/korean-localization.mdc) - 한국어 현지화 규칙
- [package-configuration.mdc](./.cursor/rules/package-configuration.mdc) - 패키지 설정 규칙

## 라이선스

MIT License

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request 