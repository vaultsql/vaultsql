package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/go-chi/chi/v5/middleware"
	"gitlab.com/vaultsql/query_service/config"
	"gitlab.com/vaultsql/query_service/types"
)

// RequestLogger logs incoming requests and their response status
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

		defer func() {
			status := ww.Status()
			duration := time.Since(start)

			fields := []any{
				"method", r.Method,
				"path", r.URL.Path,
				"status", status,
				"duration_ms", duration.Milliseconds(),
				"remote_addr", r.RemoteAddr,
			}

			if status >= 500 {
				config.Logger.Error("HTTP request error", fields...)
			} else if status >= 400 {
				config.Logger.Warn("HTTP request client error", fields...)
			} else {
				config.Logger.Info("HTTP request", fields...)
			}
		}()

		next.ServeHTTP(ww, r)
	})
}

// Recoverer recovers from panics and logs them
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				err, ok := rec.(error)
				if !ok {
					err = fmt.Errorf("%v", rec)
				}

				config.Logger.Error("Panic recovered",
					"error", err,
					"method", r.Method,
					"path", r.URL.Path,
					"remote_addr", r.RemoteAddr)

				sentry.CaptureException(err)

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(types.ErrorResponse{Detail: "Internal server error"})
			}
		}()

		next.ServeHTTP(w, r)
	})
}
