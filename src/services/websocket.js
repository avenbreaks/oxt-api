import { ethers } from "ethers";
import ValidatorsABI from "../abi/Validators.abi.json";
import { Logger } from "../utils/logger.js";

export class WebSocketService {
  constructor(rpcUrl, contractAddress) {
    this.rpcUrl = rpcUrl;
    this.contractAddress = contractAddress;
    this.provider = null;
    this.contract = null;
    this.clients = new Set();
    this.eventFilters = new Map();
    this.isInitialized = false;
    this.logger = new Logger('WebSocket');
    this.blockLogging = process.env.LOG_BLOCKS === 'true';
    
    this.initialize();
  }

  async initialize() {
    try {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
      this.contract = new ethers.Contract(
        this.contractAddress,
        ValidatorsABI,
        this.provider
      );

      this.setupEventListeners();
      
      this.isInitialized = true;
      this.logger.success('WebSocket service initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize WebSocket service:', error);
      this.isInitialized = false;
    }
  }

  addClient(ws) {
    this.clients.add(ws);
    this.logger.info(`Client connected (${this.clients.size} total)`);
    
    ws.onclose = () => {
      this.clients.delete(ws);
      this.logger.info(`Client disconnected (${this.clients.size} remaining)`);
    };

    ws.onerror = (error) => {
      this.logger.error('WebSocket client error:', error);
      this.clients.delete(ws);
    };

    this.sendToClient(ws, {
      type: 'connection',
      message: 'Connected to Validator Dashboard WebSocket',
      timestamp: new Date().toISOString(),
      clientCount: this.clients.size
    });
  }

  sendToClient(ws, data) {
    try {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      this.logger.error('Error sending to client:', error);
      this.clients.delete(ws);
    }
  }

  broadcast(data) {
    if (this.clients.size === 0) return;

    const message = JSON.stringify(data, null, 2);
    const clientsToRemove = [];

    this.clients.forEach(client => {
      try {
        if (client.readyState === 1) {
          client.send(message);
        } else {
          clientsToRemove.push(client);
        }
      } catch (error) {
        clientsToRemove.push(client);
      }
    });

    clientsToRemove.forEach(client => {
      this.clients.delete(client);
    });

    if (data.type !== 'newBlock') {
      this.logger.debug(`Broadcasted ${data.type} to ${this.clients.size} clients`);
    }
  }

  setupEventListeners() {
    try {
      const importantEvents = [
        'ValidatorCreated',
        'ValidatorUpdated', 
        'Staking',
        'Unstake',
        'ValidatorSlash',
        'DelegatorRewardsClaimed',
        'WithdrawRewards',
        'RewardDistributed',
        'ValidatorSetUpdated',
        'AddToValidatorCandidate',
        'RemoveFromValidatorCandidate'
      ];

      importantEvents.forEach(eventName => {
        try {
          const filter = this.contract.filters[eventName]();
          this.eventFilters.set(eventName, filter);
          
          this.contract.on(filter, (...args) => {
            const event = args[args.length - 1];
            this.handleContractEvent(eventName, event, args);
          });
        } catch (error) {
          this.logger.warn(`Could not setup listener for ${eventName}:`, error.message);
        }
      });

      if (this.provider) {
        this.provider.on('block', (blockNumber) => {
          this.handleNewBlock(blockNumber);
        });
      }

      this.logger.success('Event listeners setup completed');
    } catch (error) {
      this.logger.error('Failed to setup event listeners:', error);
    }
  }

  handleContractEvent(eventName, event, args) {
    try {
      const parsedData = this.parseEventData(eventName, args);
      
      const eventData = {
        type: 'contractEvent',
        eventName,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: new Date().toISOString(),
        data: parsedData
      };

      // Log dengan informasi yang lebih detail untuk debugging
      if (parsedData.error) {
        this.logger.warn(`Event parsing issue for ${eventName}:`, {
          block: event.blockNumber,
          tx: event.transactionHash,
          argsLength: args.length,
          rawArgs: args.slice(0, -1).map((arg, index) => ({ index, type: typeof arg, value: arg.toString() }))
        });
      } else {
        this.logger.info(`Contract Event: ${eventName}`, {
          block: event.blockNumber,
          tx: event.transactionHash,
          data: parsedData
        });
      }

      this.broadcast(eventData);
      
    } catch (error) {
      this.logger.error(`Error handling contract event ${eventName}:`, {
        error: error.message,
        block: event?.blockNumber,
        tx: event?.transactionHash
      });
    }
  }

  handleNewBlock(blockNumber) {
    try {
      const blockData = {
        type: 'newBlock',
        blockNumber,
        timestamp: new Date().toISOString()
      };

      if (this.blockLogging) {
        this.logger.debug(`New block: ${blockNumber}`);
      }

      this.broadcast(blockData);
      
    } catch (error) {
      if (this.blockLogging) {
        this.logger.error('Error handling new block:', error);
      }
    }
  }

  /**
   * Enhanced event data parser dengan better error handling
   */
  parseEventData(eventName, args) {
    try {
      // Remove event object dari args
      const eventArgs = args.slice(0, -1);
      
      // Helper function untuk safely format ether
      const safeFormatEther = (value) => {
        try {
          if (value == null || value === undefined) return '0';
          return ethers.formatEther(value.toString());
        } catch (error) {
          this.logger.debug(`Error formatting ether value: ${value}`, error.message);
          return value?.toString() || '0';
        }
      };

      // Helper function untuk safely convert to string
      const safeToString = (value) => {
        try {
          if (value == null || value === undefined) return '0';
          return value.toString();
        } catch (error) {
          return 'unknown';
        }
      };

      switch (eventName) {
        case 'ValidatorCreated':
        case 'ValidatorUpdated':
          return {
            validator: eventArgs[0]?.toString() || 'unknown',
            rewardAddr: eventArgs[1]?.toString() || 'unknown'
          };

        case 'Staking':
          return {
            staker: eventArgs[0]?.toString() || 'unknown',
            validator: eventArgs[1]?.toString() || 'unknown',
            amount: safeFormatEther(eventArgs[2])
          };

        case 'Unstake':
          return {
            staker: eventArgs[0]?.toString() || 'unknown',
            validator: eventArgs[1]?.toString() || 'unknown',
            amount: safeFormatEther(eventArgs[2]),
            unlockHeight: safeToString(eventArgs[3])
          };

        case 'ValidatorSlash':
          return {
            validator: eventArgs[0]?.toString() || 'unknown',
            amount: safeFormatEther(eventArgs[1])
          };

        case 'ValidatorUnjailed':
          return {
            validator: eventArgs[0]?.toString() || 'unknown'
          };

        case 'DelegatorRewardsClaimed':
          return {
            delegator: eventArgs[0]?.toString() || 'unknown',
            validator: eventArgs[1]?.toString() || 'unknown',
            amount: safeFormatEther(eventArgs[2])
          };

        case 'WithdrawRewards':
          return {
            validator: eventArgs[0]?.toString() || 'unknown',
            rewardAddress: eventArgs[1]?.toString() || 'unknown',
            amount: safeFormatEther(eventArgs[2]),
            nextWithdrawBlock: safeToString(eventArgs[3])
          };

        case 'WithdrawStaking':
          return {
            staker: eventArgs[0]?.toString() || 'unknown',
            validator: eventArgs[1]?.toString() || 'unknown',
            amount: safeFormatEther(eventArgs[2])
          };

        case 'RewardDistributed':
          // Enhanced parsing untuk RewardDistributed event
          try {
            const validators = eventArgs[0];
            const rewards = eventArgs[1];
            const rewardCount = eventArgs[2];

            // Validate array inputs
            if (!Array.isArray(validators)) {
              this.logger.debug('RewardDistributed: validators is not an array', { validators, type: typeof validators });
              return {
                error: 'Invalid validators data structure',
                rawValidators: safeToString(validators),
                rawRewards: safeToString(rewards),
                rawRewardCount: safeToString(rewardCount)
              };
            }

            if (!Array.isArray(rewards)) {
              this.logger.debug('RewardDistributed: rewards is not an array', { rewards, type: typeof rewards });
              return {
                error: 'Invalid rewards data structure',
                validators: validators.map(v => v.toString()),
                rawRewards: safeToString(rewards),
                rawRewardCount: safeToString(rewardCount)
              };
            }

            return {
              validators: validators.map(v => v.toString()),
              rewards: rewards.map(r => safeFormatEther(r)),
              rewardCount: safeToString(rewardCount),
              totalValidators: validators.length,
              totalRewardsDistributed: rewards.reduce((sum, reward) => {
                try {
                  return sum + parseFloat(safeFormatEther(reward));
                } catch {
                  return sum;
                }
              }, 0).toFixed(6)
            };
          } catch (rewardError) {
            this.logger.debug('RewardDistributed parsing error:', {
              error: rewardError.message,
              argsLength: eventArgs.length,
              arg0Type: typeof eventArgs[0],
              arg1Type: typeof eventArgs[1],
              arg2Type: typeof eventArgs[2]
            });
            
            return {
              error: 'Failed to parse RewardDistributed event',
              details: rewardError.message,
              rawArgs: eventArgs.map((arg, i) => ({
                index: i,
                type: typeof arg,
                value: safeToString(arg)
              }))
            };
          }

        case 'ValidatorSetUpdated':
          try {
            const validators = eventArgs[0];
            if (Array.isArray(validators)) {
              return {
                validators: validators.map(v => v.toString()),
                count: validators.length
              };
            } else {
              return {
                error: 'Invalid validator set data',
                rawData: safeToString(validators)
              };
            }
          } catch (error) {
            return {
              error: 'Failed to parse ValidatorSetUpdated',
              details: error.message
            };
          }

        case 'AddToValidatorCandidate':
        case 'RemoveFromValidatorCandidate':
          return {
            validator: eventArgs[0]?.toString() || 'unknown'
          };

        default:
          // For unknown events, return raw args with safe conversion
          return {
            eventName,
            rawArgs: eventArgs.map((arg, index) => ({
              index,
              type: typeof arg,
              value: safeToString(arg)
            })),
            note: 'Unknown event - raw args provided'
          };
      }
    } catch (error) {
      this.logger.debug(`Error parsing event data for ${eventName}:`, {
        error: error.message,
        argsLength: args.length
      });
      
      return {
        error: 'Failed to parse event data',
        eventName,
        details: error.message,
        rawArgsCount: args.length
      };
    }
  }

  handleMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      
      this.logger.debug('WebSocket message received:', { type: data.type });
      
      switch (data.type) {
        case 'ping':
          this.sendToClient(ws, {
            type: 'pong',
            timestamp: new Date().toISOString()
          });
          break;
          
        case 'getStats':
          this.sendStats(ws);
          break;

        case 'subscribe':
          this.logger.info('Client subscribed to events:', data.events);
          this.sendToClient(ws, {
            type: 'subscribed',
            events: data.events,
            timestamp: new Date().toISOString()
          });
          break;
          
        default:
          this.logger.warn(`Unknown WebSocket message type: ${data.type}`);
          this.sendToClient(ws, {
            type: 'error',
            message: `Unknown message type: ${data.type}`,
            timestamp: new Date().toISOString()
          });
      }
      
    } catch (error) {
      this.logger.error('Error parsing WebSocket message:', error);
      this.sendToClient(ws, {
        type: 'error',
        message: 'Invalid JSON message',
        timestamp: new Date().toISOString()
      });
    }
  }

  sendStats(ws) {
    const stats = {
      type: 'stats',
      data: {
        connectedClients: this.clients.size,
        activeListeners: this.eventFilters.size,
        isInitialized: this.isInitialized
      },
      timestamp: new Date().toISOString()
    };
    
    this.sendToClient(ws, stats);
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      activeListeners: this.eventFilters.size,
      isInitialized: this.isInitialized,
      contractAddress: this.contractAddress,
      rpcUrl: this.rpcUrl
    };
  }

  destroy() {
    this.logger.info('Destroying WebSocket service...');
    
    this.clients.forEach(client => {
      try {
        client.close();
      } catch (error) {
        // Ignore errors when closing
      }
    });
    this.clients.clear();
    
    this.eventFilters.forEach((filter, eventName) => {
      try {
        this.contract.removeAllListeners(filter);
      } catch (error) {
        this.logger.error(`Error removing listener for ${eventName}:`, error);
      }
    });
    this.eventFilters.clear();
    
    if (this.provider) {
      try {
        this.provider.removeAllListeners();
      } catch (error) {
        this.logger.error('Error removing provider listeners:', error);
      }
    }
    
    this.isInitialized = false;
    this.logger.success('WebSocket service destroyed');
  }
}