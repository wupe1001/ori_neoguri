# Ori Neoguri Backend

`SPECIFICATION.md` 1.1을 구현한 Express + SQLite 백엔드입니다. 세션은 서버 메모리에 저장되며, 판단/생성 모델은 FactChat BAZE Gateway를 사용합니다.

## 최초 설정

PowerShell 기준입니다.

```powershell
Copy-Item .env.example .env
Copy-Item db/seed.example.json db/seed.json
```

`.env`의 다음 값은 반드시 실제 값으로 바꿉니다.

- `SESSION_SECRET`
- `BAZE_API_KEY`
- `GENERATION_MODEL`
- 네 개의 신뢰도 기준값(실제 학교 질문 표본으로 평가한 값)

`db/seed.json`에는 닉네임을 포함한 실제 교사/학생 계정, 학생의 담임 교사, 과목 담당 교사를 입력합니다. 시드 구조나 관계가 잘못되면 서버는 시작하지 않습니다. 기존 DB에 사용자가 있으면 시드는 다시 적용되지 않으며, 닉네임 컬럼 추가 마이그레이션 시 기존 계정은 로그인 ID를 임시 닉네임으로 사용합니다.

```powershell
npm install
npm start
```

- 서버: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api-docs`
- DB만 먼저 초기화: `npm run db:init`
