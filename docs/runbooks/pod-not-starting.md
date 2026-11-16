# Runbook: Pod not starting

- **Symptom:** Deployment not progressing, pods `Pending`, `CrashLoopBackOff`, `ImagePullBackOff`, or `CreateContainerConfigError`. Datadog monitor: `kube deployment replicas unavailable`.
- **Applies to:** our GKE estate and self-hosted installs.

## 1. Find the failing pod and its state

```sh
NS=aip
kubectl -n $NS get pods -o wide | grep -v Running
kubectl -n $NS describe pod <pod>          # read Events at the bottom first
kubectl -n $NS get events --sort-by=.lastTimestamp | tail -30
```

## 2. Mitigate

If this started with a deploy, roll back now and diagnose after:

```sh
kubectl -n $NS rollout undo deployment/<name>
kubectl -n $NS rollout status deployment/<name> --timeout=5m
```

## 3. Diagnose by status

| Status                                                                  | Likely cause                                             | Check                                                                                 | Fix                                                                                                                     |
| ----------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Pending`, event `Insufficient cpu/memory`                              | Requests exceed free node capacity; autoscaler at max    | `kubectl describe nodes \| grep -A5 Allocated`                                        | Raise node pool `max_nodes`, or right-size `resources.requests`                                                         |
| `Pending`, `didn't match node affinity/selector` or `untolerated taint` | Pool missing or tainted                                  | `kubectl get nodes --show-labels`                                                     | Fix selector/tolerations, or add the pool in Terraform                                                                  |
| `Pending`, `unbound PersistentVolumeClaim`                              | StorageClass or zone mismatch                            | `kubectl -n $NS get pvc`                                                              | Check StorageClass exists, and the PV's zone matches the node's                                                         |
| `ImagePullBackOff`                                                      | Wrong tag, registry auth, or Binary Authorization denial | `describe pod` event text; for BinAuthz look for `denied by attestor`                 | Fix tag; grant node SA `artifactregistry.reader`; verify the image is signed (see `docs/release/verifying-releases.md`) |
| `CrashLoopBackOff`                                                      | App exits on start, usually config                       | `kubectl -n $NS logs <pod> --previous`                                                | Services fail fast with the bad variable named in the log. Fix the env/secret                                           |
| `CrashLoopBackOff`, `OOMKilled` in `lastState`                          | Memory limit too low                                     | `kubectl -n $NS get pod <pod> -o jsonpath='{.status.containerStatuses[*].lastState}'` | Raise `resources.limits.memory`; check for a leak in Datadog memory graphs                                              |
| `CreateContainerConfigError`                                            | Referenced Secret/ConfigMap key missing                  | `describe pod` names the key                                                          | Create the key, then `kubectl rollout restart`                                                                          |
| Running but never Ready                                                 | `/readyz` failing: a dependency is down                  | `kubectl -n $NS port-forward pod/<pod> 8080 && curl localhost:8080/readyz`            | Response JSON names the failing dependency (postgres, redis, …)                                                         |

## 4. Verify

```sh
kubectl -n $NS rollout status deployment/<name>
```

Then confirm the Datadog error-rate monitor has recovered.
