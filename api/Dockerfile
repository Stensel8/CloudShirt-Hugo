FROM golang:1.24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /bin/cloudshirt-api .

FROM alpine:3.22

WORKDIR /app
RUN apk add --no-cache ca-certificates wget
COPY --from=builder /bin/cloudshirt-api /app/cloudshirt-api
COPY --from=builder /app/data /app/data

EXPOSE 8081

ENTRYPOINT ["/app/cloudshirt-api"]
