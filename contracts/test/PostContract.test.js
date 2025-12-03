const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PostContract", function () {
  let postContract;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const PostContract = await ethers.getContractFactory("PostContract");
    postContract = await PostContract.deploy();
    await postContract.waitForDeployment();
  });

  describe("部署", function () {
    it("应该正确部署合约", async function () {
      expect(await postContract.getAddress()).to.be.properAddress;
    });

    it("初始帖子数应该为 0", async function () {
      expect(await postContract.getTotalPosts()).to.equal(0);
    });
  });

  describe("创建帖子", function () {
    it("应该能够创建文字帖子", async function () {
      const ipfsHash = "QmTest123";
      const contentType = 0; // TEXT

      await expect(postContract.createPost(ipfsHash, contentType))
        .to.emit(postContract, "PostCreated")
        .withArgs(1, ipfsHash, contentType, anyValue, owner.address);

      expect(await postContract.getTotalPosts()).to.equal(1);
    });

    it("应该能够创建图片帖子", async function () {
      const ipfsHash = "QmImage123";
      const contentType = 1; // IMAGE

      await postContract.createPost(ipfsHash, contentType);
      const post = await postContract.getPost(1);

      expect(post.ipfsHash).to.equal(ipfsHash);
      expect(post.contentType).to.equal(contentType);
    });

    it("应该能够创建视频帖子", async function () {
      const ipfsHash = "QmVideo123";
      const contentType = 2; // VIDEO

      await postContract.createPost(ipfsHash, contentType);
      const post = await postContract.getPost(1);

      expect(post.ipfsHash).to.equal(ipfsHash);
      expect(post.contentType).to.equal(contentType);
    });

    it("不应该接受空的 IPFS 哈希", async function () {
      await expect(
        postContract.createPost("", 0)
      ).to.be.revertedWith("IPFS hash cannot be empty");
    });

    it("应该正确记录发布者地址", async function () {
      const ipfsHash = "QmTest123";
      await postContract.connect(addr1).createPost(ipfsHash, 0);

      const post = await postContract.getPost(1);
      expect(post.publisher).to.equal(addr1.address);
    });

    it("应该正确记录时间戳", async function () {
      const ipfsHash = "QmTest123";
      const tx = await postContract.createPost(ipfsHash, 0);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const post = await postContract.getPost(1);
      expect(post.timestamp).to.equal(block.timestamp);
    });
  });

  describe("查询帖子", function () {
    beforeEach(async function () {
      // 创建 5 个测试帖子
      for (let i = 1; i <= 5; i++) {
        await postContract.createPost(`QmTest${i}`, 0);
      }
    });

    it("应该能够获取单个帖子", async function () {
      const post = await postContract.getPost(1);
      expect(post.ipfsHash).to.equal("QmTest1");
    });

    it("无效的帖子 ID 应该抛出错误", async function () {
      await expect(postContract.getPost(0)).to.be.revertedWith("Invalid post ID");
      await expect(postContract.getPost(999)).to.be.revertedWith("Invalid post ID");
    });

    it("应该能够获取最新的 N 个帖子", async function () {
      const latestPosts = await postContract.getLatestPosts(3);
      expect(latestPosts.length).to.equal(3);
      expect(latestPosts[0].ipfsHash).to.equal("QmTest5"); // 最新的
      expect(latestPosts[1].ipfsHash).to.equal("QmTest4");
      expect(latestPosts[2].ipfsHash).to.equal("QmTest3");
    });

    it("请求的数量超过总数时应该返回所有帖子", async function () {
      const latestPosts = await postContract.getLatestPosts(10);
      expect(latestPosts.length).to.equal(5);
    });

    it("应该能够获取指定范围的帖子", async function () {
      const rangePosts = await postContract.getPostsInRange(2, 4);
      expect(rangePosts.length).to.equal(3);
      expect(rangePosts[0].ipfsHash).to.equal("QmTest2");
      expect(rangePosts[1].ipfsHash).to.equal("QmTest3");
      expect(rangePosts[2].ipfsHash).to.equal("QmTest4");
    });

    it("应该正确返回总帖子数", async function () {
      expect(await postContract.getTotalPosts()).to.equal(5);
    });

    it("应该能够检查帖子是否存在", async function () {
      expect(await postContract.postExists(1)).to.be.true;
      expect(await postContract.postExists(5)).to.be.true;
      expect(await postContract.postExists(0)).to.be.false;
      expect(await postContract.postExists(999)).to.be.false;
    });

    it("应该能够统计某地址的发布数量", async function () {
      await postContract.connect(addr1).createPost("QmAddr1_1", 0);
      await postContract.connect(addr1).createPost("QmAddr1_2", 0);
      await postContract.connect(addr2).createPost("QmAddr2_1", 0);

      expect(await postContract.getPostCountByPublisher(owner.address)).to.equal(5);
      expect(await postContract.getPostCountByPublisher(addr1.address)).to.equal(2);
      expect(await postContract.getPostCountByPublisher(addr2.address)).to.equal(1);
    });
  });

  describe("不可删除性", function () {
    it("合约不应该有删除帖子的函数", async function () {
      // 检查合约接口中没有删除相关的函数
      const contractInterface = postContract.interface;
      const functions = Object.keys(contractInterface.functions);
      
      const deleteFunctions = functions.filter(fn => 
        fn.toLowerCase().includes('delete') || 
        fn.toLowerCase().includes('remove')
      );

      expect(deleteFunctions.length).to.equal(0);
    });

    it("创建的帖子应该永久保存", async function () {
      await postContract.createPost("QmPermanent", 0);
      const post = await postContract.getPost(1);
      
      expect(post.ipfsHash).to.equal("QmPermanent");
      
      // 等待一段时间后再次检查
      await ethers.provider.send("evm_increaseTime", [3600]); // 增加 1 小时
      await ethers.provider.send("evm_mine");
      
      const postAfter = await postContract.getPost(1);
      expect(postAfter.ipfsHash).to.equal("QmPermanent");
    });
  });

  describe("Gas 消耗", function () {
    it("应该记录创建帖子的 Gas 消耗", async function () {
      const tx = await postContract.createPost("QmGasTest", 0);
      const receipt = await tx.wait();
      
      console.log(`      Gas 消耗: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lt(200000); // 应该少于 20 万 Gas
    });
  });
});

// 辅助函数
const anyValue = require("@nomicfoundation/hardhat-chai-matchers/withArgs");