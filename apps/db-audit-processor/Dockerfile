# Build Stage
FROM rust:1-slim AS builder
WORKDIR /usr/src/db-audit-processor
COPY Cargo.toml Cargo.lock* ./
COPY src ./src
RUN cargo build --release

# Final Stage
FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /usr/src/db-audit-processor/target/release/db-audit-processor .
EXPOSE 7004
CMD ["./db-audit-processor"]
