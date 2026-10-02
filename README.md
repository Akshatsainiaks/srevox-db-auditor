<div align="center">

<br/>

# ⚡ Srevox DB Auditor

### **Enterprise-Grade Database Audit, Real-Time CDC Tracking & DDL Intelligence**

*Continuous data auditing, cryptographic change verification, before/after row diffs, and PII masking — 100% self-hosted.*

<br/>

[![Docker Pulls](https://img.shields.io/docker/pulls/akshatsaini08/srevox-db-auditor-api?style=for-the-badge&logo=docker&label=Docker%20Pulls&color=6366f1&labelColor=0f172a)](https://hub.docker.com/u/akshatsaini08)
[![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-red?style=for-the-badge&labelColor=0f172a)](#-license)
[![Node](https://img.shields.io/badge/Node-20+-339933?style=for-the-badge&logo=node.js&logoColor=white&labelColor=0f172a)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=0f172a)](https://www.typescriptlang.org)
[![Helm](https://img.shields.io/badge/Helm-v3+-0F1689?style=for-the-badge&logo=helm&logoColor=white&labelColor=0f172a)](https://helm.sh)

<br/>

> 🐳 **No clone needed. Just Docker + a single command.**  
> Built for on-prem, bare-metal, air-gapped corporate VPCs, and modern cloud environments.

<br/>

[🚀 Quick Start](#-quick-start--no-clone-needed) · [☸️ Helm Deployment](#%EF%B8%8F-kubernetes--helm-deployment) · [🏗️ Architecture](#%EF%B8%8F-architecture) · [🔐 Security & Compliance](#-security--compliance)

</div>

---

## 🌟 Why Srevox DB Auditor?

| Traditional Database Logs | Srevox DB Auditor |
|---|---|
| 📜 Unstructured, massive text logs | 🔍 Structured change ledger with visual before/after row diffs |
| ⚠️ Sensitive PII & passwords leaked in logs | 🛡️ Zero-trust automated PII masking on credentials, tokens & cards |
| ❌ Schema DDL drift goes unnoticed | ⚡ Real-time alerts on CREATE, ALTER, DROP, and column migrations |
| 🔒 Easy to tamper with or delete logs | 🔐 Immutable SHA-256 cryptographic hash chain verification |
| 🐢 Slow manual queries to reconstruct history | 🚀 Sub-second visual time-travel for any record or table |

---

## ✨ Key Capabilities

- **🔍 Full Mutation Ledger**: Deep visibility into all `INSERT`, `UPDATE`, and `DELETE` operations with exact changed-field highlighting.
- **⚡ DDL Drift Detection**: Tracks schema alterations across all monitored databases and alerts instantly.
- **🛡️ Built-in PII Redaction**: Automatic redaction of passwords, tokens, SSNs, credit cards, and confidential secrets before storage.
- **🔐 Cryptographic Verification**: Every mutation event is hashed with SHA-256, providing an audit-ready, tamper-evident ledger.
- **🔔 Multi-Channel Alert Routing**: Route alerts by database, table, or severity to Slack, Microsoft Teams, Discord, Email, and Webhooks.
- **⏱️ Automated Data Retention**: Built-in policies to sweep and prune expired audit events, maintaining SOC2, HIPAA, and GDPR compliance.
- **🔒 Air-Gapped Ready**: 100% self-hosted. Credentials are encrypted at rest with AES-256-GCM. No data ever leaves your perimeter.

---

## 🚀 Quick Start — No Clone Needed

Run the one-command installer on any Linux or macOS server with Docker installed:

```bash
curl -sSL https://raw.githubusercontent.com/Akshatsainiaks/srevox-db-auditor/main/setup.sh | bash
```

The script will automatically:
1. Create a dedicated `srevox-db-auditor/` directory
2. Download `docker-compose.yml` and configure `.env`
3. Pull the official images from Docker Hub
4. Ready your instance for launch!

### Start the Services

```bash
cd srevox-db-auditor
docker compose up -d
```

### Access the Web Console

Open your browser to: **`http://localhost:7005`**

- **Default Email**: `admin@srevox.local`
- **Default Password**: `admin123`
- **API URL**: `http://localhost:7001`

> ⚠️ *Please change the default password immediately after initial login via Settings → Security.*

---

## ☸️ Kubernetes & Helm Deployment

Deploy directly into any Kubernetes cluster (`EKS`, `GKE`, `AKS`, `K3s`, `minikube`):

```bash
# 1. Add official Srevox DB Auditor Helm repository
helm repo add srevox-db-auditor https://raw.githubusercontent.com/Akshatsainiaks/srevox-db-auditor/main/charts
helm repo update

# 2. Install Srevox DB Auditor
helm install srevox-db-auditor srevox-db-auditor/srevox-db-auditor \
  --namespace srevox-db-auditor --create-namespace \
  --set postgres.password="MyStrongPassword123!"

# 3. Upgrade to future releases with zero downtime
helm upgrade srevox-db-auditor srevox-db-auditor/srevox-db-auditor \
  --namespace srevox-db-auditor --reuse-values
```

---

## 🏗️ Architecture

```
  ┌────────────────────────────────────────────────────────┐
  │                 Target Customer Databases               │
  │     (PostgreSQL, MySQL, Redis, ClickHouse, TiDB...)     │
  └───────────────────────────┬────────────────────────────┘
                              │ CDC Streams / WAL Replication
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                 Srevox DB Auditor Engine               │
  │                                                        │
  │   • CDC Ingestion & DDL Drift Engine                   │
  │   • Zero-Trust PII Masking                             │
  │   • Cryptographic SHA-256 Ledger Generator             │
  │   • Multi-Channel Alert Router (Slack/Teams/Email)     │
  └───────────┬────────────────────────────────┬───────────┘
              │                                │
              ▼                                ▼
  ┌───────────────────────┐        ┌───────────────────────┐
  │  Fastify Core API     │        │  Next.js Audit Web    │
  │  (Port 7001)          │        │  Console (Port 7005)  │
  └───────────────────────┘        └───────────────────────┘
```

---

## 🔌 Supported Database Engines

- **PostgreSQL**: Logical replication (WAL / `pgoutput`) & DDL trigger monitoring
- **MySQL / MariaDB**: Binlog CDC capture
- **ClickHouse**: Real-time mutation tracking
- **TiDB**: Distributed CDC engine
- **Redis**: Key mutation & stream change events
- **MongoDB**: Oplog / Change streams

---

## 🛠️ Running From Source

If you prefer building from source:

```bash
# Clone the repository
git clone https://github.com/Akshatsainiaks/srevox-db-auditor.git
cd srevox-db-auditor

# Start all microservices via Docker Compose
docker compose up -d

# Or run locally in developer mode:
# Tab 1: API
cd apps/api && npm install && npm run dev
# Tab 2: Frontend
cd apps/frontend && npm install && npm run dev
```

---

## 📄 License

All Rights Reserved © Srevox Team. For licensing inquiries and enterprise support, contact support@srevox.com.
