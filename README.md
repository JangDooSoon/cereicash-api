# CEREICASH API 서버

NH농협 오픈뱅킹 API를 이용한 CEREICASH 백엔드 서버입니다.

## 기능

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/health` | GET | 서버 상태 확인 |
| `/api/balance` | GET | 계좌 잔액 조회 |
| `/api/transactions` | GET | 거래내역 조회 |
| `/api/transfer` | POST | 단건 이체 |
| `/api/payroll` | POST | 법인 급여 일괄 이체 |
| `/api/refresh-token` | POST | Access Token 갱신 |

## 환경변수 설정

`.env.example` 파일을 `.env`로 복사하고 값을 입력하세요:

```
NH_CLIENT_ID=발급받은_CLIENT_ID
NH_CLIENT_SECRET=발급받은_CLIENT_SECRET
NH_ACCESS_TOKEN=발급받은_ACCESS_TOKEN
NH_ACCOUNT_NO=3125821379791
PORT=3001
```

## 실행

```bash
npm install
npm start
```

## 배포 (Railway)

1. Railway 대시보드에서 GitHub 저장소 연결
2. 환경변수 설정 (위 항목들)
3. 자동 배포 완료

## 이체 API 사용 예시

```json
POST /api/transfer
{
  "toBank": "011",
  "toAccount": "312-1234-5678-90",
  "toName": "홍길동",
  "amount": 100000,
  "memo": "CEREICASH 이체"
}
```

## 급여 일괄 이체 예시

```json
POST /api/payroll
{
  "employees": [
    { "account": "312-1234-5678-90", "name": "홍길동", "bank": "011", "amount": 3000000 },
    { "account": "110-1234-567890", "name": "김철수", "bank": "004", "amount": 2500000 }
  ],
  "memo": "JGW법인 2025년 1월 급여"
}
```
