package main

import (
	crand "crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
)

func withJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		next.ServeHTTP(w, r)
	})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func parseJSON[T any](body io.ReadCloser) (T, error) {
	defer body.Close()
	var payload T
	decoder := json.NewDecoder(body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&payload); err != nil {
		return payload, err
	}

	return payload, nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("encode response: %v", err)
	}
}

func nullableString(value string) sql.NullString {
	if strings.TrimSpace(value) == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: strings.TrimSpace(value), Valid: true}
}

func nullableInt64(user *userResponse) sql.NullInt64 {
	if user == nil {
		return sql.NullInt64{Valid: false}
	}
	return sql.NullInt64{Int64: user.ID, Valid: true}
}

func generateToken() (string, error) {
	buffer := make([]byte, 32)
	if _, err := crand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}

func getBearerToken(r *http.Request) string {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(strings.ToLower(header), "bearer ") {
		return ""
	}
	return strings.TrimSpace(header[7:])
}

func (a *app) readAuthUser(r *http.Request) (*userResponse, error) {
	token := getBearerToken(r)
	if token == "" {
		return nil, errors.New("missing token")
	}

	var user userResponse
	err := a.db.QueryRow(r.Context(), `
SELECT u.id, u.email, u.display_name, u.role
FROM auth_sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token = $1 AND s.expires_at > NOW();
`, token).Scan(&user.ID, &user.Email, &user.DisplayName, &user.Role)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (a *app) requireAuthUser(r *http.Request) (*userResponse, string, error) {
	token := getBearerToken(r)
	if token == "" {
		return nil, "", errors.New("missing token")
	}

	user, err := a.readAuthUser(r)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}
