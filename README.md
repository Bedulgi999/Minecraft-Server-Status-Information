# Minecraft Server Status (GitHub Pages + Bridge)
## 1) GitHub Pages
- `docs/` 폴더를 그대로 리포지토리에 올리고, Settings → Pages에서 `docs`를 선택하세요.
- `docs/app.js`에서 `SERVER_ADDRESS`, `BRIDGE_HTTP`를 설정하세요.

## 2) Admin Bridge
- `bridge/` 폴더는 마크 서버 PC에서 실행합니다.
- `bridge/README.md` 참고

## 포함 기능
- ✅ 서버 상태(온라인/플레이어/버전/MOTD) - public API
- ✅ 서버 설정 표시(difficulty 등) - bridge
- ✅ 실시간 로그 스트리밍(WebSocket) - bridge
- ✅ 플레이어 접속 히스토리 그래프(로컬 저장) - frontend
