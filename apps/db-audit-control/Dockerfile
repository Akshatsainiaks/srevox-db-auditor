# Build Stage
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY cmd ./cmd
COPY pkg ./pkg
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# Final Stage
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 7003
CMD ["./server"]
