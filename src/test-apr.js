#!/usr/bin/env node
// ============================================================================
// APR CALCULATOR TESTING SCRIPT
// ============================================================================
// Script untuk test APR Calculator endpoints setelah integrasi
// ============================================================================

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3005';

// ========================================
// TEST CONFIGURATION - EASY TO MODIFY
// ========================================
const TEST_CONFIG = {
  // Test addresses (gunakan address yang valid di network Anda)
  DELEGATOR_ADDRESS: '0xA712bb5db820D4f118Ba6C1698C14331d19707E5',
  VALIDATOR_ADDRESS: '0x0000000000000000000000000000000000001000',
  
  // Test parameters
  BLOCK_TIME_1S: 1,
  BLOCK_TIME_5S: 5
};

/**
 * Test helper function
 */
async function testEndpoint(endpoint, method = 'GET', body = null) {
  try {
    console.log(`\n🧪 Testing: ${method} ${endpoint}`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success:', response.status);
      console.log('📊 Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Error:', response.status);
      console.log('💥 Error Response:', JSON.stringify(data, null, 2));
    }
    
    return { success: response.ok, data };
    
  } catch (error) {
    console.log('💀 Network Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Run all APR tests
 */
async function runAPRTests() {
  console.log('🚀 Starting APR Calculator Tests...');
  console.log('='.repeat(50));
  
  // Test 1: Health check
  await testEndpoint('/health');
  
  // Test 2: APR Config
  await testEndpoint('/api/apr/config');
  
  // Test 3: Average APR (1s block time)
  await testEndpoint(`/api/apr/average?blockTime=${TEST_CONFIG.BLOCK_TIME_1S}`);
  
  // Test 4: Average APR (5s block time)
  await testEndpoint(`/api/apr/average?blockTime=${TEST_CONFIG.BLOCK_TIME_5S}`);
  
  // Test 5: Individual APR calculation (1s)
  await testEndpoint(
    `/api/apr/delegator/${TEST_CONFIG.DELEGATOR_ADDRESS}/validator/${TEST_CONFIG.VALIDATOR_ADDRESS}?blockTime=${TEST_CONFIG.BLOCK_TIME_1S}`
  );
  
  // Test 6: Individual APR calculation (5s)
  await testEndpoint(
    `/api/apr/delegator/${TEST_CONFIG.DELEGATOR_ADDRESS}/validator/${TEST_CONFIG.VALIDATOR_ADDRESS}?blockTime=${TEST_CONFIG.BLOCK_TIME_5S}`
  );
  
  // Test 7: APR Comparison
  await testEndpoint(
    `/api/apr/delegator/${TEST_CONFIG.DELEGATOR_ADDRESS}/validator/${TEST_CONFIG.VALIDATOR_ADDRESS}/compare`
  );
  
  // Test 8: Minimum stake check
  await testEndpoint(
    `/api/apr/delegator/${TEST_CONFIG.DELEGATOR_ADDRESS}/validator/${TEST_CONFIG.VALIDATOR_ADDRESS}/stake-check`
  );
  
  // Test 9: Validator specific APR
  await testEndpoint(`/api/apr/validator/${TEST_CONFIG.VALIDATOR_ADDRESS}?blockTime=1`);
  
  // Test 10: Batch APR calculation
  await testEndpoint(
    `/api/apr/delegator/${TEST_CONFIG.DELEGATOR_ADDRESS}/batch`,
    'POST',
    {
      validatorAddresses: [TEST_CONFIG.VALIDATOR_ADDRESS],
      blockTime: 1
    }
  );
  
  // Test 11: Enhanced validator endpoint
  await testEndpoint(`/api/validators/${TEST_CONFIG.VALIDATOR_ADDRESS}?includeAPR=true`);
  
  // Test 12: Enhanced delegator endpoint  
  await testEndpoint(`/api/delegator/${TEST_CONFIG.DELEGATOR_ADDRESS}?includeAPR=true`);
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 APR Calculator Tests Completed');
}

/**
 * Quick validation test
 */
async function quickValidation() {
  console.log('⚡ Quick Validation Test');
  console.log('-'.repeat(30));
  
  const tests = [
    { name: 'Health Check', endpoint: '/health' },
    { name: 'APR Config', endpoint: '/api/apr/config' },
    { name: 'Average APR', endpoint: '/api/apr/average?blockTime=1' }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    const result = await testEndpoint(test.endpoint);
    if (result.success) {
      console.log(`✅ ${test.name}: PASSED`);
      passed++;
    } else {
      console.log(`❌ ${test.name}: FAILED`);
    }
  }
  
  console.log(`\n📊 Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All basic tests passed! APR Calculator is working');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details');
  }
}

// ========================================
// RUN TESTS BASED ON COMMAND LINE ARGS
// ========================================
const args = process.argv.slice(2);

if (args.includes('--quick') || args.includes('-q')) {
  quickValidation();
} else if (args.includes('--full') || args.includes('-f')) {
  runAPRTests();
} else {
  console.log('APR Calculator Test Script');
  console.log('Usage:');
  console.log('  node test-apr.js --quick   # Run quick validation tests');
  console.log('  node test-apr.js --full    # Run comprehensive tests');
  console.log('');
  console.log('Make sure your server is running on http://localhost:3005');
}