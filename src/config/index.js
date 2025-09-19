import { z } from "zod";

// Configuration schema validation
const configSchema = z.object({
  server: z.object({
    port: z.number().min(1000).max(65535),
    env: z.enum(['development', 'production', 'test'])
  }),
  rpc: z.object({
    url: z.string().url(),
    timeout: z.number().default(30000)
  }),
  contracts: z.object({
    validators: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
  }),
  cache: z.object({
    duration: z.number().min(1000).default(30000),
    maxSize: z.number().default(1000)
  }),
  cors: z.object({
    origin: z.string().default("*")
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    enableConsole: z.boolean().default(true),
    enableFile: z.boolean().default(true)
  })
});

// Load and validate configuration
const rawConfig = {
  server: {
    port: parseInt(process.env.PORT) || 3001,
    env: process.env.NODE_ENV || 'development'
  },
  rpc: {
    url: process.env.RPC_URL || 'https://rpc.adera.network',
    timeout: parseInt(process.env.RPC_TIMEOUT) || 30000
  },
  contracts: {
    validators: process.env.VALIDATORS_CONTRACT_ADDRESS || '0x1234567890123456789012345678901234567890'
  },
  cache: {
    duration: parseInt(process.env.CACHE_DURATION) || 30000,
    maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "*"
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.LOG_CONSOLE !== 'false',
    enableFile: process.env.LOG_FILE === 'true',
    logBlocks: process.env.LOG_BLOCKS === 'true',
    prettyJson: process.env.PRETTY_JSON !== 'false'
  }
};

export const config = rawConfig;