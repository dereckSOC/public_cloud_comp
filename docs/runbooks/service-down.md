# Runbook: Service Down

Use this runbook when a service (dashboard, feedback-form, or event-service) is not responding.

---

## 1. Identify the affected service

```sh
kubectl get pods -n psd
```

Look for pods in `CrashLoopBackOff`, `Error`, or `Pending` state.

```sh
kubectl get deployments -n psd
```

Check `READY` column — it should show `2/2` for each deployment.

---

## 2. Check pod logs

```sh
# Replace <pod-name> with the actual pod name from the above output
kubectl logs <pod-name> -n psd --tail=100

# If the pod has restarted, check previous container logs
kubectl logs <pod-name> -n psd --previous
```

Common things to look for:
- `Error: SUPABASE_SERVICE_ROLE_KEY is not set` — Secret is missing or not mounted
- `connect ECONNREFUSED` — Upstream service (Supabase or event-service) is unreachable
- `MODULE_NOT_FOUND` — Build artifact is missing; re-build the image

---

## 3. Restart the pod

If the logs show a transient error, force a rolling restart:

```sh
kubectl rollout restart deployment/dashboard -n psd
kubectl rollout restart deployment/feedback-form -n psd
kubectl rollout restart deployment/event-service -n psd
```

Watch the rollout:

```sh
kubectl rollout status deployment/dashboard -n psd
```

---

## 4. Check Supabase connectivity

If logs show Supabase errors:

1. Verify the Supabase project is online at https://app.supabase.com
2. Check that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct in the Secret:
   ```sh
   kubectl get secret app-secrets -n psd -o jsonpath='{.data.SUPABASE_URL}' | base64 -d
   ```
3. Check Supabase status page: https://status.supabase.com

---

## 5. Check health endpoints

From inside the cluster (or via port-forward):

```sh
kubectl port-forward svc/dashboard 3000:3000 -n psd &
curl http://localhost:3000/api/health
# Expected: {"status":"ok"}

kubectl port-forward svc/feedback-form 3001:3001 -n psd &
curl http://localhost:3001/api/health
# Expected: {"status":"ok"}

kubectl port-forward svc/event-service 4000:4000 -n psd &
curl http://localhost:4000/health
# Expected: {"status":"ok"}
```

---

## 6. Roll back if a bad deploy caused the outage

```sh
kubectl rollout undo deployment/dashboard -n psd
kubectl rollout undo deployment/feedback-form -n psd
kubectl rollout undo deployment/event-service -n psd
```

See DEPLOYMENT.md section 5 for rolling back to a specific revision.

---

## 7. Escalation

If the issue persists after the above steps:
- Check the Nginx ingress pod: `kubectl get pods -n ingress-nginx`
- Review cluster node health: `kubectl get nodes`
- Check Supabase project quotas (row limits, connection pooling)
- Contact the on-call engineer or open an incident
