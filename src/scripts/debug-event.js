import { ethers } from "ethers";
import ValidatorsABI from "../abi/Validators.abi.json" assert { type: "json" };

// Script untuk debug struktur event yang sebenarnya
async function debugEvents() {
  const RPC_URL = process.env.RPC_URL || 'https://rpc-data.oorthnexus.xyz';
  const CONTRACT_ADDRESS = process.env.VALIDATORS_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000001000';

  console.log('🔍 Event Structure Debugger');
  console.log('===========================');
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log('');

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ValidatorsABI, provider);

    // Get ABI event definitions
    console.log('📋 Event Definitions from ABI:');
    console.log('===============================');
    
    const eventDefinitions = ValidatorsABI.filter(item => item.type === 'event');
    
    eventDefinitions.forEach(event => {
      console.log(`\n📍 Event: ${event.name}`);
      console.log(`   Inputs: ${event.inputs.length}`);
      event.inputs.forEach((input, index) => {
        console.log(`   [${index}] ${input.name}: ${input.type} ${input.indexed ? '(indexed)' : ''}`);
      });
    });

    console.log('\n\n🔍 Checking RewardDistributed Event Structure:');
    console.log('==============================================');
    
    const rewardDistributedEvent = eventDefinitions.find(e => e.name === 'RewardDistributed');
    if (rewardDistributedEvent) {
      console.log('✅ RewardDistributed event found in ABI:');
      console.log(JSON.stringify(rewardDistributedEvent, null, 2));
      
      // Check if we can create filter
      try {
        const filter = contract.filters.RewardDistributed();
        console.log('✅ Filter created successfully');
        console.log('Filter topics:', filter.topics);
      } catch (error) {
        console.log('❌ Error creating filter:', error.message);
      }
    } else {
      console.log('❌ RewardDistributed event not found in ABI');
    }

    console.log('\n\n🎧 Listening for Events (30 seconds):');
    console.log('====================================');
    
    // Listen to RewardDistributed events
    const eventFilter = contract.filters.RewardDistributed();
    
    contract.on(eventFilter, (...args) => {
      console.log('\n🎉 RewardDistributed Event Received:');
      console.log('===================================');
      
      const event = args[args.length - 1];
      const eventArgs = args.slice(0, -1);
      
      console.log('📊 Event Info:');
      console.log(`   Block: ${event.blockNumber}`);
      console.log(`   TX: ${event.transactionHash}`);
      console.log(`   Block Hash: ${event.blockHash}`);
      
      console.log('\n📦 Raw Arguments:');
      eventArgs.forEach((arg, index) => {
        console.log(`   [${index}] Type: ${typeof arg}`);
        console.log(`   [${index}] Value: ${arg}`);
        console.log(`   [${index}] String: ${arg.toString()}`);
        
        if (Array.isArray(arg)) {
          console.log(`   [${index}] Array Length: ${arg.length}`);
          arg.forEach((item, i) => {
            console.log(`     [${i}] ${item} (${typeof item})`);
          });
        }
        console.log('');
      });
      
      console.log('🔧 Parsing Attempt:');
      try {
        const validators = eventArgs[0];
        const rewards = eventArgs[1];
        const rewardCount = eventArgs[2];
        
        console.log('   Validators:', Array.isArray(validators) ? validators.map(v => v.toString()) : validators);
        console.log('   Rewards:', Array.isArray(rewards) ? rewards.map(r => ethers.formatEther(r)) : rewards);
        console.log('   Reward Count:', rewardCount.toString());
        
      } catch (parseError) {
        console.log('   ❌ Parse Error:', parseError.message);
      }
    });

    // Listen to any event for comparison
    contract.on('*', (event) => {
      if (event.eventName && event.eventName !== 'RewardDistributed') {
        console.log(`\n📢 Other Event: ${event.eventName} (Block: ${event.blockNumber})`);
      }
    });

    // Wait for events
    console.log('⏳ Waiting for events... (Press Ctrl+C to stop)');
    
    // Keep script running
    setTimeout(() => {
      console.log('\n⏰ Debugging session completed');
      process.exit(0);
    }, 30000);

  } catch (error) {
    console.error('❌ Debug Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  debugEvents();
}

export { debugEvents };