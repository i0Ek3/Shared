// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Shared - 匿名不可删除内容分享平台
 * @notice 此合约用于存储内容的 IPFS 哈希，内容一旦发布不可删除
 */
contract PostContract {
    
    // 内容类型枚举
    enum ContentType { TEXT, IMAGE, VIDEO }
    
    // 帖子结构
    struct Post {
        uint256 id;              // 帖子唯一ID
        string ipfsHash;         // IPFS 内容哈希
        ContentType contentType; // 内容类型
        uint256 timestamp;       // 发布时间戳
        address publisher;       // 发布者地址（匿名）
    }
    
    // 状态变量
    uint256 private postCounter;
    mapping(uint256 => Post) public posts;
    
    // 事件
    event PostCreated(
        uint256 indexed id,
        string ipfsHash,
        ContentType contentType,
        uint256 timestamp,
        address indexed publisher
    );
    
    /**
     * @notice 创建新帖子
     * @param _ipfsHash IPFS 内容哈希
     * @param _contentType 内容类型 (0=文字, 1=图片, 2=视频)
     */
    function createPost(
        string memory _ipfsHash,
        ContentType _contentType
    ) external {
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        
        postCounter++;
        
        posts[postCounter] = Post({
            id: postCounter,
            ipfsHash: _ipfsHash,
            contentType: _contentType,
            timestamp: block.timestamp,
            publisher: msg.sender
        });
        
        emit PostCreated(
            postCounter,
            _ipfsHash,
            _contentType,
            block.timestamp,
            msg.sender
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