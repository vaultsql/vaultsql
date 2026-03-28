package config

import (
	"context"
	"log"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/joho/godotenv"
	slogbetterstack "github.com/samber/slog-betterstack"
)

var Logger *slog.Logger
var sentryEnabled bool

type fanoutHandler struct {
	handlers []slog.Handler
}

type Config struct {
	Port               string
	Debug              bool
	VaultSQLAPI        string
	QueryServiceSecret string
	SSHPrivateKey      string
}

func Load() *Config {
	loaded := false
	for _, path := range []string{"env.txt", "../env.txt", ".env"} {
		if err := godotenv.Load(path); err == nil {
			loaded = true
		}
	}
	if !loaded {
		log.Println("No env.txt or .env file found, using environment variables")
	}

	cfg := &Config{
		Port:               getEnvFirst("9000", "QUERY_PORT", "PORT"),
		Debug:              getEnvBool("QUERY_DEBUG", "DEBUG"),
		VaultSQLAPI:        getEnvFirst("http://localhost:8000/", "APP_INTERNAL_API", "VAULTSQL_API"),
		QueryServiceSecret: getEnvFirst("", "QUERY_SERVICE_SECRET"),
		SSHPrivateKey:      getEnvFirst("", "QUERY_SSH_PRIVATE_KEY", "SSH_PRIVATE_KEY"),
	}

	initSentry(
		getEnvFirst("", "QUERY_SENTRY_DSN", "SENTRY_DSN"),
		getEnvFirst("1.0", "QUERY_SENTRY_TRACES_SAMPLE_RATE"),
	)
	initLogger(
		cfg.Debug,
		getEnvFirst("", "QUERY_BETTERSTACK_TOKEN", "BETTERSTACK_SOURCE_TOKEN"),
		getEnvFirst(
			"https://in.logs.betterstack.com",
			"QUERY_BETTERSTACK_ENDPOINT",
			"BETTERSTACK_HOST",
		),
	)

	return cfg
}

func getEnvFirst(defaultVal string, keys ...string) string {
	for _, key := range keys {
		if v := os.Getenv(key); v != "" {
			return v
		}
	}
	return defaultVal
}

func getEnvBool(keys ...string) bool {
	value := strings.ToLower(getEnvFirst("", keys...))
	return value == "true" || value == "1" || value == "t"
}

func initSentry(dsn string, tracesSampleRate string) {
	if dsn == "" {
		log.Println("Sentry DSN not configured, Sentry disabled for query service")
		return
	}

	rate, err := strconv.ParseFloat(tracesSampleRate, 64)
	if err != nil {
		log.Printf(
			"invalid QUERY_SENTRY_TRACES_SAMPLE_RATE=%q, using default 1.0",
			tracesSampleRate,
		)
		rate = 1.0
	}

	err = sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		TracesSampleRate: rate,
	})
	if err != nil {
		log.Fatalf("sentry.Init: %s", err)
	}
	sentryEnabled = true
}

func initLogger(debug bool, betterStackToken string, betterStackEndpoint string) {
	handlers := []slog.Handler{slog.NewJSONHandler(os.Stdout, nil)}

	if betterStackToken == "" {
		Logger = slog.New(&fanoutHandler{handlers: handlers})
		if debug {
			Logger.Info("Running in DEBUG mode with stdout JSON logging")
		} else {
			Logger.Info("BetterStack token not configured, using stdout JSON logging only")
		}
		return
	}

	handlers = append(
		handlers,
		slogbetterstack.Option{
			Token:    betterStackToken,
			Endpoint: betterStackEndpoint,
		}.NewBetterstackHandler(),
	)
	Logger = slog.New(&fanoutHandler{handlers: handlers})
	if debug {
		Logger.Info("Running in DEBUG mode with stdout JSON logging and BetterStack enabled")
	} else {
		Logger.Info("BetterStack logging configured; stdout JSON logging remains enabled")
	}
}

func FlushSentry() {
	if !sentryEnabled {
		return
	}
	sentry.Flush(2 * time.Second)
}

func (h *fanoutHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, handler := range h.handlers {
		if handler.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (h *fanoutHandler) Handle(ctx context.Context, record slog.Record) error {
	var firstErr error
	for _, handler := range h.handlers {
		if !handler.Enabled(ctx, record.Level) {
			continue
		}
		if err := handler.Handle(ctx, record); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func (h *fanoutHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	handlers := make([]slog.Handler, 0, len(h.handlers))
	for _, handler := range h.handlers {
		handlers = append(handlers, handler.WithAttrs(attrs))
	}
	return &fanoutHandler{handlers: handlers}
}

func (h *fanoutHandler) WithGroup(name string) slog.Handler {
	handlers := make([]slog.Handler, 0, len(h.handlers))
	for _, handler := range h.handlers {
		handlers = append(handlers, handler.WithGroup(name))
	}
	return &fanoutHandler{handlers: handlers}
}
