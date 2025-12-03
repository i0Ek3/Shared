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
	Hash string `json:"hash"`
	URL  string `json:"url"`
}

type PostData struct {
	Type      string `json:"type"`
	Content   string `json:"content"`
	Timestamp int64  `json:"timestamp"`
	Metadata  struct {
		MimeType string `json:"mimeType"`
	} `json:"metadata"`
}

func NewIPFSService(apiURL string) *IPFSService {
	return &IPFSService{
		shell: shell.NewShell(apiURL),
	}
}

func (s *IPFSService) UploadText(text string) (*UploadResponse, error) {
	postData := PostData{
		Type:      "text",
		Content:   text,
		Timestamp: time.Now().Unix(),
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
	}, nil
}

func (s *IPFSService) UploadFile(file io.Reader, mimeType string, fileType string) (*UploadResponse, error) {
	// 首先上传文件本身
	fileHash, err := s.shell.Add(file)
	if err != nil {
		return nil, fmt.Errorf("failed to upload file to IPFS: %w", err)
	}

	// 创建元数据
	postData := PostData{
		Type:      fileType,
		Content:   fileHash, // 存储文件的 IPFS 哈希
		Timestamp: time.Now().Unix(),
	}
	postData.Metadata.MimeType = mimeType

	jsonData, err := json.Marshal(postData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal JSON: %w", err)
	}

	// 上传元数据
	metadataHash, err := s.shell.Add(bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to upload metadata to IPFS: %w", err)
	}

	return &UploadResponse{
		Hash: metadataHash,
		URL:  fmt.Sprintf("https://ipfs.io/ipfs/%s", metadataHash),
	}, nil
}

func (s *IPFSService) GetContent(hash string) ([]byte, error) {
	reader, err := s.shell.Cat(hash)
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	
	return io.ReadAll(reader)
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

	// 上传文本
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

	return r
}

func main() {
	// 加载环境变量
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	ipfsURL := os.Getenv("IPFS_API_URL")
	if ipfsURL == "" {
		ipfsURL = "localhost:5001" // 默认本地 IPFS 节点
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

	// 启动服务器
	router := setupRouter(ipfsService)
	log.Printf("🚀 Server starting on port %s...", port)
	
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("❌ Failed to start server: %v", err)
	}
}