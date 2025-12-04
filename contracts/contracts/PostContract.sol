// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Shared - 匿名不可删除内容分享平台
 * @notice 此合约用于存储内容的 IPFS 哈希，内容一旦发布不可删除
 */
contract PostContract {
    
    // 内容类型枚举
    enum ContentType { TEXT, IMAGE, VIDEO }
    
    // 帖子结构（新增 tags 字段）
    struct Post {
        uint256 id;              // 帖子唯一ID
        string ipfsHash;         // IPFS 内容哈希
        ContentType contentType; // 内容类型
        uint256 timestamp;       // 发布时间戳
        address publisher;       // 发布者地址（匿名）
        string[] tags;           // 标签数组（新增）
    }
    
    // 状态变量
    uint256 private postCounter;
    mapping(uint256 => Post) public posts;
    
    // 标签索引：tag => 帖子ID数组
    mapping(string => uint256[]) public tagToPosts;
    
    // 所有使用过的标签
    string[] private allTags;
    mapping(string => bool) private tagExists;
    
    // 事件（新增 tags 参数）
    event PostCreated(
        uint256 indexed id,
        string ipfsHash,
        ContentType contentType,
        uint256 timestamp,
        address indexed publisher,
        string[] tags
    );
    
    /**
     * @notice 创建新帖子（带标签）
     * @param _ipfsHash IPFS 内容哈希
     * @param _contentType 内容类型 (0=文字, 1=图片, 2=视频)
     * @param _tags 标签数组（例如：["技术", "blockchain"]）
     */
    function createPost(
        string memory _ipfsHash,
        ContentType _contentType,
        string[] memory _tags
    ) external {
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(_tags.length <= 10, "Too many tags (max 10)");
        
        postCounter++;
        
        // 验证和处理标签
        for (uint256 i = 0; i < _tags.length; i++) {
            require(bytes(_tags[i]).length > 0, "Tag cannot be empty");
            require(bytes(_tags[i]).length <= 50, "Tag too long (max 50 chars)");
            
            // 添加到标签索引
            tagToPosts[_tags[i]].push(postCounter);
            
            // 记录新标签
            if (!tagExists[_tags[i]]) {
                allTags.push(_tags[i]);
                tagExists[_tags[i]] = true;
            }
        }
        
        posts[postCounter] = Post({
            id: postCounter,
            ipfsHash: _ipfsHash,
            contentType: _contentType,
            timestamp: block.timestamp,
            publisher: msg.sender,
            tags: _tags
        });
        
        emit PostCreated(
            postCounter,
            _ipfsHash,
            _contentType,
            block.timestamp,
            msg.sender,
            _tags
        );
    }
    
    /**
     * @notice 获取帖子详情
     * @param _postId 帖子ID
     * @return Post 结构体
     */
    function getPost(uint256 _postId) external view returns (Post memory) {
        require(_postId > 0 && _postId <= postCounter, "Invalid post ID");
        return posts[_postId];
    }
    
    /**
     * @notice 获取最新的 N 个帖子
     * @param _count 获取数量
     * @return Post 数组
     */
    function getLatestPosts(uint256 _count) external view returns (Post[] memory) {
        require(_count > 0, "Count must be greater than 0");
        
        uint256 count = _count > postCounter ? postCounter : _count;
        Post[] memory latestPosts = new Post[](count);
        
        for (uint256 i = 0; i < count; i++) {
            latestPosts[i] = posts[postCounter - i];
        }
        
        return latestPosts;
    }
    
    /**
     * @notice 按标签搜索帖子
     * @param _tag 标签名称
     * @return Post 数组
     */
    function getPostsByTag(string memory _tag) external view returns (Post[] memory) {
        uint256[] memory postIds = tagToPosts[_tag];
        Post[] memory taggedPosts = new Post[](postIds.length);
        
        for (uint256 i = 0; i < postIds.length; i++) {
            taggedPosts[i] = posts[postIds[i]];
        }
        
        return taggedPosts;
    }
    
    /**
     * @notice 获取某个标签的帖子数量
     * @param _tag 标签名称
     * @return 帖子数量
     */
    function getPostCountByTag(string memory _tag) external view returns (uint256) {
        return tagToPosts[_tag].length;
    }
    
    /**
     * @notice 获取所有使用过的标签
     * @return 标签数组
     */
    function getAllTags() external view returns (string[] memory) {
        return allTags;
    }
    
    /**
     * @notice 获取热门标签（按帖子数量排序，前N个）
     * @param _count 返回数量
     * @return tags 标签数组
     * @return counts 对应的帖子数量
     */
    function getTopTags(uint256 _count) external view returns (
        string[] memory tags,
        uint256[] memory counts
    ) {
        require(_count > 0, "Count must be greater than 0");
        
        uint256 resultCount = _count > allTags.length ? allTags.length : _count;
        tags = new string[](resultCount);
        counts = new uint256[](resultCount);
        
        // 简单的冒泡排序（链上操作，不适合大量数据）
        string[] memory tempTags = new string[](allTags.length);
        uint256[] memory tempCounts = new uint256[](allTags.length);
        
        for (uint256 i = 0; i < allTags.length; i++) {
            tempTags[i] = allTags[i];
            tempCounts[i] = tagToPosts[allTags[i]].length;
        }
        
        // 排序
        for (uint256 i = 0; i < allTags.length; i++) {
            for (uint256 j = i + 1; j < allTags.length; j++) {
                if (tempCounts[i] < tempCounts[j]) {
                    // 交换
                    uint256 tempCount = tempCounts[i];
                    tempCounts[i] = tempCounts[j];
                    tempCounts[j] = tempCount;
                    
                    string memory tempTag = tempTags[i];
                    tempTags[i] = tempTags[j];
                    tempTags[j] = tempTag;
                }
            }
        }
        
        // 返回前 N 个
        for (uint256 i = 0; i < resultCount; i++) {
            tags[i] = tempTags[i];
            counts[i] = tempCounts[i];
        }
        
        return (tags, counts);
    }
    
    /**
     * @notice 获取指定范围的帖子（分页）
     * @param _startId 起始ID
     * @param _endId 结束ID
     * @return Post 数组
     */
    function getPostsInRange(
        uint256 _startId,
        uint256 _endId
    ) external view returns (Post[] memory) {
        require(_startId > 0 && _startId <= postCounter, "Invalid start ID");
        require(_endId >= _startId && _endId <= postCounter, "Invalid end ID");
        
        uint256 count = _endId - _startId + 1;
        Post[] memory rangePosts = new Post[](count);
        
        for (uint256 i = 0; i < count; i++) {
            rangePosts[i] = posts[_startId + i];
        }
        
        return rangePosts;
    }
    
    /**
     * @notice 获取总帖子数
     * @return 帖子总数
     */
    function getTotalPosts() external view returns (uint256) {
        return postCounter;
    }
    
    /**
     * @notice 检查帖子是否存在
     * @param _postId 帖子ID
     * @return bool
     */
    function postExists(uint256 _postId) external view returns (bool) {
        return _postId > 0 && _postId <= postCounter;
    }
    
    /**
     * @notice 获取某地址发布的帖子数量
     * @param _publisher 发布者地址
     * @return 发布数量
     */
    function getPostCountByPublisher(address _publisher) external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 1; i <= postCounter; i++) {
            if (posts[i].publisher == _publisher) {
                count++;
            }
        }
        return count;
    }
}