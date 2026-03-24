const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const NH_API_BASE = 'https://developers.nonghyup.com';
const CLIENT_ID     = process.env.NH_CLIENT_ID;
const ACCESS_TOKEN  = process.env.NH_ACCESS_TOKEN;

// 일련번호 생성 (14자리: YYYYMMDDHHMMSS)
function generateSeqNo() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// 날짜 포맷
function getDate() {
  return new Date().toISOString().slice(0,10).replace(/-/g,'');
}
function getTime() {
  return new Date().toTimeString().slice(0,8).replace(/:/g,'');
}

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'CEREICASH API 서버 정상 작동 중', time: new Date().toISOString() });
});

// 잔액 조회
app.get('/api/balance', async (req, res) => {
  try {
    const response = await axios.post(`${NH_API_BASE}/InquireBalance`, {
      Header: {
        ApiNm: 'InquireBalance',
        Tsymd: getDate(),
        Trtm: getTime(),
        Iscd: CLIENT_ID,
        FintechApsno: '001',
        ApiSvcCd: 'DrawingTransferA',
        IsTuno: generateSeqNo(),
        AccessToken: ACCESS_TOKEN
      },
      DrtrRgyn: 'Y',
      BrdtBrno: '',
      Bncd: '011',
      Acno: '3125821379791'
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    res.json({ success: true, data: response.data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// 이체 실행 (출금이체 - DrawingTransfer)
app.post('/api/transfer', async (req, res) => {
  const { toBank, toAccount, toName, amount, memo } = req.body;
  if (!toAccount || !toName || !amount) {
    return res.status(400).json({ success: false, error: '필수 파라미터 누락 (toAccount, toName, amount)' });
  }
  try {
    const seqNo = generateSeqNo();
    const response = await axios.post(`${NH_API_BASE}/DrawingTransfer`, {
      Header: {
        ApiNm: 'DrawingTransfer',
        Tsymd: getDate(),
        Trtm: getTime(),
        Iscd: CLIENT_ID,
        FintechApsno: '001',
        ApiSvcCd: 'DrawingTransferA',
        IsTuno: seqNo,
        AccessToken: ACCESS_TOKEN
      },
      Bncd: toBank || '011',
      Acno: toAccount.replace(/-/g, ''),
      Tram: String(amount),
      DractOtlt: memo || 'CEREICASH',
      MractOtlt: toName
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    res.json({ success: true, data: response.data, seqNo });
  } catch (err) {
    const errData = err.response?.data;
    res.status(500).json({ success: false, error: errData || err.message });
  }
});

// 거래내역 조회
app.get('/api/transactions', async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const response = await axios.post(`${NH_API_BASE}/InquireTransactionHistory`, {
      Header: {
        ApiNm: 'InquireTransactionHistory',
        Tsymd: getDate(),
        Trtm: getTime(),
        Iscd: CLIENT_ID,
        FintechApsno: '001',
        ApiSvcCd: 'DrawingTransferA',
        IsTuno: generateSeqNo(),
        AccessToken: ACCESS_TOKEN
      },
      Bncd: '011',
      Acno: '3125821379791',
      Inqscd: '1',
      Inqstdt: startDate || getDate(),
      Inqendt: endDate || getDate(),
      Trtm: ''
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    res.json({ success: true, data: response.data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

module.exports = app;

// 로컬 실행 시
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`✅ CEREICASH API 서버 실행 중: http://localhost:${PORT}`);
  });
}
