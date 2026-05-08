# Kubernetes Manifests

The resilient Kubernetes architecture design and deployment guide lives in the project documentation:

👉 **[docs/deployment/k8s-architecture.md](../docs/deployment/k8s-architecture.md)**

This directory contains the raw K8s manifests under `base/`. Apply them individually or use Kustomize:

```bash
kubectl apply -k k8s/base
```
