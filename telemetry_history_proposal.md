# Proposal: Multi-Day Telemetry History Storage Options

This document outlines the architectural options for viewing previous days' cluster node/pod metrics without bloat or excessive writes to Srevox's primary PostgreSQL database.

---

## Option A: Prometheus Integration (Zero-DB Footprint)

Instead of Srevox storing metrics history in its own database, it queries a Prometheus service running in your Kubernetes cluster on-demand.

### Workflow
1. **Configure API**: You configure your Prometheus query endpoint (e.g. `http://prometheus-operated.monitoring.svc.cluster.local:9090`) in Srevox Cluster Settings.
2. **On-Demand Queries**: When you open the Srevox telemetry timeline and select "Last 7 Days" or "Custom Range", the Srevox backend issues a range query to the Prometheus HTTP API:
   ```http
   GET /api/v1/query_range?query=sum(node_cpu_seconds_total)...&start=...&end=...&step=3600s
   ```
3. **No Local Write**: Srevox does not save any metrics rows in Postgres.

### Pros
* **0% Database Bloat**: PostgreSQL disk space stays tiny.
* **Industry Standard**: Leverages existing Prometheus storage, caching, and retention configurations.
* **Custom Queries**: Allows graphing complex metrics (network I/O, disk throughput) without database schema changes.

### Cons
* Requires Prometheus to be installed in target clusters.

---

## Option B: Downsampling & Database Pruning (Lightweight Postgres)

Keep metrics history in Postgres, but aggressively prune and downsample historical data to maintain a capped database size.

### Workflow
1. **Raw Metric Snapshots**: Save raw metrics (e.g. every 1 minute) to Postgres to show high-resolution graphs for the last 24 hours.
2. **Pruning Job**: A daily background cron task in `apps/alert-worker` deletes metrics older than 3 days (or 7 days):
   ```sql
   DELETE FROM cluster_nodes_history WHERE created_at < NOW() - INTERVAL '3 days';
   ```
3. **Rollups (Optional)**: Compress minute-by-minute data into hourly averages for days 2–7 before deleting raw metrics.

### Pros
* **Out-of-the-box**: Works automatically without installing or configuring external tools like Prometheus.

### Cons
* Still performs database writes (though disk growth is capped by the pruning window).
