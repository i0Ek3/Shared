package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	shell "github.com/ipfs/go-ipfs-api"
	"github.com/joho/godotenv"
)

type IPFSService struct {
	shell *shell.Shell
}

type UploadResponse struct {
	Hash string   `json:"hash"`
	URL  string   `json:"url"`
	Tags []string `json:"tags"` // 新增：返回提取的标签
}

type PostData struct {
	Type      string   `json:"type"`
	Content   string   `json:"content"`
	Timestamp int64    `json:"timestamp"`
	Tags      []string `json:"tags"` // 新增：标签
	Metadata  struct {
		MimeType string `json:"mimeType"`
	} `json:"metadata"`
}

// 搜索请求
type SearchRequest struct {
	Query      string `json:"query"`
	SearchType string `json:"searchType"` // "tag" 或 "content"
}

// 搜索结果
type SearchResult struct {
	Posts []PostData `json:"posts"`
	Count int        `json:"count"`
}

// 标签提取正则（支持中英文）
var tagRegex = regexp.MustCompile(`#([a-zA-Z0-9\p{Han}]+)`)

func NewIPFSService(apiURL string) *IPFSService {
	return &IPFSService{
		shell: shell.NewShell(apiURL),
	}
}

// 从文本中提取标签
func extractTags(text string) []string {
	matches := tagRegex.FindAllStringSubmatch(text, -1)
	tags := make([]string, 0)
	seen := make(map[string]bool)

	for _, match := range matches {
		if len(match) > 1 {
			tag := match[1]
			// 去重
			if !seen[tag] {
				tags = append(tags, tag)
				seen[tag] = true
			}
		}
	}

	return tags
}

// 从内容中移除标签标记（可选，保留原文）
func removeTagMarkers(text string) string {
	// 如果想保留 # 号，就不用这个函数
	return tagRegex.ReplaceAllString(text, "$1")
}

func (s *IPFSService) UploadText(text string) (*UploadResponse, error) {
	// 提取标签
	tags := extractTags(text)

	postData := PostData{
		Type:      "text",
		Content:   text, // 保留原始内容（包含 # 标记）
		Timestamp: time.Now().Unix(),
		Tags:      tags,
	}
	postData.Metadata.MimeType = "text/plain"

	jsonData, err := json.Marshal(postData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal JSON: %w", err)
	}

	hash, err := s.shell.Add(bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to upload to IPFS: %w", err)
	}

	return &UploadResponse{
		Hash: hash,
		URL:  fmt.Sprintf("https://ipfs.io/ipfs/%s", hash),
		Tags: tags,
	}, nil
}

func (s *IPFSService) UploadFile(file io.Reader, mimeType string, fileType string) (*UploadResponse, error) {
	// 首先上传文件本身
	fileHash, err := s.shell.Add(file)
	if err != nil {
		return nil, fmt.Errorf("failed to upload file to IPFS: %w", err)
	}

	// 创建元数据（文件没有标签）
	postData := PostData{
		Type:      fileType,
		Content:   fileHash,
		Timestamp: time.Now().Unix(),
		Tags:      []string{}, // 文件类型暂不支持标签
	}
	postData.Metadata.MimeType = mimeType

	jsonData, err := json.Marshal(postData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal JSON: %w", err)
	}

	metadataHash, err := s.shell.Add(bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to upload metadata to IPFS: %w", err)
	}

	return &UploadResponse{
		Hash: metadataHash,
		URL:  fmt.Sprintf("https://ipfs.io/ipfs/%s", metadataHash),
		Tags: []string{},
	}, nil
}

func (s *IPFSService) GetContent(hash string) ([]byte, error) {
	readCloser, err := s.shell.Cat(hash)
	if err != nil {
		return nil, err
	}
	defer readCloser.Close()

	return io.ReadAll(readCloser)
}

// 搜索内容（从 IPFS 中模糊匹配）
func (s *IPFSService) SearchContent(query string, allHashes []string) ([]PostData, error) {
	results := make([]PostData, 0)
	query = strings.ToLower(query)

	for _, hash := range allHashes {
		readCloser, err := s.shell.Cat(hash)
		if err != nil {
			continue
		}

		content, err := io.ReadAll(readCloser)
		readCloser.Close()
		if err != nil {
			continue
		}

		var postData PostData
		if err := json.Unmarshal(content, &postData); err != nil {
			continue
		}

		// 模糊搜索：检查内容或标签
		contentLower := strings.ToLower(postData.Content)
		if strings.Contains(contentLower, query) {
			results = append(results, postData)
			continue
		}

		// 检查标签
		for _, tag := range postData.Tags {
			if strings.Contains(strings.ToLower(tag), query) {
				results = append(results, postData)
				break
			}
		}
	}

	return results, nil
}

func setupRouter(ipfsService *IPFSService) *gin.Engine {
	r := gin.Default()

	// CORS 配置
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000", "http://localhost:5173"}
	config.AllowMethods = []string{"GET", "POST", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept"}
	r.Use(cors.New(config))

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"time":   time.Now().Unix(),
		})
	})

	// 上传文本（返回标签）
	r.POST("/api/upload/text", func(c *gin.Context) {
		var req struct {
			Text string `json:"text" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		resp, err := ipfsService.UploadText(req.Text)
		if err != nil {
			log.Printf("Error uploading text: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload"})
			return
		}

		c.JSON(http.StatusOK, resp)
	})

	// 上传文件（图片/视频）
	r.POST("/api/upload/file", func(c *gin.Context) {
		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
			return
		}
		defer file.Close()

		fileType := c.PostForm("type")
		if fileType != "image" && fileType != "video" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type"})
			return
		}

		resp, err := ipfsService.UploadFile(file, header.Header.Get("Content-Type"), fileType)
		if err != nil {
			log.Printf("Error uploading file: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload"})
			return
		}

		c.JSON(http.StatusOK, resp)
	})

	// 获取内容
	r.GET("/api/content/:hash", func(c *gin.Context) {
		hash := c.Param("hash")
		content, err := ipfsService.GetContent(hash)
		if err != nil {
			log.Printf("Error getting content: %v", err)
			c.JSON(http.StatusNotFound, gin.H{"error": "Content not found"})
			return
		}

		var postData PostData
		if err := json.Unmarshal(content, &postData); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid content format"})
			return
		}

		c.JSON(http.StatusOK, postData)
	})

	// 搜索接口（新增）
	r.POST("/api/search", func(c *gin.Context) {
		var req SearchRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		// 注意：这是简化实现
		// 实际应该维护一个内容索引或使用区块链事件
		// 这里只是演示搜索逻辑
		c.JSON(http.StatusOK, gin.H{
			"message": "Search functionality requires frontend integration with smart contract",
			"query":   req.Query,
			"type":    req.SearchType,
		})
	})

	return r
}

func main() {
	// 加载环境变量
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	ipfsURL := os.Getenv("IPFS_API_URL")
	if ipfsURL == "" {
		ipfsURL = "localhost:5001"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// 初始化 IPFS 服务
	ipfsService := NewIPFSService(ipfsURL)

	// 测试 IPFS 连接
	_, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := ipfsService.shell.ID(); err != nil {
		log.Fatalf("❌ Failed to connect to IPFS: %v", err)
	}

	log.Println("✅ Connected to IPFS successfully")
	log.Println("✅ Tag extraction enabled (支持中英文标签)")

	// 启动服务器
	router := setupRouter(ipfsService)
	log.Printf("🚀 Server starting on port %s...", port)

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("❌ Failed to start server: %v", err)
	}
}
