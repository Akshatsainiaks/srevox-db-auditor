# Kubernetes RBAC Setup for Srevox Agent

If the Srevox agent logs show access/forbidden errors, it means the `srevox-agent` ServiceAccount lacks necessary Kubernetes Role-Based Access Control (RBAC) permissions.

## Error Symptom
The agent logs show errors like:
```text
watcher.go:107: [watcher] stream error (ns=""): pods is forbidden: User "system:serviceaccount:kube-system:srevox-agent" cannot watch resource "pods" in API group "" at the cluster scope
```

## Solution

You need to apply a `ClusterRole` and a `ClusterRoleBinding` to grant the agent read-only access to cluster resources (pods, events, nodes, namespaces).

### Step 1: Create the RBAC Manifest

Create a file named `srevox-agent-rbac.yaml` with the following content:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: srevox-agent
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "nodes", "namespaces", "services", "endpoints", "persistentvolumes", "persistentvolumeclaims", "events"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets", "statefulsets", "daemonsets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: srevox-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: srevox-agent
subjects:
  - kind: ServiceAccount
    name: srevox-agent
    namespace: kube-system
```

### Step 2: Apply the RBAC Settings

Apply the manifest to your Kubernetes cluster:

```bash
kubectl apply -f srevox-agent-rbac.yaml
```

Alternatively, you can apply it directly from terminal without saving a file:

```bash
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: srevox-agent
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log", "nodes", "namespaces", "services", "endpoints", "persistentvolumes", "persistentvolumeclaims", "events"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets", "statefulsets", "daemonsets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: srevox-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: srevox-agent
subjects:
  - kind: ServiceAccount
    name: srevox-agent
    namespace: kube-system
EOF
```

### Step 3: Restart the Agent

Rollout restart the agent deployment to load the new credentials:

```bash
kubectl rollout restart deployment/srevox-agent -n kube-system
```

### Step 4: Verify

1. Verify that the agent has the correct permissions:
   ```bash
   kubectl auth can-i watch pods --as=system:serviceaccount:kube-system:srevox-agent -n default
   # Expected output: yes
   ```
2. Check deployment rollout status:
   ```bash
   kubectl rollout status deployment/srevox-agent -n kube-system
   ```
