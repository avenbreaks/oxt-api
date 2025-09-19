#!/bin/bash

echo "🚀 Setting up Adera Validator Dashboard API..."

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi

echo "📦 Installing dependencies..."
bun install

# Create missing directories
echo "📁 Creating directory structure..."
mkdir -p src/{abi,config,middleware,routes,services,utils}
mkdir -p logs

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOL
# Server Configuration
PORT=3001
NODE_ENV=development

# Blockchain Configuration  
RPC_URL=https://rpc.adera.network
VALIDATORS_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890

# API Configuration
CACHE_DURATION=30000
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info
LOG_CONSOLE=true
LOG_FILE=false
EOL
    echo "⚠️  Please edit .env file with your actual configuration"
fi

# Create ABI file
echo "📜 Creating ABI file..."
cat > src/abi/Validators.abi.json << 'EOL'
[
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "validator",
                "type": "address"
            }
        ],
        "name": "AddToValidatorCandidate",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "BlockEpoch",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getActivatedValidators",
        "outputs": [
            {
                "internalType": "address[]",
                "name": "",
                "type": "address[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalStaking",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]
EOL

echo "✅ Setup completed!"
echo ""
echo "🚀 To start the server:"
echo "   bun run dev"
echo ""
echo "📊 API will be available at:"
echo "   http://localhost:3001/health"
echo ""
echo "⚠️  Don't forget to:"
echo "   1. Edit .env with your RPC URL and contract address"
echo "   2. Replace src/abi/Validators.abi.json with actual ABI"