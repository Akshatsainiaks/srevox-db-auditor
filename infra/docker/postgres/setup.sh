#!/bin/bash
# Run on your VMware machine to set up Srevox database

echo "Setting up Srevox database..."

# Create database and user
docker exec podwatch-postgres psql -U postgres << 'SQL'
CREATE USER srevox WITH PASSWORD 'srevox_dev';
CREATE DATABASE srevox OWNER srevox;
GRANT ALL PRIVILEGES ON DATABASE srevox TO srevox;
SQL

# Load schema
docker exec -i podwatch-postgres psql -U srevox -d srevox < /path/to/init.sql

echo "✅ Database ready!"
echo "Host: localhost:5432"
echo "Database: srevox"
echo "User: srevox / srevox_dev"
