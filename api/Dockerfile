# syntax=docker/dockerfile:1.23

FROM golang:alpine AS builder

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY go.mod go.sum* ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /bin/cloudshirt-api .

FROM alpine:3.22

WORKDIR /app
RUN apk add --no-cache ca-certificates wget
COPY --from=builder /bin/cloudshirt-api /app/cloudshirt-api
COPY --from=builder /app/data /app/data

EXPOSE 8081

ENTRYPOINT ["/app/cloudshirt-api"]
