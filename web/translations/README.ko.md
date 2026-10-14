# LUXIPANEL

2026년 10월 13일 검토

LUXIPANEL은 사용자의 Linux 서버에서 로컬 자원과 SSH 대상을 관리합니다. LP-LICENSE-SERVER는 luxipanel.com의 계정, 결제, 토큰, 모듈 카탈로그 및 편집 서비스를 제공합니다. 계정 생성은 패널 설치나 서버 등록이 아닙니다.

[en](../README.md) | [es](../translations/README.es.md) | [fr](../translations/README.fr.md) | [de](../translations/README.de.md) | [it](../translations/README.it.md) | [pt](../translations/README.pt.md) | [ru](../translations/README.ru.md) | [ar](../translations/README.ar.md) | [hi](../translations/README.hi.md) | [bn](../translations/README.bn.md) | [ja](../translations/README.ja.md) | [ko](../translations/README.ko.md)

## 설치 전 준비

관리자 권한, 호스트 이름, 정상 DNS를 갖춘 Debian/Ubuntu가 필요합니다. 현재 패키지는 Node.js 22.12 이상과 pnpm 11.5.0을 지정합니다. Redis, nginx 및 활성 모듈이 사용하는 서비스를 준비하세요. install.sh는 종속 항목을 설치하고 시스템 설정을 바꾸므로 먼저 검토하세요.

## 설치 및 로그인

LUXIPANEL 저장소에서 자신의 도메인으로 설치 프로그램을 실행하세요. 공개 TLS 환경은 --https, 필요한 경우 --cloudflare를 사용합니다. DNS와 유효한 인증서를 설정하고 /login에서 기존 Linux 사용자로 로그인하세요. 조건을 충족하는 첫 sudo/wheel 사용자가 관리자가 될 수 있습니다. 현재는 단일 자체 호스팅 모드이며 기존 managed 설정은 현행 절차가 아닙니다.

```bash
sudo bash install.sh --domain panel.example.com --https
```

## 로컬 접근

패널은 Linux 사용자를 인증하고 역할과 모듈 권한을 적용합니다. 웹 자격 증명과 계정 API 키는 Linux 로그인을 대체하지 않습니다. 로컬 실행기는 LUXIPANEL이 설치된 머신에서 동작합니다.

## 작업 전 대상 선택

패널에서 로컬 서버 또는 SSH 연결을 선택합니다. 파일, 터미널, 서비스 등 지원 작업은 기능과 권한에 따라 선택한 대상에서 실행됩니다. 쓰기, 재시작, 삭제 전에 대상 이름을 확인하세요.

## SSH 대상 추가 및 사용

패널 서버 선택기에 호스트, 포트, SSH 사용자와 자격 증명을 입력합니다. 자격 증명은 해당 패널에 암호화되어 저장되며 제거된 웹 서버 목록에는 저장되지 않습니다. 대상을 확인하고 전환한 뒤 변경 전 읽기를 테스트하세요. SSH 연결이 모든 OS의 모든 모듈 지원을 보장하지는 않습니다.

## 연결 문제 확인

네트워크, SSH 포트, 자격 증명과 원격 사용자 권한을 확인합니다. 사설 주소는 서버 정책으로 제한되며 SERVERS_ALLOW_PRIVATE는 적법한 내부망용 관리자 설정입니다. 문제를 피하려고 호스트 검증을 끄거나 비밀을 노출하지 마세요. 만료된 세션은 다시 연결합니다.

## 이름이 있는 API 키 만들기

웹 계정의 보안 → API KEY에서 보안 검사를 마치고 알아보기 쉬운 이름을 입력합니다. 표시된 비밀 값을 복사해 설치된 LUXIPANEL의 API KEY에 입력하세요. luxipanel.com에서 서버, IP 또는 SSH 자격 증명을 선택하지 않습니다. 키는 허용된 서비스에서 계정을 식별합니다.

## 키 교체 및 폐기

전체 비밀 값은 생성 또는 교체 시에만 표시됩니다. 교체 후 이를 사용하는 모든 설치에서 갱신하세요. 폐기는 인증을 중단하고 해당 키의 활성 모듈 구독을 취소합니다. 키를 스크린샷, 로그, 저장소 또는 지원 메시지에 노출하지 마세요.

## 모듈 설치 및 관리

패널의 모듈에서 카탈로그, 권한, 종속 항목과 제공 여부를 확인하고 역할에 따라 활성화하거나 설치합니다. 기본 기능과 마켓플레이스 모듈은 요구 사항이 다를 수 있습니다. 유료 구독 전에 실제 가격과 조건을 확인하세요.

## 패널에서 통합 설정

Cloudflare는 DNS와 영역, GitHub는 저장소, Expo는 EAS를 설정합니다. 도우미 공급자와 커넥터는 활성화 시 제공됩니다. 각 통합에는 자체 자격 증명과 권한이 필요합니다. 기존 웹 클라우드 서버 가져오기와 관리형 하위 도메인은 현재 설정 경로가 아닙니다.

## 모바일: 패널 직접 접속

설치된 LUXIPANEL URL을 추가하고 연결을 선택한 뒤 패널/Linux 사용자로 로그인합니다. 현재 앱은 React Native 기본 모듈 화면을 사용합니다. 로그인 기억 기능은 Linux 암호가 아닌 세션 데이터를 보안 저장소에 보관합니다. 기능은 선택한 서버와 권한에 따라 다릅니다.

## 데스크톱: 프로필과 탭

패널 이름과 URL을 저장하고 연결을 테스트한 뒤 탭을 엽니다. Desktop은 격리된 Electron 뷰에서 해당 패널의 웹 화면을 표시합니다. 같은 프로필의 탭은 세션을 공유하고 다른 프로필은 저장소가 분리됩니다. URL을 변경하면 이전 저장 데이터가 지워집니다. 창을 닫으면 트레이에 남으며 종료를 선택해야 앱이 끝납니다.

## 업데이트 및 복구

설정과 암호화된 자격 증명을 백업하세요. 저장소 키를 바꾸면 기존 자격 증명을 읽을 수 없으므로 보관해야 합니다. 한 머신에서 한 프로젝트씩 빌드하세요. Astro는 dist를 비우고 NODE_OPTIONS=--max-old-space-size=2560으로 빌드한 뒤 프로세스 재시작과 HTTP 검사를 수행합니다. PM2 환경 변경 시 --only 및 --update-env로 ecosystem 설정을 다시 평가하세요.

## 유용한 오류 보고

제품, 클라이언트 및 패널 버전, 시간, 대상, 정확한 오류, 재현 단계와 기대 결과를 적고 비밀을 지운 화면이나 로그를 첨부하세요. 암호, 개인 키, 전체 API 키, 쿠키 또는 2단계 복구 코드는 보내지 마세요.

## 관련 안내

- [Self-hosting](../SELF-HOSTING.md)
- [Despliegue](../DESPLIEGUE-STANDALONE.md)
- [Module SDK](../MODULE-SDK-SPEC.md)
- [Testing](../TESTING.md)
- [Contributing](../CONTRIBUTING.md)
- [Security](../SECURITY.md)
- [License](../LICENSE)
