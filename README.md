# 🚀 Adera Validator Dashboard API

> **Complete backend API solution untuk dashboard validator dan delegator dengan arsitektur clean dan modular**

[![Bun](https://img.shields.io/badge/bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Ethereum](https://img.shields.io/badge/Ethereum-3C3C3D?style=for-the-badge&logo=Ethereum&logoColor=white)](https://ethereum.org/)

## 📋 Daftar Isi

- [✨ Fitur Utama](#-fitur-utama)
- [🏗️ Arsitektur](#️-arsitektur)
- [🚀 Quick Start](#-quick-start)
- [📁 Struktur Proyek](#-struktur-proyek)
- [🔗 API Endpoints](#-api-endpoints)
- [🔌 WebSocket Events](#-websocket-events)
- [🛠️ Development](#️-development)
- [🚢 Deployment](#-deployment)
- [📖 Documentation](#-documentation)

## ✨ Fitur Utama

### 🌟 **Core Features**
- ✅ **REST API Lengkap** - Semua endpoint validator dan delegator
- ✅ **WebSocket Real-time** - Update langsung dari blockchain
- ✅ **Clean Architecture** - Modular dan maintainable
- ✅ **Advanced Caching** - Multi-layer caching system
- ✅ **Input Validation** - Comprehensive validation dengan Zod
- ✅ **Error Handling** - Robust error handling
- ✅ **Rate Limiting** - Built-in rate limiting
- ✅ **Logging System** - Structured logging
- ✅ **Type Safety** - Full TypeScript support

### ⚡ **Performance & Security**
- 🚀 **Ultra Fast** - Powered by Bun.js (3x faster than Node.js)
- 🔒 **Security Headers** - Comprehensive security middleware
- 📊 **Monitoring** - Health checks dan metrics
- 🔄 **Auto-retry** - Smart retry mechanisms
- 💾 **Memory Efficient** - Optimized memory usage
- 🌐 **CORS Ready** - Production-ready CORS configuration

## 🏗️ Arsitektur

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │   API Gateway    │    │   Blockchain    │
│                 │◄──►│                  │◄──►│                 │
│  React/Vue/...  │    │  Elysia + Bun    │    │  Adera Network  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Services Layer │
                    │                  │
                    │  ┌─────────────┐ │
                    │  │ Validator   │ │
                    │  │ Service     │ │
                    │  └─────────────┘ │
                    │  ┌─────────────┐ │
                    │  │ Delegator   │ │
                    │  │ Service     │ │
                    │  └─────────────┘ │
                    │  ┌─────────────┐ │
                    │  │ Blockchain  │ │
                    │  │ Service     │ │
                    │  └─────────────┘ │
                    │  ┌─────────────┐ │
                    │  │ WebSocket   │ │
                    │  │ Service     │ │
                    │  └─────────────┘ │
                    │  ┌─────────────┐ │
                    │  │ Cache       │ │
                    │  │ Service     │ │
                    │  └─────────────┘ │
                    └──────────────────┘
```

## 🚀 Quick Start

### 📦 Prerequisites
- [Bun](https://bun.sh) v1.0.0+
- Node.js v18+ (untuk development tools)
- Akses ke Adera Network RPC

### ⚡ Installation

```bash
# 1. Clone repository
git clone https://github.com/avenbreaks/adera-staking-ui.git
cd adera-staking-ui/api

# 2. Install dependencies
bun install

# 3. Setup environment
cp .env.example .env
# Edit .env dengan konfigurasi yang sesuai

# 4. Jalankan development server
bun run dev
```

### 🌐 Akses API
- **Health Check:** http://localhost:3001/health
- **API Documentation:** http://localhost:3001/api/config  
- **WebSocket:** ws://localhost:3001/ws

## 📁 Struktur Proyek

```
adera-validator-dashboard-api/
├── server.js                    # Entry point
├── src/
│   ├── app.js                   # Main application
│   ├── config/
│   │   └── index.js            # Configuration management
│   ├── services/
│   │   ├── blockchain.js       # Blockchain interactions
│   │   ├── validator.js        # Validator business logic
│   │   ├── delegator.js        # Delegator business logic
│   │   ├── cache.js           # Caching system
│   │   └── websocket.js       # Real-time updates
│   ├── routes/
│   │   ├── health.js          # Health check routes
│   │   ├── validators.js      # Validator endpoints
│   │   ├── delegators.js      # Delegator endpoints
│   │   ├── stats.js          # Statistics endpoints
│   │   └── websocket.js      # WebSocket routes
│   ├── middleware/
│   │   ├── logger.js         # Request logging
│   │   ├── errorHandler.js   # Error handling
│   │   ├── validation.js     # Input validation
│   │   └── index.js         # Middleware collection
│   ├── utils/
│   │   ├── logger.js        # Logging utility
│   │   ├── response.js      # Response wrapper
│   │   └── validation.js    # Validation helpers
│   └── abi/
│       └── Validators.abi.json # Smart contract ABI
├── package.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🔗 API Endpoints

### 📊 **Core Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Basic health check |
| `GET` | `/health/detailed` | Detailed system health |
| `GET` | `/api/config` | Network & contract configuration |

### 👥 **Validator Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/validators` | List all validators (paginated) |
| `GET` | `/api/validators/candidates` | Get validator candidates |
| `GET` | `/api/validators/search?q=term` | Search validators |
| `GET` | `/api/validators/:address` | Get validator details |
| `GET` | `/api/validators/:address/performance` | Validator performance metrics |
| `GET` | `/api/validators/:address/stakers` | Validator's stakers |
| `GET` | `/api/validators/:address/rewards` | Validator rewards info |

### 🤝 **Delegator Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/delegator/:address` | Get delegator information |
| `GET` | `/api/delegator/:address/history` | Delegator transaction history |
| `GET` | `/api/delegator/:address/rewards` | Delegator rewards summary |

### 💰 **Staking Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/staking/:delegator/:validator` | Specific staking details |
| `GET` | `/api/staking/:delegator/:validator/withdrawal-status` | Withdrawal status |
| `GET` | `/api/staking/:delegator/:validator/rewards` | Staking rewards |

### 📈 **Statistics Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats` | Basic network statistics |
| `GET` | `/api/network/stats` | Detailed network metrics |
| `GET` | `/api/validators/distribution` | Validator distribution data |
| `GET` | `/api/stats/historical` | Historical statistics |
| `GET` | `/api/api-stats` | API performance stats |

## 🔌 WebSocket Events

### 📡 **Connection Events**
```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
        case 'connection':
            console.log('Connected to WebSocket');
            break;
            
        case 'newBlock':
            console.log('New block:', data.blockNumber);
            break;
            
        case 'contractEvent':
            console.log('Contract event:', data.eventName, data.data);
            break;
    }
};
```

### 📨 **Contract Events**
- `ValidatorCreated` - New validator registered
- `ValidatorUpdated` - Validator information updated  
- `Staking` - New delegation
- `Unstake` - Undelegation initiated
- `ValidatorSlash` - Validator slashed
- `ValidatorUnjailed` - Validator unjailed
- `DelegatorRewardsClaimed` - Rewards claimed
- `WithdrawRewards` - Validator rewards withdrawn
- `WithdrawStaking` - Staking withdrawn
- `RewardDistributed` - Rewards distributed
- `ValidatorSetUpdated` - Validator set updated

### 🔧 **Client Commands**
```javascript
// Subscribe to specific events
ws.send(JSON.stringify({
    type: 'subscribe',
    events: ['Staking', 'Unstake', 'RewardDistributed']
}));

// Ping server
ws.send(JSON.stringify({ type: 'ping' }));

// Get WebSocket stats
ws.send(JSON.stringify({ type: 'getStats' }));
```

## 🛠️ Development

### 🎯 **Available Scripts**

```bash
# Development
bun run dev              # Start with hot reload
bun run start           # Production start
bun run build          # Build for production

# Code Quality
bun run lint           # ESLint check
bun run lint:fix      # Fix ESLint issues
bun run format        # Prettier formatting
bun run type-check    # TypeScript check

# Testing & Utilities
bun run test          # Run tests
bun run test:watch   # Watch mode tests
bun run clean        # Clean build artifacts
bun run logs         # View logs
```

### 🔧 **Environment Variables**

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Blockchain
RPC_URL=https://rpc.adera.network
VALIDATORS_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890

# Cache & Performance  
CACHE_DURATION=30000
CACHE_MAX_SIZE=1000

# API Configuration
CORS_ORIGIN=*
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Logging
LOG_LEVEL=info
LOG_CONSOLE=true
LOG_FILE=false
```

### 🧪 **Testing**

```bash
# Unit tests
bun test

# Integration tests  
bun test:integration

# API testing dengan curl
curl http://localhost:3001/health
curl http://localhost:3001/api/validators
curl http://localhost:3001/api/stats
```

## 🚢 Deployment

### 🐳 **Docker Deployment**

```bash
# Build dan run dengan Docker
docker-compose up -d

# Atau manual build
docker build -t adera-validator-api .
docker run -p 3001:3001 adera-validator-api
```

### ☁️ **Production Deployment**

```bash
# PM2 deployment
pm2 start ecosystem.config.js --env production

# Atau dengan systemd
sudo systemctl start adera-validator-api
sudo systemctl enable adera-validator-api
```

### 🔧 **Nginx Configuration**

```nginx
server {
    listen 80;
    server_name api.adera.network;

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

## 📖 Documentation

### 🌐 **API Usage Examples**

#### JavaScript/TypeScript
```javascript
// Fetch validators
const response = await fetch('/api/validators?page=1&limit=20');
const { data } = await response.json();

// Get specific validator
const validator = await fetch('/api/validators/0x123...').then(r => r.json());

// WebSocket connection
const ws = new WebSocket('ws://localhost:3001/ws');
ws.onmessage = (event) => {
    const update = JSON.parse(event.data);
    // Handle real-time updates
};
```

#### Python
```python
import requests
import websocket
import json

# REST API calls
response = requests.get('http://localhost:3001/api/validators')
validators = response.json()

# WebSocket
def on_message(ws, message):
    data = json.loads(message)
    print(f"Received: {data}")

ws = websocket.WebSocketApp("ws://localhost:3001/ws", on_message=on_message)
ws.run_forever()
```

#### curl
```bash
# Get network stats
curl -X GET "http://localhost:3001/api/network/stats" | jq

# Search validators
curl -X GET "http://localhost:3001/api/validators/search?q=adera" | jq

# Get delegator info
curl -X GET "http://localhost:3001/api/delegator/0x123..." | jq
```

### 📊 **Response Format**

#### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Success",
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Error Response  
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": { ... }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 100,
    "itemsPerPage": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 🤝 Contributing

1. **Fork** repository
2. **Create** feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing-feature`)
5. **Open** Pull Request

### 📝 **Development Guidelines**

- Gunakan TypeScript untuk type safety
- Tulis unit tests untuk semua services
- Follow ESLint dan Prettier rules
- Update documentation untuk API changes
- Gunakan semantic versioning

## 🐛 Troubleshooting

### ❌ **Common Issues**

#### 1. Connection Error ke RPC
```bash
Error: could not detect network
```
**Solution:** Pastikan `RPC_URL` benar dan dapat diakses

#### 2. Contract Call Failure  
```bash
Error: call revert exception
```
**Solution:** Periksa `VALIDATORS_CONTRACT_ADDRESS` dan network

#### 3. WebSocket Connection Failed
```bash
Error: WebSocket connection failed
```
**Solution:** Pastikan port 3001 tidak diblokir firewall

#### 4. High Memory Usage
**Solution:** Kurangi `CACHE_DURATION` atau implementasi Redis

### 🔍 **Debug Mode**
```bash
# Enable debug logging
LOG_LEVEL=debug bun run dev

# Monitor dengan htop
htop -p $(pgrep -f "bun.*server.js")

# Check WebSocket connections
lsof -i :3001
```

## 📄 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file.

## 🙏 Acknowledgments

- **[Bun.js](https://bun.sh)** - Lightning fast JavaScript runtime
- **[Elysia](https://elysiajs.com)** - Ergonomic web framework  
- **[Ethers.js](https://ethers.org)** - Ethereum library
- **[Adera Network](https://adera.network)** - Blockchain platform

---

<div align="center">

**🌟 Star this repository if it helps you! 🌟**

Made with ❤️ by [Adera Network](https://adera.network)

[🐛 Report Bug](https://github.com/avenbreaks/adera-staking-ui/issues) • [✨ Request Feature](https://github.com/avenbreaks/adera-staking-ui/issues) • [💬 Discord](https://discord.gg/adera)

</div>