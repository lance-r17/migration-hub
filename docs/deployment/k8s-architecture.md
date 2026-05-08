# Migration Hub — Resilient Kubernetes Architecture

## 1. Current State & Resilience Gaps

| Component | Current Behavior | Resilience Gap |
|-----------|------------------|----------------|
| **Backend API** | FastAPI with `lifespan` background tasks (job monitor, attachment cleanup) | Tasks are in-memory per pod. Multiple replicas = **double-processing** risk. Pod restart = **lost jobs**. |
| **File Uploads** | Saved to `./uploads/projects/` on local disk | Multi-replica deployments can't share files. Upload to pod A, download from pod B = **404**. |
| **Health Checks** | `GET /health` returns `{"status":"ok"}` | No DB connectivity probe. K8s may route traffic to a pod that **cannot serve requests**. |
| **Frontend** | Nginx static SPA with Go entrypoint for runtime env injection | Stateless and horizontally scalable. No gaps. |
| **Database** | PostgreSQL via `asyncpg` | Single point of failure unless clustered. Connection pool not tuned for K8s lifecycle. |

## 2. Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Ingress (HTTPS)                        │
│                         Higress / ALB                         │
└──────────────────────────────┬────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │  Frontend   │     │ Backend API │     │Auth Provider│
   │  (Nginx)    │     │  (FastAPI)  │     │  (OAuth)    │
   │  Replicas:3 │     │  Replicas:3 │     │  External   │
   │   HPA       │     │   HPA       │     │             │
   └─────────────┘     └──────┬──────┘     └─────────────┘
                              │
               ┌──────────────┼──────────────┐
               │              │              │
               ▼              ▼              ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │Backend Worker│ │  PostgreSQL │ │ Shared PVC  │
        │ Replicas:1   │ │  StatefulSet│ │  (uploads)  │
        │  (PDB:1)     │ │  (PVC)      │ │  (stopgap)  │
        └─────────────┘ └─────────────┘ └─────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │    Jira     │
                        │   (Cloud)   │
                        └─────────────┘
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Split API + Worker** | Background tasks run only in the Worker deployment. API pods are stateless and can scale horizontally without job-duplication risk. |
| **Worker = 1 replica + PDB** | Keeps in-memory `_dispatched` set safe. PodDisruptionBudget ensures K8s never voluntarily evicts the only worker during node drains. |
| **Shared PVC for uploads** | Short-term fix so multiple API pods can read/write the same files. **Long-term: migrate to S3-compatible object storage.** |
| **DB-aware readiness probe** | `/health` now checks PostgreSQL connectivity. K8s removes pod from Service endpoints until DB is reachable. |
| `pool_pre_ping=True` | Already enabled in `database.py`. Prevents "stale connection" errors after pod rescheduling. |

## 3. Horizontal Pod Autoscaling (HPA)

| Workload | Min | Max | Target Metric |
|----------|-----|-----|---------------|
| Frontend | 2 | 5 | CPU 70% |
| Backend API | 2 | 5 | CPU 70% |
| Backend Worker | 1 | 1 | — (fixed) |

> The worker is intentionally fixed at 1 replica until a distributed task queue (Redis + Celery/ARQ) is introduced.

## 4. Pod Disruption Budgets (PDB)

| Workload | Min Available | Purpose |
|----------|---------------|---------|
| Frontend | 1 | Ensure rolling updates don't drop all UI capacity |
| Backend API | 1 | Ensure API remains available during node drains |
| Backend Worker | 1 | **Critical** — prevent K8s from evicting the only job processor |

## 5. Ingress — Higress

We use **[Higress](https://higress.io/)** as the ingress gateway instead of nginx-ingress. Higress is a cloud-native API gateway built on Envoy and Istio, providing:

- Native support for WASM plugins (rate limiting, auth, transformation)
- Better observability via Envoy metrics
- Seamless integration with service mesh (Istio)
- No nginx-specific annotations needed — routing rules are configured via standard Kubernetes `Ingress` or Higress CRDs (`McpBridge`, `WasmPlugin`, etc.)

### Higress-Specific Configuration Notes

| Feature | nginx-ingress Annotation | Higress Equivalent |
|---------|--------------------------|-------------------|
| SSL redirect | `nginx.ingress.kubernetes.io/ssl-redirect` | Configure via Higress `WasmPlugin` or console route rule |
| Request body size | `nginx.ingress.kubernetes.io/proxy-body-size` | Envoy cluster config or Higress `WasmPlugin` |
| CORS | `nginx.ingress.kubernetes.io/enable-cors` | Higress built-in CORS plugin or handled by FastAPI |
| Rate limiting | `nginx.ingress.kubernetes.io/limit-rps` | Higress `WasmPlugin` (sentinel / limit-count) |
| Cert-Manager | `cert-manager.io/cluster-issuer` | **Compatible** — works with any Ingress class |

> CORS is intentionally handled by FastAPI (`CORSMiddleware`) so that Higress does not inject conflicting headers.

## 6. Deployment Order

```bash
cd k8s/base

# 1. Namespace
kubectl apply -f namespace.yaml

# 2. Secrets (edit secrets.yaml first — base64-encode your values)
kubectl apply -f secrets.yaml

# 3. Config & PVC
kubectl apply -f configmap.yaml
kubectl apply -f pvc-uploads.yaml

# 4. Database
kubectl apply -f postgres.yaml

# 5. Applications
kubectl apply -f backend-worker.yaml
kubectl apply -f backend-api.yaml
kubectl apply -f frontend.yaml

# 6. Ingress
kubectl apply -f ingress.yaml
```

Or apply the entire base via Kustomize:

```bash
kubectl apply -k k8s/base
```

## 7. Production Recommendations (Next Steps)

1. **Replace Shared PVC with Object Storage** (e.g., S3, MinIO, GCS, or OSS).
   - Uploads become truly stateless.
   - Eliminates RWO/RWX storage complexity.

2. **Introduce Redis + Task Queue** (Celery, ARQ, or RQ).
   - Worker can then scale to N replicas safely.
   - Jobs survive pod restarts.
   - Enables retry logic, dead-letter queues, and monitoring.

3. **PostgreSQL High Availability**.
   - Use CloudNativePG, Zalando Postgres Operator, or a managed cloud offering (RDS, Cloud SQL, Azure Database, Alibaba Cloud RDS).
   - Enables automated failover, backups, and PITR.

4. **Observability Stack**.
   - Prometheus + Grafana for metrics.
   - Loki or Fluent Bit for log aggregation.
   - Jaeger or Tempo for distributed tracing (HTTpx already supports OpenTelemetry).

5. **Network Policies**.
   - Restrict ingress so only Higress can reach Frontend/Backend.
   - Restrict Backend → Postgres to the `backend-api` and `backend-worker` pods only.

6. **Cert-Manager**.
   - Automate TLS certificate provisioning via Let's Encrypt.
