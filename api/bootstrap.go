package main

import (
	"context"
	"encoding/json"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func loadCatalog(path string) (catalogData, error) {
	var catalog catalogData

	body, err := os.ReadFile(path)
	if err != nil {
		return catalog, err
	}

	if err := json.Unmarshal(body, &catalog); err != nil {
		return catalog, err
	}

	return catalog, nil
}

func migrate(ctx context.Context, pool *pgxpool.Pool) error {
	const schema = `
CREATE TABLE IF NOT EXISTS products (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	description TEXT NOT NULL,
	price NUMERIC(10,2) NOT NULL,
	brand TEXT NOT NULL,
	type TEXT NOT NULL,
	image TEXT NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
	id BIGSERIAL PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	display_name TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'user',
	password_hash TEXT NOT NULL,
	failed_login_attempts INTEGER NOT NULL DEFAULT 0,
	lockout_until TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
	token TEXT PRIMARY KEY,
	user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS baskets (
	session_id TEXT PRIMARY KEY,
	user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS basket_items (
	session_id TEXT NOT NULL REFERENCES baskets(session_id) ON DELETE CASCADE,
	product_id INTEGER NOT NULL,
	name TEXT NOT NULL,
	unit_price NUMERIC(10,2) NOT NULL,
	image TEXT NOT NULL,
	brand TEXT NOT NULL,
	type TEXT NOT NULL,
	quantity INTEGER NOT NULL CHECK (quantity > 0),
	PRIMARY KEY (session_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
	id BIGSERIAL PRIMARY KEY,
	session_id TEXT NOT NULL,
	user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
	email TEXT,
	status TEXT NOT NULL DEFAULT 'submitted',
	total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
	id BIGSERIAL PRIMARY KEY,
	order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
	product_id INTEGER NOT NULL,
	name TEXT NOT NULL,
	unit_price NUMERIC(10,2) NOT NULL,
	image TEXT NOT NULL,
	brand TEXT NOT NULL,
	type TEXT NOT NULL,
	quantity INTEGER NOT NULL CHECK (quantity > 0)
);

ALTER TABLE baskets ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMPTZ;
`

	_, err := pool.Exec(ctx, schema)
	return err
}

func seedCatalog(ctx context.Context, pool *pgxpool.Pool, catalog catalogData) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, item := range catalog.Items {
		_, err := tx.Exec(ctx, `
INSERT INTO products (id, name, description, price, brand, type, image, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
ON CONFLICT (id)
DO UPDATE SET
	name = EXCLUDED.name,
	description = EXCLUDED.description,
	price = EXCLUDED.price,
	brand = EXCLUDED.brand,
	type = EXCLUDED.type,
	image = EXCLUDED.image,
	updated_at = NOW();
`, item.ID, item.Name, item.Description, item.Price, item.Brand, item.Type, item.Image)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func seedDemoUser(ctx context.Context, pool *pgxpool.Pool) error {
	if err := seedUser(ctx, pool, envOrDefault("DEMO_USER_EMAIL", "demouser@microsoft.com"), envOrDefault("DEMO_USER_NAME", "CloudShirt Demo"), envOrDefault("DEMO_USER_PASSWORD", "Pass@word1"), "user"); err != nil {
		return err
	}

	return seedUser(ctx, pool, envOrDefault("ADMIN_USER_EMAIL", "admin@microsoft.com"), envOrDefault("ADMIN_USER_NAME", "CloudShirt Admin"), envOrDefault("ADMIN_USER_PASSWORD", "Pass@word1"), "admin")
}

func seedUser(ctx context.Context, pool *pgxpool.Pool, email, displayName, password, role string) error {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	cleanName := strings.TrimSpace(displayName)
	if cleanName == "" {
		cleanName = cleanEmail
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = pool.Exec(ctx, `
INSERT INTO users(email, display_name, password_hash, role)
VALUES ($1, $2, $3, $4)
ON CONFLICT (email)
DO UPDATE SET
	display_name = EXCLUDED.display_name,
	password_hash = EXCLUDED.password_hash,
	role = EXCLUDED.role;
`, cleanEmail, cleanName, string(passwordHash), role)

	return err
}

func envOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
