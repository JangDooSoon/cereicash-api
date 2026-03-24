/**
 * CEREICASH - NH농협 오픈뱅킹 백엔드 API 서버
 * 
 * 환경변수 설정 필요:
 *   NH_CLIENT_ID      : NH 오픈뱅킹 Client ID
 *   NH_CLIENT_SECRET  : NH 오픈뱅킹 Client Secret
 *   NH_ACCESS_TOKEN   : NH 오픈뱅킹 Access Token
 *   NH_ACCOUNT_NO     : 출금 계좌번호 (예: 3125821379791)
 *   PORT              : 서버 포트 (기본 3001)
 */

const express = require('express');
const cors    = require('cors');
const axios   = require('axios');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));

// ── 환경변수 ──────────────────────────────────────────────
const NH_API_BASE    = 'https://developers.nonghyup.com';
const CLIENT_ID      = process.env.NH_CLIENT_ID      || '';
const CLIENT_SECRET  = process.env.NH_CLIENT_SECRET  || '';
const ACCESS_TOKEN   = process.env.NH_ACCESS_TOKEN   || '';
const ACCOUNT_NO     = process.env.NH_ACCOUNT_NO     || '3125821379791';
const ISCD           = '051400'; // 기관코드 (농협)

// ── 유틸 ─────────────────────────────────────────────────
function getDate() {
  return new Date().toISOString().slice(0,10).replace(/-/g,'');
}
function getTime() {
  return new Date().toTimeString().slice(0,8).replace(/:/g,'');
}
function generateSeqNo() {
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
function makeHeader(apiNm) {
  return {
    ApiNm:       apiNm,
    Tsymd:       getDate(),
    Trtm:        getTime(),
    Iscd:        ISCD,
    FintechApsno:'001',
    ApiSvcCd:    'DrawingTransferA',
    IsTuno:      generateSeqNo(),
    AccessToken: ACCESS_TOKEN
  };
}

// ── 헬스체크 ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'CEREICASH API 서버 정상 작동 중',
    time: new Date().toISOString(),
    account: ACCOUNT_NO,
    iscd: ISCD
  });
});

// ── 잔액 조회 ─────────────────────────────────────────────
app.get('/api/balance', async (req, res) => {
  try {
    const r = await axios.post(`${NH_API_BASE}/InquireBalance`, {
      Header:   makeHeader('InquireBalance'),
      DrtrRgyn: 'Y',
      BrdtBrno: '',
      Bncd:     '011',
      Acno:     ACCOUNT_NO
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });

    res.json({ success: true, data: r.data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// ── 거래내역 조회 ─────────────────────────────────────────
app.get('/api/transactions', async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const r = await axios.post(`${NH_API_BASE}/InquireTransactionHistory`, {
      Header:  makeHeader('InquireTransactionHistory'),
      Bncd:    '011',
      Acno:    ACCOUNT_NO,
      Inqscd:  '1',
      Inqstdt: startDate || getDate(),
      Inqendt: endDate   || getDate(),
      Trtm:    ''
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });

    res.json({ success: true, data: r.data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// ── 이체 실행 (출금이체 - DrawingTransfer) ────────────────
app.post('/api/transfer', async (req, res) => {
  const { toBank, toAccount, toName, amount, memo } = req.body;

  if (!toAccount || !toName || !amount) {
    return res.status(400).json({ success: false, error: '필수 파라미터 누락: toAccount, toName, amount' });
  }

  const seqNo = generateSeqNo();
  try {
    const r = await axios.post(`${NH_API_BASE}/DrawingTransfer`, {
      Header:    makeHeader('DrawingTransfer'),
      Bncd:      toBank    || '011',
      Acno:      toAccount.replace(/-/g,''),
      Tram:      String(amount),
      DractOtlt: memo || 'CEREICASH',
      MractOtlt: toName
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });

    res.json({ success: true, data: r.data, seqNo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.response?.data || err.message, seqNo });
  }
});

// ── 법인 급여 일괄 이체 ───────────────────────────────────
// body: { employees: [{account, name, bank, amount}], memo }
app.post('/api/payroll', async (req, res) => {
  const { employees, memo } = req.body;

  if (!Array.isArray(employees) || employees.length === 0) {
    return res.status(400).json({ success: false, error: '직원 목록이 필요합니다' });
  }

  const results = [];
  for (const emp of employees) {
    const seqNo = generateSeqNo();
    try {
      const r = await axios.post(`${NH_API_BASE}/DrawingTransfer`, {
        Header:    makeHeader('DrawingTransfer'),
        Bncd:      emp.bank    || '011',
        Acno:      emp.account.replace(/-/g,''),
        Tram:      String(emp.amount),
        DractOtlt: memo || 'JGW법인급여',
        MractOtlt: emp.name
      }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });

      results.push({ name: emp.name, account: emp.account, amount: emp.amount, success: true, data: r.data, seqNo });
    } catch (err) {
      results.push({ name: emp.name, account: emp.account, amount: emp.amount, success: false, error: err.response?.data || err.message, seqNo });
    }
    // 연속 이체 간 100ms 대기 (API 제한 방지)
    await new Promise(r => setTimeout(r, 100));
  }

  const successCount = results.filter(r => r.success).length;
  res.json({ success: true, total: employees.length, successCount, failCount: employees.length - successCount, results });
});

// ── Access Token 갱신 ─────────────────────────────────────
app.post('/api/refresh-token', async (req, res) => {
  try {
    const r = await axios.post(`${NH_API_BASE}/oauth/2.0/token`, null, {
      params: {
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope:         'DrawingTransfer',
        grant_type:    'client_credentials'
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    });
    res.json({ success: true, data: r.data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// ── 서버 시작 ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ CEREICASH API 서버 실행 중: http://localhost:${PORT}`);
  console.log(`   기관코드: ${ISCD}`);
  console.log(`   계좌번호: ${ACCOUNT_NO}`);
  console.log(`   Client ID: ${CLIENT_ID ? CLIENT_ID.slice(0,8)+'...' : '미설정'}`);
  console.log(`   Access Token: ${ACCESS_TOKEN ? ACCESS_TOKEN.slice(0,8)+'...' : '미설정'}`);
});

module.exports = app;
