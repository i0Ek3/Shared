const { ethers } = require('ethers');

// 生成随机钱包
const wallet = ethers.Wallet.createRandom();

console.log('🔐 新钱包信息:');
console.log('地址:', wallet.address);
console.log('私钥:', wallet.privateKey);
console.log('助记词:', wallet.mnemonic.phrase);
console.log('\n⚠️  请安全保存这些信息！');
