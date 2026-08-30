# 📋 Srevox - Pending Tasks & Future Backlog

## 🛠️ Infrastructure & Logging Enhancements
- [ ] **Docker Compose Hostname Override**: Add `hostname: srevox-api` (and corresponding hostnames for `worker`, `ai`, `activity`, `frontend`) in `docker-compose.yml` to display explicit human-readable hostnames in Pino API logger JSON lines instead of Docker container hashes.
- [ ] **Rule Details Page - Recent Triggered Incidents Card**: Re-add the "Recent Matching Incidents" timeline card on the Alert Rule Details page with real-time incident filtering.
- [ ] **Namespace Target Bounds for Cluster Alerts**: Re-add Namespace-level target bounds options to the Configure Alerts drawer.
- [ ] **Standardized API Response Envelopes (`srevox.io/v1alpha1`)**: Standardize all backend API responses across the codebase by creating a central response helper in `apps/api/src/utils/response.ts` that wraps every API payload in an outer `{ "data": { "apiVersion": "srevox.io/v1alpha1", "kind": "<KindName>", "metadata": { "platform": "Srevox", "total": <count>, "page": 1, "pageSize": 25, "totalPages": 1, "timestamp": "<ISOString>" }, "items": [ ... ], "<resourceKey>": [ ... ] } }` envelope, while retaining top-level backward-compatible aliases (`clusters`, `machines`, `alerts`, `incidents`) so frontend consumers continue working seamlessly.

---

## ⚡ AI Database Audit & Change Intelligence Platform

### Phase 2a: Multi-Database CDC Connectors
- [ ] **Production SSE Real-Time Event Streaming (`GET /api/db-audit/stream`)**: Transition Data Audit platform from polling/repeated API requests to an Enterprise Production-Grade Server-Sent Events (SSE) + Event-Driven SWR Architecture. Eliminates repeated background HTTP polling hits in DevTools Network tab, establishing 1 single persistent `EventSource` connection with instant 0ms server push for database change events (`UPDATE`, `INSERT`, `DELETE`) and window focus revalidation.
- [ ] **MySQL Connector**: Implement native `binlog` streaming connector in `apps/db-audit-processor`.
- [ ] **SQL Server Connector**: Implement native CDC event listener for SQL Server.
- [ ] **MongoDB Connector**: Implement Change Streams listener for MongoDB document change tracking.

### Phase 2b: Polling & Vector DB Framework
- [ ] **ClickHouse Polling Connector**: Implement `PollingConnector` snapshot-scan and diff engine for ClickHouse.
- [ ] **Vector Databases**: Implement polling connectors for Pinecone, Weaviate, Milvus, and Qdrant.

### Phase 3: LangGraph AI Audit Intelligence Agent
- [ ] **Python AI Service (`apps/db-audit-ai`)**: Dedicated `FastAPI` + `LangGraph` agent running in a network sandbox.
- [ ] **Natural Language Audit Queries**: "Show all SSN edits on user table by admin in the last 24h".
- [ ] **Change Impact Scoring**: Real-time schema change impact and anomaly detection.
