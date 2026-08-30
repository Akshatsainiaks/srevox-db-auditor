# Build Stage
FROM rust:1.77-alpine AS builder
RUN apk add --no-gradient --no-cache musl-dev gcc
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

# Final Stage
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/target/release/db-audit-processor .
CMD ["./db-audit-processor"]
