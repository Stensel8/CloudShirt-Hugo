# Stage 1: Build the Hugo site
FROM golang:1.24-alpine AS builder

ARG HUGO_VERSION=0.159.2

# Install Hugo extended
RUN apk add --no-cache wget gcc musl-dev git && \
    wget -qO /tmp/hugo.tar.gz \
      "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz" && \
    tar -xzf /tmp/hugo.tar.gz -C /usr/local/bin hugo && \
    rm /tmp/hugo.tar.gz

WORKDIR /site

# Copy go.mod/go.sum first to leverage layer caching
COPY go.mod go.sum ./
RUN hugo mod download

# Copy the rest of the site
COPY . .

# Build the static site
RUN hugo --gc --minify

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=builder /site/public /usr/share/nginx/html

# Custom nginx config for SPA-like routing and caching headers
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ > /dev/null || exit 1
