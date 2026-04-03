package main

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type app struct {
	db *pgxpool.Pool
}

func main() {
	addr := envOrDefault("API_ADDR", ":8081")
	databaseURL := os.Getenv("DATABASE_URL")
	catalogPath := envOrDefault("CATALOG_JSON_PATH", "data/cloudshirt/catalog.json")

	if databaseURL == "" {
		log.Fatal("missing DATABASE_URL")
	}

	catalog, err := loadCatalog(catalogPath)
	if err != nil {
		log.Fatalf("load catalog: %v", err)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	defer pool.Close()

	if err := migrate(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	if err := seedCatalog(ctx, pool, catalog); err != nil {
		log.Fatalf("seed catalog: %v", err)
	}

	if err := seedDemoUser(ctx, pool); err != nil {
		log.Fatalf("seed demo user: %v", err)
	}

	a := &app{db: pool}
	mux := http.NewServeMux()
	mux.HandleFunc("/", a.handleRoot)
	mux.HandleFunc("/health", a.handleHealth)
	mux.HandleFunc("/api/health", a.handleHealth)
	mux.HandleFunc("/api/catalog/items", a.handleCatalogItems)
	mux.HandleFunc("/api/auth/register", a.handleRegister)
	mux.HandleFunc("/api/auth/login", a.handleLogin)
	mux.HandleFunc("/api/auth/logout", a.handleLogout)
	mux.HandleFunc("/api/auth/me", a.handleAuthMe)
	mux.HandleFunc("/api/basket/", a.handleBasketBySession)
	mux.HandleFunc("/api/orders", a.handleCreateOrder)
	mux.HandleFunc("/api/orders/me", a.handleOrdersMe)
	mux.HandleFunc("/api/orders/", a.handleOrdersBySession)
	mux.HandleFunc("/api/admin/orders", a.handleAdminOrders)
	mux.HandleFunc("/api/admin/products", a.handleAdminProducts)
	mux.HandleFunc("/api/admin/products/", a.handleAdminProductByID)

	handler := withJSON(withCORS(mux))
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("cloudshirt api listening on %s", addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func (a *app) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := a.db.Ping(r.Context()); err != nil {
		http.Error(w, "database unavailable", http.StatusServiceUnavailable)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *app) handleRoot(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"service": "cloudshirt-api",
		"status":  "ok",
		"links": map[string]string{
			"health":        "/api/health",
			"catalog":       "/api/catalog/items",
			"auth_login":    "/api/auth/login",
			"basket_sample": "/api/basket/{sessionId}",
		},
	})
}

func (a *app) handleCatalogItems(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	catalog, err := a.loadCatalogItems(r.Context())
	if err != nil {
		http.Error(w, "failed to load catalog", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, catalog)
}

func (a *app) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	payload, err := parseJSON[registerRequest](r.Body)
	if err != nil || strings.TrimSpace(payload.Email) == "" || strings.TrimSpace(payload.Password) == "" {
		http.Error(w, "invalid register payload", http.StatusBadRequest)
		return
	}

	displayName := strings.TrimSpace(payload.DisplayName)
	if displayName == "" {
		displayName = strings.TrimSpace(payload.Email)
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(payload.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "failed to hash password", http.StatusInternalServerError)
		return
	}

	var userID int64
	err = a.db.QueryRow(r.Context(), `
INSERT INTO users(email, display_name, password_hash, role)
VALUES ($1, $2, $3, 'user')
ON CONFLICT (email) DO NOTHING
RETURNING id;
`, strings.ToLower(strings.TrimSpace(payload.Email)), displayName, string(passwordHash)).Scan(&userID)
	if err != nil {
		http.Error(w, "user already exists", http.StatusConflict)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"id": userID, "email": strings.ToLower(strings.TrimSpace(payload.Email)), "displayName": displayName})
}

func (a *app) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	payload, err := parseJSON[loginRequest](r.Body)
	if err != nil {
		http.Error(w, "invalid login payload", http.StatusBadRequest)
		return
	}

	var user userResponse
	var passwordHash string
	var failedLoginAttempts int
	var lockoutUntil sql.NullTime
	err = a.db.QueryRow(r.Context(), `
SELECT id, email, display_name, role, password_hash, failed_login_attempts, lockout_until
FROM users
WHERE email = $1;
`, strings.ToLower(strings.TrimSpace(payload.Email))).Scan(&user.ID, &user.Email, &user.DisplayName, &user.Role, &passwordHash, &failedLoginAttempts, &lockoutUntil)
	if err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	if lockoutUntil.Valid && lockoutUntil.Time.After(time.Now()) {
		http.Error(w, "account locked", http.StatusLocked)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(payload.Password)); err != nil {
		newFailedAttempts := failedLoginAttempts + 1
		newLockoutUntil := sql.NullTime{Valid: false}
		statusCode := http.StatusUnauthorized
		message := "invalid credentials"

		if newFailedAttempts >= 5 {
			newFailedAttempts = 0
			newLockoutUntil = sql.NullTime{Time: time.Now().Add(15 * time.Minute), Valid: true}
			statusCode = http.StatusLocked
			message = "account locked"
		}

		_, updateErr := a.db.Exec(r.Context(), `
UPDATE users
SET failed_login_attempts = $2, lockout_until = $3
WHERE id = $1;
`, user.ID, newFailedAttempts, newLockoutUntil)
		if updateErr != nil {
			http.Error(w, "failed to update login attempts", http.StatusInternalServerError)
			return
		}

		http.Error(w, message, statusCode)
		return
	}

	_, err = a.db.Exec(r.Context(), `
UPDATE users
SET failed_login_attempts = 0, lockout_until = NULL
WHERE id = $1;
`, user.ID)
	if err != nil {
		http.Error(w, "failed to reset login attempts", http.StatusInternalServerError)
		return
	}

	if user.Role == "" {
		user.Role = "user"
	}

	token, err := generateToken()
	if err != nil {
		http.Error(w, "failed to create token", http.StatusInternalServerError)
		return
	}

	expiresAt := time.Now().Add(24 * time.Hour)
	_, err = a.db.Exec(r.Context(), `
INSERT INTO auth_sessions(token, user_id, expires_at)
VALUES ($1, $2, $3)
`, token, user.ID, expiresAt)
	if err != nil {
		http.Error(w, "failed to create session", http.StatusInternalServerError)
		return
	}

	if err := a.transferBasketToUserSession(r.Context(), user.ID, payload.SessionID); err != nil {
		http.Error(w, "failed to transfer basket", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{Token: token, User: user})
}

func (a *app) transferBasketToUserSession(ctx context.Context, userID int64, targetSessionID string) error {
	targetSessionID = strings.TrimSpace(targetSessionID)
	if targetSessionID == "" {
		return nil
	}

	tx, err := a.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
INSERT INTO baskets(session_id, user_id, updated_at)
VALUES ($1, $2, NOW())
ON CONFLICT (session_id)
DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW();
`, targetSessionID, userID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
UPDATE orders
SET user_id = $2
WHERE session_id = $1 AND user_id IS NULL;
`, targetSessionID, userID)
	if err != nil {
		return err
	}

	sourceRows, err := tx.Query(ctx, `
SELECT session_id
FROM baskets
WHERE user_id = $1 AND session_id <> $2
ORDER BY updated_at DESC;
`, userID, targetSessionID)
	if err != nil {
		return err
	}

	sourceSessionIDs := make([]string, 0)
	for sourceRows.Next() {
		var sourceSessionID string
		if err := sourceRows.Scan(&sourceSessionID); err != nil {
			sourceRows.Close()
			return err
		}
		sourceSessionIDs = append(sourceSessionIDs, sourceSessionID)
	}
	sourceRows.Close()

	for _, sourceSessionID := range sourceSessionIDs {
		rows, err := tx.Query(ctx, `
SELECT product_id, name, unit_price::float8, image, brand, type, quantity
FROM basket_items
WHERE session_id = $1;
`, sourceSessionID)
		if err != nil {
			return err
		}

		items := make([]basketItem, 0)
		for rows.Next() {
			var item basketItem
			if err := rows.Scan(&item.ProductID, &item.Name, &item.UnitPrice, &item.Image, &item.Brand, &item.Type, &item.Quantity); err != nil {
				rows.Close()
				return err
			}
			items = append(items, item)
		}
		rows.Close()

		for _, item := range items {
			_, err = tx.Exec(ctx, `
INSERT INTO basket_items (session_id, product_id, name, unit_price, image, brand, type, quantity)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (session_id, product_id)
DO UPDATE SET
	name = EXCLUDED.name,
	unit_price = EXCLUDED.unit_price,
	image = EXCLUDED.image,
	brand = EXCLUDED.brand,
	type = EXCLUDED.type,
	quantity = basket_items.quantity + EXCLUDED.quantity;
`, targetSessionID, item.ProductID, item.Name, item.UnitPrice, item.Image, item.Brand, item.Type, item.Quantity)
			if err != nil {
				return err
			}
		}

		_, err = tx.Exec(ctx, "DELETE FROM basket_items WHERE session_id = $1", sourceSessionID)
		if err != nil {
			return err
		}

		_, err = tx.Exec(ctx, `
UPDATE orders
SET session_id = $2, user_id = $3
WHERE session_id = $1;
`, sourceSessionID, targetSessionID, userID)
		if err != nil {
			return err
		}

		_, err = tx.Exec(ctx, "DELETE FROM baskets WHERE session_id = $1", sourceSessionID)
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec(ctx, "UPDATE baskets SET updated_at = NOW() WHERE session_id = $1", targetSessionID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (a *app) handleAuthMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user, _, err := a.requireAuthUser(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (a *app) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	_, token, err := a.requireAuthUser(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	_, err = a.db.Exec(r.Context(), "DELETE FROM auth_sessions WHERE token = $1", token)
	if err != nil {
		http.Error(w, "failed to logout", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "logged_out"})
}

func (a *app) handleBasketBySession(w http.ResponseWriter, r *http.Request) {
	sessionID := strings.TrimPrefix(r.URL.Path, "/api/basket/")
	if sessionID == "" {
		http.Error(w, "missing session id", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		a.getBasket(w, r, sessionID)
	case http.MethodPut:
		a.putBasket(w, r, sessionID)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *app) getBasket(w http.ResponseWriter, r *http.Request, sessionID string) {
	rows, err := a.db.Query(r.Context(), `
SELECT product_id, name, unit_price::float8, image, brand, type, quantity
FROM basket_items
WHERE session_id = $1
ORDER BY product_id;
`, sessionID)
	if err != nil {
		http.Error(w, "failed to load basket", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := make([]basketItem, 0)
	for rows.Next() {
		var item basketItem
		if err := rows.Scan(&item.ProductID, &item.Name, &item.UnitPrice, &item.Image, &item.Brand, &item.Type, &item.Quantity); err != nil {
			http.Error(w, "failed to parse basket", http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}

	writeJSON(w, http.StatusOK, basketResponse{SessionID: sessionID, Items: items})
}

func (a *app) putBasket(w http.ResponseWriter, r *http.Request, sessionID string) {
	payload, err := parseJSON[updateBasketRequest](r.Body)
	if err != nil {
		http.Error(w, "invalid basket payload", http.StatusBadRequest)
		return
	}

	authUser, _ := a.readAuthUser(r)
	userID := nullableInt64(authUser)

	tx, err := a.db.Begin(r.Context())
	if err != nil {
		http.Error(w, "failed to start transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(), `
INSERT INTO baskets(session_id, user_id, updated_at)
VALUES ($1, $2, NOW())
ON CONFLICT (session_id)
DO UPDATE SET updated_at = NOW(), user_id = COALESCE(EXCLUDED.user_id, baskets.user_id);
`, sessionID, userID)
	if err != nil {
		http.Error(w, "failed to upsert basket", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(r.Context(), "DELETE FROM basket_items WHERE session_id = $1", sessionID)
	if err != nil {
		http.Error(w, "failed to clear basket", http.StatusInternalServerError)
		return
	}

	for _, item := range payload.Items {
		if item.ProductID <= 0 || item.Quantity <= 0 || item.Name == "" {
			http.Error(w, "invalid basket item", http.StatusBadRequest)
			return
		}

		_, err = tx.Exec(r.Context(), `
INSERT INTO basket_items (session_id, product_id, name, unit_price, image, brand, type, quantity)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`, sessionID, item.ProductID, item.Name, item.UnitPrice, item.Image, item.Brand, item.Type, item.Quantity)
		if err != nil {
			http.Error(w, "failed to store basket item", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "failed to save basket", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, basketResponse{SessionID: sessionID, Items: payload.Items})
}

func (a *app) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	payload, err := parseJSON[createOrderRequest](r.Body)
	if err != nil || payload.SessionID == "" {
		http.Error(w, "invalid order payload", http.StatusBadRequest)
		return
	}

	authUser, _ := a.readAuthUser(r)

	tx, err := a.db.Begin(r.Context())
	if err != nil {
		http.Error(w, "failed to start transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	rows, err := tx.Query(r.Context(), `
SELECT product_id, name, unit_price::float8, image, brand, type, quantity
FROM basket_items
WHERE session_id = $1
ORDER BY product_id;
`, payload.SessionID)
	if err != nil {
		http.Error(w, "failed to load basket", http.StatusInternalServerError)
		return
	}

	items := make([]basketItem, 0)
	for rows.Next() {
		var item basketItem
		if err := rows.Scan(&item.ProductID, &item.Name, &item.UnitPrice, &item.Image, &item.Brand, &item.Type, &item.Quantity); err != nil {
			rows.Close()
			http.Error(w, "failed to parse basket", http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}
	rows.Close()

	if len(items) == 0 {
		http.Error(w, "basket is empty", http.StatusBadRequest)
		return
	}

	total := 0.0
	for _, item := range items {
		total += item.UnitPrice * float64(item.Quantity)
	}

	email := strings.TrimSpace(payload.Email)
	if email == "" && authUser != nil {
		email = authUser.Email
	}

	userID := nullableInt64(authUser)

	var orderID int64
	err = tx.QueryRow(r.Context(), `
INSERT INTO orders(session_id, user_id, email, status, total_amount)
VALUES ($1, $2, $3, 'submitted', $4)
RETURNING id;
`, payload.SessionID, userID, nullableString(email), total).Scan(&orderID)
	if err != nil {
		http.Error(w, "failed to create order", http.StatusInternalServerError)
		return
	}

	for _, item := range items {
		_, err = tx.Exec(r.Context(), `
INSERT INTO order_items(order_id, product_id, name, unit_price, image, brand, type, quantity)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`, orderID, item.ProductID, item.Name, item.UnitPrice, item.Image, item.Brand, item.Type, item.Quantity)
		if err != nil {
			http.Error(w, "failed to save order item", http.StatusInternalServerError)
			return
		}
	}

	_, err = tx.Exec(r.Context(), "DELETE FROM basket_items WHERE session_id = $1", payload.SessionID)
	if err != nil {
		http.Error(w, "failed to clear basket", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "failed to commit order", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":        orderID,
		"sessionId": payload.SessionID,
		"status":    "submitted",
		"total":     total,
	})
}

func (a *app) handleOrdersMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	authUser, _, err := a.requireAuthUser(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	orders, err := a.loadOrders(r.Context(), "WHERE user_id = $1", authUser.ID)
	if err != nil {
		http.Error(w, "failed to load orders", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"orders": orders})
}

func (a *app) handleOrdersBySession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	_, _, err := a.requireAuthUser(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	sessionID := strings.TrimPrefix(r.URL.Path, "/api/orders/")
	if sessionID == "" {
		http.Error(w, "missing session id", http.StatusBadRequest)
		return
	}

	orders, err := a.loadOrders(r.Context(), "WHERE session_id = $1", sessionID)
	if err != nil {
		http.Error(w, "failed to load orders", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"orders": orders})
}

func (a *app) handleAdminOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	authUser, _, err := a.requireAuthUser(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if strings.ToLower(strings.TrimSpace(authUser.Role)) != "admin" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	limit := 100
	queryLimit := strings.TrimSpace(r.URL.Query().Get("limit"))
	if queryLimit != "" {
		if parsed, parseErr := strconv.Atoi(queryLimit); parseErr == nil {
			if parsed > 0 && parsed <= 500 {
				limit = parsed
			}
		}
	}

	orders, err := a.loadAdminOrders(r.Context(), limit)
	if err != nil {
		http.Error(w, "failed to load admin orders", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"orders": orders})
}

func (a *app) requireAdmin(r *http.Request) error {
	authUser, _, err := a.requireAuthUser(r)
	if err != nil {
		return err
	}

	if strings.ToLower(strings.TrimSpace(authUser.Role)) != "admin" {
		return errors.New("forbidden")
	}

	return nil
}

func (a *app) handleAdminProducts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := a.requireAdmin(r); err != nil {
		if err.Error() == "forbidden" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	catalog, err := a.loadCatalogItems(r.Context())
	if err != nil {
		http.Error(w, "failed to load products", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": catalog.Items})
}

func (a *app) handleAdminProductByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := a.requireAdmin(r); err != nil {
		if err.Error() == "forbidden" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	productIDText := strings.TrimPrefix(r.URL.Path, "/api/admin/products/")
	productID, parseErr := strconv.Atoi(strings.TrimSpace(productIDText))
	if parseErr != nil || productID <= 0 {
		http.Error(w, "invalid product id", http.StatusBadRequest)
		return
	}

	payload, err := parseJSON[adminUpdateProductRequest](r.Body)
	if err != nil {
		http.Error(w, "invalid product payload", http.StatusBadRequest)
		return
	}

	cleanName := strings.TrimSpace(payload.Name)
	cleanDescription := strings.TrimSpace(payload.Description)
	cleanBrand := strings.TrimSpace(payload.Brand)
	cleanType := strings.TrimSpace(payload.Type)
	cleanImage := strings.TrimSpace(payload.Image)

	if cleanName == "" || cleanBrand == "" || cleanType == "" || cleanImage == "" || payload.Price <= 0 {
		http.Error(w, "invalid product payload", http.StatusBadRequest)
		return
	}

	result, err := a.db.Exec(r.Context(), `
UPDATE products
SET name = $2,
	description = $3,
	price = $4,
	brand = $5,
	type = $6,
	image = $7,
	updated_at = NOW()
WHERE id = $1;
`, productID, cleanName, cleanDescription, payload.Price, cleanBrand, cleanType, cleanImage)
	if err != nil {
		http.Error(w, "failed to update product", http.StatusInternalServerError)
		return
	}

	if result.RowsAffected() == 0 {
		http.Error(w, "product not found", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id":          productID,
		"name":        cleanName,
		"description": cleanDescription,
		"price":       payload.Price,
		"brand":       cleanBrand,
		"type":        cleanType,
		"image":       cleanImage,
	})
}

func (a *app) loadCatalogItems(ctx context.Context) (catalogData, error) {
	rows, err := a.db.Query(ctx, `
SELECT id, name, description, price::float8, brand, type, image
FROM products
ORDER BY id;
`)
	if err != nil {
		return catalogData{}, err
	}
	defer rows.Close()

	items := make([]catalogItem, 0)
	brandSet := make(map[string]struct{})
	typeSet := make(map[string]struct{})
	for rows.Next() {
		var item catalogItem
		if err := rows.Scan(&item.ID, &item.Name, &item.Description, &item.Price, &item.Brand, &item.Type, &item.Image); err != nil {
			return catalogData{}, err
		}
		items = append(items, item)
		brandSet[item.Brand] = struct{}{}
		typeSet[item.Type] = struct{}{}
	}

	brands := make([]string, 0, len(brandSet))
	for brand := range brandSet {
		brands = append(brands, brand)
	}
	sort.Strings(brands)

	types := make([]string, 0, len(typeSet))
	for itemType := range typeSet {
		types = append(types, itemType)
	}
	sort.Strings(types)

	return catalogData{Brands: brands, Types: types, Items: items}, nil
}

func (a *app) loadOrders(ctx context.Context, whereClause string, arg any) ([]order, error) {
	return a.loadOrdersWithArgs(ctx, whereClause, arg)
}

func (a *app) loadAdminOrders(ctx context.Context, limit int) ([]order, error) {
	query := `
SELECT id, session_id, COALESCE(email, ''), status, total_amount::float8, created_at
FROM orders
ORDER BY created_at DESC
LIMIT $1;
`

	rows, err := a.db.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := make([]order, 0)
	for rows.Next() {
		var o order
		if err := rows.Scan(&o.ID, &o.SessionID, &o.Email, &o.Status, &o.Total, &o.CreatedAt); err != nil {
			return nil, err
		}

		items, err := a.loadOrderItems(ctx, o.ID)
		if err != nil {
			return nil, err
		}
		o.Items = items
		orders = append(orders, o)
	}

	return orders, nil
}

func (a *app) loadOrdersWithArgs(ctx context.Context, whereClause string, args ...any) ([]order, error) {
	query := `
SELECT id, session_id, COALESCE(email, ''), status, total_amount::float8, created_at
FROM orders
` + whereClause + `
ORDER BY created_at DESC;
`

	rows, err := a.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := make([]order, 0)
	for rows.Next() {
		var o order
		if err := rows.Scan(&o.ID, &o.SessionID, &o.Email, &o.Status, &o.Total, &o.CreatedAt); err != nil {
			return nil, err
		}

		items, err := a.loadOrderItems(ctx, o.ID)
		if err != nil {
			return nil, err
		}
		o.Items = items
		orders = append(orders, o)
	}

	return orders, nil
}

func (a *app) loadOrderItems(ctx context.Context, orderID int64) ([]basketItem, error) {
	rows, err := a.db.Query(ctx, `
SELECT product_id, name, unit_price::float8, image, brand, type, quantity
FROM order_items
WHERE order_id = $1
ORDER BY id;
`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]basketItem, 0)
	for rows.Next() {
		var item basketItem
		if err := rows.Scan(&item.ProductID, &item.Name, &item.UnitPrice, &item.Image, &item.Brand, &item.Type, &item.Quantity); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, nil
}
