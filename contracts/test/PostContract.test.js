const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PostContract v2 - 带标签功能", function () {
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

  describe("创建带标签的帖子", function () {
    it("应该能够创建带单个标签的帖子", async function () {
      const ipfsHash = "QmTest123";
      const tags = ["技术"];

      await expect(postContract.createPost(ipfsHash, 0, tags))
        .to.emit(postContract, "PostCreated");

      const post = await postContract.getPost(1);
      expect(post.tags.length).to.equal(1);
      expect(post.tags[0]).to.equal("技术");
    });

    it("应该能够创建带多个标签的帖子", async function () {
      const ipfsHash = "QmTest123";
      const tags = ["技术", "blockchain", "加密货币"];

      await postContract.createPost(ipfsHash, 0, tags);
      const post = await postContract.getPost(1);

      expect(post.tags.length).to.equal(3);
      expect(post.tags[0]).to.equal("技术");
      expect(post.tags[1]).to.equal("blockchain");
      expect(post.tags[2]).to.equal("加密货币");
    });

    it("应该支持中英文标签", async function () {
      const tags = ["技术", "Tech", "区块链", "Blockchain"];
      await postContract.createPost("QmTest", 0, tags);

      const post = await postContract.getPost(1);
      expect(post.tags).to.deep.equal(tags);
    });

    it("应该能够创建不带标签的帖子", async function () {
      await postContract.createPost("QmTest", 0, []);
      const post = await postContract.getPost(1);

      expect(post.tags.length).to.equal(0);
    });

    it("不应该接受超过10个标签", async function () {
      const tags = Array(11).fill("tag");
      await expect(
        postContract.createPost("QmTest", 0, tags)
      ).to.be.revertedWith("Too many tags (max 10)");
    });

    it("不应该接受空标签", async function () {
      await expect(
        postContract.createPost("QmTest", 0, [""])
      ).to.be.revertedWith("Tag cannot be empty");
    });

    it("不应该接受过长的标签", async function () {
      const longTag = "a".repeat(51);
      await expect(
        postContract.createPost("QmTest", 0, [longTag])
      ).to.be.revertedWith("Tag too long (max 50 chars)");
    });
  });

  describe("按标签搜索", function () {
    beforeEach(async function () {
      // 创建测试数据
      await postContract.createPost("QmHash1", 0, ["技术", "区块链"]);
      await postContract.createPost("QmHash2", 0, ["技术", "AI"]);
      await postContract.createPost("QmHash3", 0, ["区块链", "DeFi"]);
      await postContract.createPost("QmHash4", 0, ["生活"]);
    });

    it("应该能够按标签搜索帖子", async function () {
      const posts = await postContract.getPostsByTag("技术");
      expect(posts.length).to.equal(2);
      expect(posts[0].ipfsHash).to.equal("QmHash1");
      expect(posts[1].ipfsHash).to.equal("QmHash2");
    });

    it("应该能够搜索中文标签", async function () {
      const posts = await postContract.getPostsByTag("区块链");
      expect(posts.length).to.equal(2);
    });

    it("应该能够搜索英文标签", async function () {
      const posts = await postContract.getPostsByTag("AI");
      expect(posts.length).to.equal(1);
    });

    it("搜索不存在的标签应返回空数组", async function () {
      const posts = await postContract.getPostsByTag("不存在");
      expect(posts.length).to.equal(0);
    });

    it("应该能够获取标签的帖子数量", async function () {
      const count = await postContract.getPostCountByTag("技术");
      expect(count).to.equal(2);
    });
  });

  describe("标签管理", function () {
    beforeEach(async function () {
      await postContract.createPost("QmHash1", 0, ["技术", "AI"]);
      await postContract.createPost("QmHash2", 0, ["区块链"]);
      await postContract.createPost("QmHash3", 0, ["技术", "Web3"]);
    });

    it("应该能够获取所有标签", async function () {
      const tags = await postContract.getAllTags();
      expect(tags.length).to.equal(4);
      expect(tags).to.include.members(["技术", "AI", "区块链", "Web3"]);
    });

    it("重复的标签不应该重复记录", async function () {
      await postContract.createPost("QmHash4", 0, ["技术"]);
      const tags = await postContract.getAllTags();

      // 技术标签应该只出现一次
      const techCount = tags.filter(t => t === "技术").length;
      expect(techCount).to.equal(1);
    });

    it("应该能够获取热门标签", async function () {
      // 添加更多"技术"标签的帖子
      await postContract.createPost("QmHash4", 0, ["技术"]);
      await postContract.createPost("QmHash5", 0, ["技术"]);

      const [tags, counts] = await postContract.getTopTags(3);

      expect(tags.length).to.equal(3);
      expect(tags[0]).to.equal("技术"); // 最热门
      expect(counts[0]).to.equal(4); // 4个帖子
    });

    it("热门标签应该按数量降序排列", async function () {
      const [tags, counts] = await postContract.getTopTags(4);

      // 验证降序
      for (let i = 0; i < counts.length - 1; i++) {
        expect(counts[i]).to.be.at.least(counts[i + 1]);
      }
    });
  });

  describe("标签索引", function () {
    it("应该正确维护标签到帖子的映射", async function () {
      await postContract.createPost("QmHash1", 0, ["test"]);
      await postContract.createPost("QmHash2", 0, ["test"]);
      await postContract.createPost("QmHash3", 0, ["other"]);

      const testPosts = await postContract.getPostsByTag("test");
      expect(testPosts.length).to.equal(2);

      const otherPosts = await postContract.getPostsByTag("other");
      expect(otherPosts.length).to.equal(1);
    });

    it("一个帖子的多个标签应该都能被搜索到", async function () {
      await postContract.createPost("QmHash1", 0, ["tag1", "tag2", "tag3"]);

      const posts1 = await postContract.getPostsByTag("tag1");
      const posts2 = await postContract.getPostsByTag("tag2");
      const posts3 = await postContract.getPostsByTag("tag3");

      expect(posts1[0].ipfsHash).to.equal("QmHash1");
      expect(posts2[0].ipfsHash).to.equal("QmHash1");
      expect(posts3[0].ipfsHash).to.equal("QmHash1");
    });
  });

  describe("兼容性测试", function () {
    it("原有的获取帖子功能应该正常工作", async function () {
      await postContract.createPost("QmTest", 0, ["tag1"]);

      const post = await postContract.getPost(1);
      expect(post.ipfsHash).to.equal("QmTest");
      expect(post.contentType).to.equal(0);
    });

    it("获取最新帖子应该包含标签", async function () {
      await postContract.createPost("QmTest1", 0, ["tag1"]);
      await postContract.createPost("QmTest2", 0, ["tag2"]);

      const posts = await postContract.getLatestPosts(2);
      expect(posts[0].tags.length).to.be.greaterThan(0);
      expect(posts[1].tags.length).to.be.greaterThan(0);
    });

    it("getTotalPosts 应该正常工作", async function () {
      await postContract.createPost("QmTest1", 0, ["tag1"]);
      await postContract.createPost("QmTest2", 0, []);

      expect(await postContract.getTotalPosts()).to.equal(2);
    });
  });

  describe("Gas 消耗测试", function () {
    it("应该记录带标签的帖子的 Gas 消耗", async function () {
      const tags = ["tag1", "tag2", "tag3"];
      const tx = await postContract.createPost("QmTest", 0, tags);
      const receipt = await tx.wait();

      console.log(`      带3个标签的 Gas 消耗: ${receipt.gasUsed.toString()}`);
      // 带标签功能后，Gas 消耗约为 530,000
      expect(receipt.gasUsed).to.be.lt(600000);
    });

    it("不带标签应该消耗更少 Gas", async function () {
      const tx = await postContract.createPost("QmTest", 0, []);
      const receipt = await tx.wait();

      console.log(`      不带标签的 Gas 消耗: ${receipt.gasUsed.toString()}`);
      // 不带标签的情况，Gas 消耗更少
      expect(receipt.gasUsed).to.be.lt(250000);
    });

    it("标签数量应该影响 Gas 消耗", async function () {
      // 测试不同数量标签的 Gas 消耗
      const tx1 = await postContract.createPost("QmTest1", 0, ["tag1"]);
      const receipt1 = await tx1.wait();

      const tx3 = await postContract.createPost("QmTest3", 0, ["tag1", "tag2", "tag3"]);
      const receipt3 = await tx3.wait();

      const tx5 = await postContract.createPost("QmTest5", 0, ["tag1", "tag2", "tag3", "tag4", "tag5"]);
      const receipt5 = await tx5.wait();

      console.log(`      1个标签 Gas: ${receipt1.gasUsed.toString()}`);
      console.log(`      3个标签 Gas: ${receipt3.gasUsed.toString()}`);
      console.log(`      5个标签 Gas: ${receipt5.gasUsed.toString()}`);

      // 验证：标签越多，Gas 越高
      expect(receipt1.gasUsed).to.be.lt(receipt3.gasUsed);
      expect(receipt3.gasUsed).to.be.lt(receipt5.gasUsed);
    });

    it("首次使用新标签应该比重复使用旧标签消耗更多 Gas", async function () {
      // 首次使用标签（需要添加到 allTags）
      const tx1 = await postContract.createPost("QmTest1", 0, ["newTag1"]);
      const receipt1 = await tx1.wait();

      // 重复使用相同标签（不需要添加到 allTags）
      const tx2 = await postContract.createPost("QmTest2", 0, ["newTag1"]);
      const receipt2 = await tx2.wait();

      console.log(`      首次使用标签 Gas: ${receipt1.gasUsed.toString()}`);
      console.log(`      重复使用标签 Gas: ${receipt2.gasUsed.toString()}`);

      // 首次使用会更贵（因为要更新 allTags 和 tagExists）
      expect(receipt1.gasUsed).to.be.gt(receipt2.gasUsed);
    });
  });
});