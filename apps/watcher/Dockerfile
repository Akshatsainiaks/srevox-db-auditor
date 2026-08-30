FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o watcher ./cmd/watcher/main.go

FROM alpine:3.19

RUN adduser -D -u 1000 loopzen

COPY --from=builder /app/watcher /usr/local/bin/watcher

USER loopzen

CMD ["/usr/local/bin/watcher"]
