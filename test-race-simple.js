const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const CONCURRENT_REQUESTS = 20;
const VIEW_LIMIT = 10;

function makeRequest(shortId) {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/zaps/${shortId}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ 
          success: res.statusCode === 200, 
          status: res.statusCode 
        });
      });
    });
    req.on('error', () => resolve({ success: false, status: 0 }));
  });
}

async function testRaceCondition(shortId) {
  console.log('\n🧪 Race Condition Test\n');
  console.log(`Testing shortId: ${shortId}`);
  console.log(`Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`Expected Limit: ${VIEW_LIMIT}\n`);
  
  console.log('🚀 Sending concurrent requests...\n');
  
  const promises = Array(CONCURRENT_REQUESTS).fill(0).map(() => makeRequest(shortId));
  const results = await Promise.all(promises);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => r.status === 410).length;
  
  console.log('📊 Results:\n');
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Blocked (410): ${failed}\n`);
  
  console.log('🎯 Verdict:\n');
  
  if (successful === VIEW_LIMIT && failed === (CONCURRENT_REQUESTS - VIEW_LIMIT)) {
    console.log('✅ PASS: Race condition FIXED!');
    console.log(`   Exactly ${VIEW_LIMIT} requests succeeded`);
    console.log(`   Atomic operation working correctly\n`);
  } else if (successful > VIEW_LIMIT) {
    console.log('❌ FAIL: Race condition EXISTS!');
    console.log(`   Expected: ${VIEW_LIMIT} successful`);
    console.log(`   Got: ${successful} successful`);
    console.log(`   Bypassed: ${successful - VIEW_LIMIT} requests\n`);
  } else {
    console.log('⚠️  INCONCLUSIVE');
    console.log(`   Expected: ${VIEW_LIMIT}, Got: ${successful}\n`);
  }
}

const shortId = process.argv[2];
if (!shortId) {
  console.log('Usage: node test-race-simple.js <shortId>');
  console.log('\nSteps:');
  console.log('1. Create a zap with viewLimit=10');
  console.log('2. Run: node test-race-simple.js <shortId>');
  process.exit(1);
}

testRaceCondition(shortId);
