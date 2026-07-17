package config

import (
	"os"
	"strconv"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
	K8s      K8sConfig
	Engine   EngineConfig
	OIDC     OIDCConfig
	Jira     JiraConfig
	SCIM     SCIMConfig
}

type OIDCConfig struct {
	Issuer       string
	ClientID     string
	ClientSecret string
	RedirectURL  string
	DemoMode     bool
}

type JiraConfig struct {
	BaseURL  string
	Email    string
	APIToken string
	DemoMode bool
}

type SCIMConfig struct {
	Token string
}

type ServerConfig struct {
	Host string
	Port int
}

type DatabaseConfig struct {
	URL string
}

type RedisConfig struct {
	URL string
}

type JWTConfig struct {
	Secret     string
	ExpireHour int
}

type K8sConfig struct {
	InCluster   bool
	ExecutionNS string
	SystemNS    string
}

type EngineConfig struct {
	// Mode: simulate | http | jmeter | k6 | auto
	Mode        string
	JMeterImage string
	K6Image     string
	DefaultVUs  int
	MaxVUs      int
}

func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Host: getEnv("HOST", "0.0.0.0"),
			Port: getEnvInt("PORT", 8080),
		},
		Database: DatabaseConfig{
			URL: getEnv("DATABASE_URL", "postgresql://speedrunner:speedrunner_secret@localhost:5432/speedrunner"),
		},
		Redis: RedisConfig{
			URL: getEnv("REDIS_URL", "redis://localhost:6379"),
		},
		JWT: JWTConfig{
			Secret:     getEnv("JWT_SECRET", "speedrunner-dev-secret-change-in-production"),
			ExpireHour: getEnvInt("JWT_EXPIRE_HOURS", 24),
		},
		K8s: K8sConfig{
			InCluster:   getEnv("K8S_IN_CLUSTER", "false") == "true",
			ExecutionNS: getEnv("K8S_EXECUTION_NS", "marathonrunner-execution"),
			SystemNS:    getEnv("K8S_SYSTEM_NS", "marathonrunner-system"),
		},
		Engine: EngineConfig{
			Mode:        getEnv("ENGINE_MODE", "simulate"),
			JMeterImage: getEnv("JMETER_IMAGE", "apache/jmeter:5.6.3"),
			K6Image:     getEnv("K6_IMAGE", "grafana/k6:latest"),
			DefaultVUs:  getEnvInt("DEFAULT_VUS", 10),
			MaxVUs:      getEnvInt("MAX_VUS", 1000),
		},
		OIDC: OIDCConfig{
			Issuer:       getEnv("OIDC_ISSUER", ""),
			ClientID:     getEnv("OIDC_CLIENT_ID", ""),
			ClientSecret: getEnv("OIDC_CLIENT_SECRET", ""),
			RedirectURL:  getEnv("OIDC_REDIRECT_URL", "http://localhost:8080/api/auth/oidc/callback"),
			// Default demo mode when no issuer so local UI can exercise the flow.
			DemoMode: getEnv("OIDC_DEMO_MODE", "") == "true" || getEnv("OIDC_ISSUER", "") == "",
		},
		Jira: JiraConfig{
			BaseURL:  getEnv("JIRA_BASE_URL", ""),
			Email:    getEnv("JIRA_EMAIL", ""),
			APIToken: getEnv("JIRA_API_TOKEN", ""),
			DemoMode: getEnv("JIRA_DEMO_MODE", "") == "true" || getEnv("JIRA_API_TOKEN", "") == "",
		},
		SCIM: SCIMConfig{
			Token: getEnv("SCIM_TOKEN", "speedrunner-scim-dev-token"),
		},
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

// MinIOConfig holds MinIO configuration
type MinIOConfig struct {
	Endpoint   string
	AccessKey  string
	SecretKey  string
	UseSSL     bool
	BucketName string
}
