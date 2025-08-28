# VerShip

🚀 **VerShip** - 모던 버전 관리 및 릴리즈 자동화 도구

Changesets 기반의 세밀한 버전 관리부터 완전 자동화된 배포까지, 개발팀의 릴리즈 프로세스를 혁신합니다.

## ✨ 주요 기능

### 🔄 Changeset 관리

- **대화형 변경사항 추가**: `vership add`로 쉽고 빠른 changeset 생성
- **타입별 분류**: major, minor, patch 변경사항을 명확히 구분
- **유효성 검증**: 모든 changeset 파일의 무결성 확인
- **편집 및 삭제**: 언제든지 changeset 수정 가능

### 📋 상태 관리

- **실시간 상태 확인**: 현재 버전, 대기 중인 변경사항, 예상 다음 버전
- **JSON 출력**: CI/CD 파이프라인 완벽 호환
- **배포 가능성 검증**: 릴리즈 준비 상태 자동 확인

### 🏷️ 버전 관리

- **Semantic Versioning**: 자동 버전 계산 및 업데이트
- **CHANGELOG 자동 생성**: 4가지 템플릿 지원 (기본, GitHub, Conventional, 커스텀)
- **Git 통합**: 자동 커밋 및 태그 생성

### 🚀 배포 자동화

- **완전 자동화**: 빌드 → 테스트 → 태그 → NPM → GitHub Release
- **선택적 실행**: 원하는 단계만 골라서 실행
- **CI/CD 최적화**: GitHub Actions 완벽 지원
- **롤백 기능**: 배포 실패 시 자동 롤백

## 🛠️ 설치

```bash
npm install -g vership
# 또는
npx vership
```

## 📖 사용법

### 1. 변경사항 추가

```bash
# 대화형으로 changeset 추가
vership add

# 명령줄 옵션으로 빠른 추가
vership add --type patch --message "로그인 버그 수정"
```

### 2. 현재 상태 확인

```bash
# 사람이 읽기 쉬운 형태로 출력
vership status

# CI용 JSON 출력
vership status --output json
```

### 3. 버전 업데이트

```bash
# 대화형 버전 업데이트
vership version

# CI 환경에서 자동 실행
vership version --ci
```

### 4. 배포 실행

```bash
# 완전 자동 배포
vership publish

# 시뮬레이션 (실제 배포 없음)
vership publish --dry-run

# CI 환경에서 자동 배포
vership publish --ci

# 선택적 단계 건너뛰기
vership publish --skip-test --skip-github-release
```

## 🔧 설정

### Changelog 템플릿 설정

```bash
# 대화형 템플릿 설정
vership changelog

# 특정 템플릿 사용
vership changelog --template github
```

### 사용 가능한 템플릿:

- **default**: 기본 마크다운 형식
- **github**: GitHub 스타일 (자동 링크 포함)
- **conventional**: Conventional Commits 형식
- **custom**: 커스텀 Handlebars 템플릿

## 🤖 CI/CD 통합

### GitHub Actions

```yaml
name: Release
on:
    push:
        branches: [main]

jobs:
    check:
        runs-on: ubuntu-latest
        outputs:
            needs_release: ${{ steps.check.outputs.needs_release }}
        steps:
            - uses: actions/checkout@v4
            - name: Check release status
              id: check
              run: |
                  STATUS=$(npx vership status --output=json)
                  NEEDS_RELEASE=$(echo $STATUS | jq -r '.needsRelease')
                  echo "needs_release=$NEEDS_RELEASE" >> $GITHUB_OUTPUT

    release:
        needs: check
        if: needs.check.outputs.needs_release == 'true'
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - name: Publish
              run: npx vership publish --ci
              env:
                  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 📋 명령어 레퍼런스

### `vership add`

새로운 changeset을 추가합니다.

**옵션:**

- `--type <type>`: 변경 타입 (major|minor|patch)
- `--message <message>`: 변경사항 설명

### `vership status`

프로젝트의 현재 릴리즈 상태를 확인합니다.

**옵션:**

- `--output <format>`: 출력 형식 (text|json)

### `vership version`

버전을 업데이트하고 changelog를 생성합니다.

**옵션:**

- `--dry-run`: 실제 변경 없이 미리보기
- `--skip-confirm`: 확인 프롬프트 건너뛰기
- `--ci`: CI 모드

### `vership publish`

패키지를 배포합니다.

**옵션:**

- `--dry-run`: 배포 시뮬레이션
- `--skip-confirm`: 사용자 확인 건너뛰기
- `--skip-build`: 빌드 과정 건너뛰기
- `--skip-test`: 테스트 과정 건너뛰기
- `--skip-git-push`: Git 태그 푸시 건너뛰기
- `--skip-npm-publish`: NPM 배포 건너뛰기
- `--skip-github-release`: GitHub Release 생성 건너뛰기
- `--ci`: CI 환경에서 실행
- `--output <type>`: 출력 형식 (text|json)
- `--registry <url>`: NPM 레지스트리 URL
- `--access <type>`: 패키지 접근 권한 (public|restricted)
- `--tag <name>`: NPM 배포 태그

### `vership changelog`

체인지로그 생성 방식을 설정합니다.

**옵션:**

- `--template <template>`: 사용할 템플릿
- `--interactive`: 대화형 설정 모드

## 🔍 고급 사용법

### 배포 프로세스 커스터마이징

```bash
# 테스트만 건너뛰고 배포
vership publish --skip-test

# NPM 배포 없이 Git 태그만
vership publish --skip-npm-publish

# GitHub Release 없이 배포
vership publish --skip-github-release

# 완전 수동 모드 (모든 자동화 비활성화)
vership publish --skip-git-push --skip-npm-publish --skip-github-release
```

### CI 환경 최적화

```bash
# CI에서 릴리즈 필요 여부만 확인
if [ "$(npx vership status --output json | jq -r '.needsRelease')" == "true" ]; then
  npx vership publish --ci
fi
```

## 🛡️ 안전 기능

- **사전 검증**: Git 상태, 빌드, 테스트 자동 확인
- **롤백 지원**: 배포 실패 시 Git 태그 자동 롤백
- **Dry-run 모드**: 실제 실행 전 시뮬레이션
- **단계별 건너뛰기**: 위험한 단계 선택적 비활성화

## 📊 워크플로우

```
개발 → changeset 추가 → 상태 확인 → 버전 업데이트 → 배포
  ↓      ↓            ↓           ↓         ↓
 add    status      version       publish    완료!
```

## 🤝 기여하기

이슈 리포트, 기능 제안, Pull Request 모두 환영합니다!

## 📄 라이선스

MIT License
