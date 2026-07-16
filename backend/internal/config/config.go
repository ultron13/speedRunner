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
