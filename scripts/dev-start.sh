#!/bin/bash

# Shared 开发环境启动脚本
# 使用方法: ./scripts/dev-start.sh

set -e

echo "🚀 启动 Shared 开发环境..."
echo ""

# 检查 IPFS 是否运行
echo "📦 检查 IPFS 状态..."
if ! ipfs swarm peers &> /dev/null; then
    echo "⚠️  IPFS 未运行，正在启动..."
    ipfs daemon &
    IPFS_PID=$!
    echo "✅ IPFS 已启动 (PID: $IPFS_PID)"
    sleep 3
else
    echo "✅ IPFS 已在运行"
fi
echo ""

# 启动 Hardhat 节点
echo "🔗 启动本地区块链..."
cd contracts
npx hardhat node &
HARDHAT_PID=$!
echo "✅ Hardhat 节点已启动 (PID: $HARDHAT_PID)"
sleep 5
cd ..
echo ""

# 部署智能合约
echo "📝 部署智能合约..."
cd contracts
npx hardhat run scripts/deploy.js --network localhost
cd ..
echo "✅ 智能合约部署完成"
echo ""

# 启动后端服务
echo "🔧 启动 Go 后端..."
cd backend
go run main.go &
BACKEND_PID=$!
echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"
sleep 2
cd ..
echo ""

# 启动前端
echo "🎨 启动前端应用..."
cd frontend
npm run dev &
FRONTEND_PID=$!
echo "✅ 前端已启动 (PID: $FRONTEND_PID)"
cd ..
echo ""

echo "🎉 开发环境启动完成！"
echo ""
echo "📍 服务地址:"
echo "  - 前端: http://localhost:3000"
echo "  - 后端: http://localhost:8080"
echo "  - IPFS: http://localhost:5001"
echo "  - Hardhat: http://localhost:8545"
echo ""
echo "📝 进程 ID:"
echo "  - IPFS: $IPFS_PID (如果是新启动的)"
echo "  - Hardhat: $HARDHAT_PID"
echo "  - Backend: $BACKEND_PID"
echo "  - Frontend: $FRONTEND_PID"
echo ""
echo "🛑 停止服务: Ctrl+C 或手动 kill 进程"
echo ""

# 等待用户中断
trap "echo ''; echo '🛑 正在停止所有服务...'; kill $HARDHAT_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# 保持脚本运行
wait