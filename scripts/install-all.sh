#!/bin/bash

# Shared 项目一键安装脚本
# 使用方法: ./scripts/install-all.sh

set -e

echo "🚀 开始安装 Shared 项目..."
echo ""

# 检查 Node.js
echo "📦 检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装 Node.js >= 18.0.0"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低，需要 >= 18.0.0"
    exit 1
fi
echo "✅ Node.js 版本: $(node -v)"
echo ""

# 检查 Go
echo "📦 检查 Go..."
if ! command -v go &> /dev/null; then
    echo "❌ 未找到 Go，请先安装 Go >= 1.21"
    exit 1
fi
echo "✅ Go 版本: $(go version)"
echo ""

# 检查 IPFS
echo "📦 检查 IPFS..."
if ! command -v ipfs &> /dev/null; then
    echo "⚠️  未找到 IPFS，请先安装 IPFS"
    echo "   macOS: brew install ipfs"
    echo "   Linux: https://docs.ipfs.io/install/"
    echo "   Windows: https://github.com/ipfs/ipfs-desktop/releases"
    echo ""
    read -p "是否继续安装（不含 IPFS）？ (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ IPFS 版本: $(ipfs --version)"
fi
echo ""

# 安装智能合约依赖
echo "📦 安装智能合约依赖..."
cd contracts
npm install
cd ..
echo "✅ 智能合约依赖安装完成"
echo ""

# 安装前端依赖
echo "📦 安装前端依赖..."
cd frontend
npm install
cd ..
echo "✅ 前端依赖安装完成"
echo ""

# 安装 Go 依赖
echo "📦 安装 Go 后端依赖..."
cd backend
go mod download
cd ..
echo "✅ Go 后端依赖安装完成"
echo ""

# 创建环境变量文件
echo "📝 创建环境变量文件..."

if [ ! -f contracts/.env ]; then
    cat > contracts/.env << EOF
# Sepolia 测试网 RPC
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# 部署账户私钥
PRIVATE_KEY=your_private_key_here

# Etherscan API Key
ETHERSCAN_API_KEY=your_etherscan_api_key

# 主网 RPC
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
EOF
    echo "✅ 已创建 contracts/.env（请编辑配置）"
else
    echo "⏭️  contracts/.env 已存在，跳过"
fi

if [ ! -f backend/.env ]; then
    cat > backend/.env << EOF
# IPFS API 地址
IPFS_API_URL=localhost:5001

# 服务端口
PORT=8080

# CORS 允许的源
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
EOF
    echo "✅ 已创建 backend/.env"
else
    echo "⏭️  backend/.env 已存在，跳过"
fi

if [ ! -f frontend/.env ]; then
    cat > frontend/.env << EOF
# 后端 API 地址
VITE_BACKEND_URL=http://localhost:8080

# 网络配置
VITE_CHAIN_ID=31337
VITE_NETWORK_NAME=localhost
EOF
    echo "✅ 已创建 frontend/.env"
else
    echo "⏭️  frontend/.env 已存在，跳过"
fi
echo ""

echo "🎉 安装完成！"
echo ""
echo "📋 下一步："
echo "  1. 编辑 contracts/.env 配置私钥和 RPC"
echo "  2. 启动 IPFS: ipfs daemon"
echo "  3. 运行开发环境: ./scripts/dev-start.sh"
echo ""
echo "📚 详细文档: README.md"