import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import PostContract from './contracts/PostContract.json';
import contractAddress from './contracts/contract-address.json';
import { motion, AnimatePresence } from 'framer-motion';

interface Post {
  id: number;
  ipfsHash: string;
  contentType: number;
  timestamp: number;
  publisher: string;
  tags: string[];
  content?: any;
}

const CONTENT_TYPES = ['TEXT', 'IMAGE', 'VIDEO'];
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

// 标签解析工具
const extractTags = (text: string): string[] => {
  const tagRegex = /#([a-zA-Z0-9\u4e00-\u9fa5]+)/g;
  const matches = text.matchAll(tagRegex);
  const tags = new Set<string>();

  for (const match of matches) {
    if (match[1]) {
      tags.add(match[1]);
    }
  }

  return Array.from(tags);
};

function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 搜索相关状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'all' | 'tag'>('all');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');

  // 初始化 Web3
  useEffect(() => {
    const init = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const web3Provider = new ethers.BrowserProvider(window.ethereum);
          setProvider(web3Provider);

          const signer = await web3Provider.getSigner();
          const postContract = new ethers.Contract(
            contractAddress.PostContract,
            PostContract.abi,
            signer
          );
          setContract(postContract);

          loadPosts(postContract);
          loadAllTags(postContract);
        } catch (error) {
          console.error('Failed to initialize Web3:', error);
        }
      } else {
        alert('请安装 MetaMask 钱包!');
      }
    };

    init();
  }, []);

  // 加载所有标签
  const loadAllTags = async (contractInstance: ethers.Contract) => {
    try {
      const tags = await contractInstance.getAllTags();
      setAllTags(tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  // 加载帖子
  const loadPosts = async (contractInstance: ethers.Contract) => {
    try {
      setLoading(true);
      const totalPosts = await contractInstance.getTotalPosts();
      const latestPosts = await contractInstance.getLatestPosts(
        totalPosts > 20n ? 20n : totalPosts
      );

      const postsWithContent = await Promise.all(
        latestPosts.map(async (post: any) => {
          try {
            const response = await fetch(`${BACKEND_URL}/api/content/${post.ipfsHash}`);
            const content = await response.json();
            return {
              id: Number(post.id),
              ipfsHash: post.ipfsHash,
              contentType: Number(post.contentType),
              timestamp: Number(post.timestamp),
              publisher: post.publisher,
              tags: post.tags || [],
              content,
            };
          } catch (error) {
            console.error('Failed to load content:', error);
            return {
              id: Number(post.id),
              ipfsHash: post.ipfsHash,
              contentType: Number(post.contentType),
              timestamp: Number(post.timestamp),
              publisher: post.publisher,
              tags: post.tags || [],
            };
          }
        })
      );

      setPosts(postsWithContent);
      setFilteredPosts(postsWithContent);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  };

  // 搜索功能
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setFilteredPosts(posts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = posts.filter((post) => {
      // 按标签搜索
      if (searchMode === 'tag') {
        return post.tags.some((tag) =>
          tag.toLowerCase().includes(query)
        );
      }

      // 全文搜索
      const contentMatch = post.content?.content?.toLowerCase().includes(query);
      const tagMatch = post.tags.some((tag) =>
        tag.toLowerCase().includes(query)
      );

      return contentMatch || tagMatch;
    });

    setFilteredPosts(filtered);
  };

  // 按标签筛选
  const filterByTag = async (tag: string) => {
    if (!contract) return;

    try {
      setLoading(true);
      setSelectedTag(tag);

      const taggedPosts = await contract.getPostsByTag(tag);
      const postsWithContent = await Promise.all(
        taggedPosts.map(async (post: any) => {
          try {
            const response = await fetch(`${BACKEND_URL}/api/content/${post.ipfsHash}`);
            const content = await response.json();
            return {
              id: Number(post.id),
              ipfsHash: post.ipfsHash,
              contentType: Number(post.contentType),
              timestamp: Number(post.timestamp),
              publisher: post.publisher,
              tags: post.tags || [],
              content,
            };
          } catch (error) {
            return null;
          }
        })
      );

      setFilteredPosts(postsWithContent.filter(p => p !== null) as Post[]);
    } catch (error) {
      console.error('Failed to filter by tag:', error);
    } finally {
      setLoading(false);
    }
  };

  // 清除筛选
  const clearFilter = () => {
    setSelectedTag('');
    setSearchQuery('');
    setFilteredPosts(posts);
  };

  // 连接钱包
  const connectWallet = async () => {
    if (!provider) return;
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setFileType('image');
      setSelectedFile(file);
    } else if (file.type.startsWith('video/')) {
      setFileType('video');
      setSelectedFile(file);
    } else {
      alert('只支持图片和视频文件!');
    }
  };

  // 提交内容
  const handleSubmit = async () => {
    if (!contract) {
      await connectWallet();
      return;
    }

    if (!inputText && !selectedFile) {
      alert('请输入内容或选择文件!');
      return;
    }

    setIsSubmitting(true);

    try {
      let ipfsHash: string;
      let contentType: number;
      let tags: string[] = [];

      if (selectedFile && fileType) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('type', fileType);

        const response = await fetch(`${BACKEND_URL}/api/upload/file`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        ipfsHash = data.hash;
        contentType = fileType === 'image' ? 1 : 2;
        tags = data.tags || [];
      } else {
        const response = await fetch(`${BACKEND_URL}/api/upload/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText }),
        });

        const data = await response.json();
        ipfsHash = data.hash;
        contentType = 0;
        tags = data.tags || [];
      }

      // 写入区块链（包含标签）
      const tx = await contract.createPost(ipfsHash, contentType, tags);
      await tx.wait();

      alert(`发布成功！${tags.length > 0 ? `标签: ${tags.join(', ')}` : ''}`);
      setInputText('');
      setSelectedFile(null);
      setFileType(null);

      // 重新加载
      loadPosts(contract);
      loadAllTags(contract);
    } catch (error: any) {
      console.error('Failed to submit:', error);
      alert(`发布失败: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            Shared
          </h1>
          <p className="text-gray-300 text-lg">
            匿名 · 不可删除 · 永久保存 · 支持标签
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20"
        >
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索内容或标签..."
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 outline-none focus:border-blue-400"
            />
            <select
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value as 'all' | 'tag')}
              className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white outline-none"
            >
              <option value="all">全部</option>
              <option value="tag">仅标签</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-blue-500 rounded-lg hover:bg-blue-600 transition"
            >
              🔍 搜索
            </button>
            {(searchQuery || selectedTag) && (
              <button
                onClick={clearFilter}
                className="px-4 py-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition"
              >
                ✕
              </button>
            )}
          </div>

          {/* 热门标签 */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-400">热门标签:</span>
              {allTags.slice(0, 10).map((tag) => (
                <button
                  key={tag}
                  onClick={() => filterByTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm transition ${selectedTag === tag
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 hover:bg-white/20'
                    }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 border border-white/20"
        >
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="分享你的想法...（使用 #标签名 添加标签，如 #技术 #区块链）"
            className="w-full bg-transparent border-none outline-none text-white placeholder-gray-400 resize-none text-lg"
            rows={4}
            disabled={isSubmitting || !!selectedFile}
          />

          {/* 实时标签预览 */}
          {inputText && extractTags(inputText).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-sm text-gray-400">标签:</span>
              {extractTags(inputText).map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-blue-500/20 rounded text-sm"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isSubmitting || !!inputText}
                />
                <div className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition">
                  📎 上传文件
                </div>
              </label>
              {selectedFile && (
                <div className="px-4 py-2 bg-green-500/20 rounded-lg flex items-center gap-2">
                  <span>{selectedFile.name}</span>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setFileType(null);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (!inputText && !selectedFile)}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? '发布中...' : '永久发布'}
            </button>
          </div>
        </motion.div>

        {/* Posts Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">
            {selectedTag ? `标签: #${selectedTag}` : '最新分享'}
            <span className="text-sm text-gray-400 ml-2">
              ({filteredPosts.length} 条)
            </span>
          </h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : (
            <AnimatePresence>
              {filteredPosts.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">
                        {CONTENT_TYPES[post.contentType]}
                      </span>
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex gap-1">
                          {post.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              onClick={() => filterByTag(tag)}
                              className="px-2 py-0.5 bg-blue-500/20 rounded text-xs cursor-pointer hover:bg-blue-500/30"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-gray-400">
                      {new Date(post.timestamp * 1000).toLocaleString()}
                    </span>
                  </div>

                  {post.content && (
                    <div className="mt-4">
                      {post.contentType === 0 && (
                        <p className="text-white whitespace-pre-wrap">
                          {post.content.content}
                        </p>
                      )}
                      {post.contentType === 1 && (
                        <img
                          src={`https://ipfs.io/ipfs/${post.content.content}`}
                          alt="Shared content"
                          className="rounded-lg max-w-full"
                        />
                      )}
                      {post.contentType === 2 && (
                        <video
                          src={`https://ipfs.io/ipfs/${post.content.content}`}
                          controls
                          className="rounded-lg max-w-full"
                        />
                      )}
                    </div>
                  )}

                  <div className="mt-4 text-xs text-gray-500 font-mono">
                    IPFS: {post.ipfsHash}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;