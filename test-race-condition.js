const axios = require('axios');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const CONCURRENT_REQUESTS = 20;
const VIEW_LIMIT = 10;

async function createTestZap() {
  try {
    const response = await axios.post(`${BASE_URL}/api/zaps/upload`, {
      type: 'text',
      name: 'Race Condition Test',
      textContent: 'Testing concurrent access',
      viewLimit: VIEW_LIMIT
    });
    
    console.log('✅ Test Zap Created');
    console.log(`Short URL: ${response.data.data.shortUrl}`);
    return response.data.data.shortUrl.split('/').pop();
  } catch (error) {
    console.error('❌ Failed to create test zap:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Server is not running!');
      console.error('   Start server with: npm run dev');
    } else if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

async function accessZap(shortId, requestNum) {
  try {
    const response = await axios.get(`${BASE_URL}/api/zaps/${shortId}`, {
      headers: { 'Accept': 'application/json' }
    });
    return { success: true, requestNum, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      requestNum, 
      status: error.response?.status,
      message: error.response?.data?.message 
    };
  }
}

async function testRaceCondition() {
  console.log('\n🧪 Starting Race Condition Test\n');
  console.log(`Configuration:`);
  console.log(`- Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`- View Limit: ${VIEW_LIMIT}\n`);

  // Create test zap
  const shortId = await createTestZap();
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log(`\n🚀 Sending ${CONCURRENT_REQUESTS} concurrent requests...\n`);
  
  // Send concurrent requests
  const promises = [];
  for (let i = 1; i <= CONCURRENT_REQUESTS; i++) {
    promises.push(accessZap(shortId, i));
  }
  
  const results = await Promise.all(promises);
  
  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const viewLimitErrors = failed.filter(r => r.status === 410);
  
  console.log('📊 Test Results:\n');
  console.log(`✅ Successful requests: ${successful.length}`);
  console.log(`❌ Failed requests: ${failed.length}`);
  console.log(`🚫 View limit errors (410): ${viewLimitErrors.length}\n`);
  
  // Verdict
  console.log('🎯 Verdict:\n');
  
  if (successful.length === VIEW_LIMIT && viewLimitErrors.length === (CONCURRENT_REQUESTS - VIEW_LIMIT)) {
    console.log('✅ PASS: Race condition is FIXED!');
    console.log(`   - Exactly ${VIEW_LIMIT} requests succeeded`);
    console.log(`   - Exactly ${CONCURRENT_REQUESTS - VIEW_LIMIT} requests were blocked`);
    console.log('   - Atomic operation working correctly\n');
    return true;
  } else if (successful.length > VIEW_LIMIT) {
    console.log('❌ FAIL: Race condition still EXISTS!');
    console.log(`   - Expected ${VIEW_LIMIT} successful requests`);
    console.log(`   - Got ${successful.length} successful requests`);
    console.log(`   - ${successful.length - VIEW_LIMIT} requests bypassed the limit\n`);
    return false;
  } else {
    console.log('⚠️  INCONCLUSIVE: Unexpected results');
    console.log(`   - Expected ${VIEW_LIMIT} successful requests`);
    console.log(`   - Got ${successful.length} successful requests\n`);
    return false;
  }
}

// Run test
testRaceCondition()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test failed with error:', error.message);
    process.exit(1);
  });
