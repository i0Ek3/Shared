const hre = require("hardhat");

async function main() {
  console.log("🚀 开始部署 Shared 智能合约...");

  // 获取合约工厂
  const PostContract = await hre.ethers.getContractFactory("PostContract");
  
  // 部署合约
  console.log("⏳ 正在部署合约...");
  const postContract = await PostContract.deploy();
  
  await postContract.waitForDeployment();
  
  const contractAddress = await postContract.getAddress();
  
  console.log("✅ PostContract 部署成功!");
  console.log("📍 合约地址:", contractAddress);
  console.log("🌐 网络:", hre.network.name);
  console.log("⛽ 部署账户:", (await hre.ethers.provider.getSigner()).address);
  
  // 如果是测试网或主网，等待区块确认后验证合约
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("⏳ 等待区块确认...");
    await postContract.deploymentTransaction().wait(6);
    
    console.log("📝 验证合约...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("✅ 合约验证成功!");
    } catch (error) {
      console.log("❌ 合约验证失败:", error.message);
    }
  }
  
  // 保存合约地址到配置文件
  const fs = require("fs");
  const contractsDir = "./frontend/src/contracts";
  
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify({ PostContract: contractAddress }, null, 2)
  );
  
  console.log("💾 合约地址已保存到 frontend/src/contracts/contract-address.json");
  
  // 复制 ABI 到前端
  const contractArtifact = await hre.artifacts.readArtifact("PostContract");
  fs.writeFileSync(
    contractsDir + "/PostContract.json",
    JSON.stringify(contractArtifact, null, 2)
  );
  
  console.log("💾 合约 ABI 已保存到 frontend/src/contracts/PostContract.json");
  console.log("\n🎉 部署完成！");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });