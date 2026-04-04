# syntax=docker/dockerfile:1.7

# Stage 1: Build the Hugo site with a lighter Go toolchain image and downloaded Hugo binary.
FROM golang:alpine AS builder

ARG HUGO_VERSION=0.159.2

RUN apk add --no-cache git wget tar ca-certificates libc6-compat gcompat && \
    wget -qO /tmp/hugo.tar.gz \
      "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz" && \
    tar -xzf /tmp/hugo.tar.gz -C /usr/local/bin hugo && \
    rm /tmp/hugo.tar.gz

WORKDIR /site

# Copy go.mod/go.sum first to leverage layer caching
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

# Copy the rest of the site
COPY . .

# Build the static site; override baseURL so assets resolve at "/" when served
# by nginx (the config/hugo.toml baseURL targets GitHub Pages /CloudShirt-Hugo/).
RUN --mount=type=cache,target=/go/pkg/mod \
  --mount=type=cache,target=/root/.cache/go-build \
  hugo --gc --minify --baseURL /

# Stage 2: Serve with nginx
FROM nginx:1.29.7-alpine-slim

COPY --from=builder /site/public /usr/share/nginx/html

# Custom nginx config for SPA-like routing and caching headers
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ > /dev/null || exit 1
