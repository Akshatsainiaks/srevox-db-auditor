# Builder Stage
FROM rust:1-slim AS builder
WORKDIR /usr/src/activity-service

# Install compilation dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy cargo manifest and sources
COPY Cargo.toml Cargo.lock* ./
COPY src ./src

# Build release binary
RUN cargo build --release

# Runner Stage
FROM debian:bookworm-slim
WORKDIR /app

# Install runtime SSL certificates and OpenSSL libraries
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

# Copy compiled binary from builder
COPY --from=builder /usr/src/activity-service/target/release/activity-service /app/activity-service

EXPOSE 5005
CMD ["/app/activity-service"]
