package main

import "time"

type catalogData struct {
	Brands []string      `json:"brands"`
	Types  []string      `json:"types"`
	Items  []catalogItem `json:"items"`
}

type catalogItem struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Brand       string  `json:"brand"`
	Type        string  `json:"type"`
	Image       string  `json:"image"`
}

type basketItem struct {
	ProductID int     `json:"productId"`
	Name      string  `json:"name"`
	UnitPrice float64 `json:"unitPrice"`
	Image     string  `json:"image"`
	Brand     string  `json:"brand"`
	Type      string  `json:"type"`
	Quantity  int     `json:"quantity"`
}

type basketResponse struct {
	SessionID string       `json:"sessionId"`
	Items     []basketItem `json:"items"`
}

type updateBasketRequest struct {
	Items []basketItem `json:"items"`
}

type adminUpdateProductRequest struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Brand       string  `json:"brand"`
	Type        string  `json:"type"`
	Image       string  `json:"image"`
}

type createOrderRequest struct {
	SessionID string `json:"sessionId"`
	Email     string `json:"email"`
}

type loginRequest struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	SessionID string `json:"sessionId"`
}

type registerRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

type userResponse struct {
	ID          int64     `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"displayName"`
	Role        string    `json:"role"`
	CreatedAt   time.Time `json:"createdAt"`
}

type loginResponse struct {
	Token string       `json:"token"`
	User  userResponse `json:"user"`
}

type order struct {
	ID        int64        `json:"id"`
	SessionID string       `json:"sessionId"`
	Email     string       `json:"email"`
	Status    string       `json:"status"`
	Total     float64      `json:"total"`
	CreatedAt time.Time    `json:"createdAt"`
	Items     []basketItem `json:"items"`
}
