# Runbook: High Error Rate

Use this runbook when API error rates spike (many 500 responses, webhook alerts, or monitoring dashboards show elevated error counts).

---

## 1. Detect the scope

Check which service is affected:

```sh
kubectl get pods -n psd
```

Check the metrics endpoint to see counter values:

```sh
kubectl port-forward svc/dashboard 3000:3000 -n psd &
curl http://localhost:3000/api/metrics

kubectl port-forward svc/feedback-form 3001:3001 -n psd &
curl http://localhost:3001/api/metrics
```

---

## 2. Check structured logs

All services emit JSON-structured logs. Tail logs for ERROR-severity lines:

```sh
# Dashboard
kubectl logs -l app=dashboard -n psd --tail=200 | grep '"severity":"ERROR"'

# Feedback form
kubectl logs -l app=feedback-form -n psd --tail=200 | grep '"severity":"ERROR"'

# Event service
kubectl logs -l app=event-service -n psd --tail=200
```

Key log fields to look for:
- `"message"`: the error category (e.g., `"event-access lookup failed"`, `"device-entry tracking failed"`)
- `"err"`: the actual error string
- `"route"`: which API route failed
- `"audit": true`: audit log entries showing which operations were attempted

If `ERROR_WEBHOOK_URL` is configured, errors are also forwarded to that webhook (Sentry, Slack, etc.) with full stack traces.

---

## 3. Check Supabase quota and connectivity

A common cause of error spikes is hitting Supabase rate limits or quotas:

1. Open the Supabase dashboard: https://app.supabase.com
2. Navigate to your project > Reports > API
3. Look for spikes in request count or error rates
4. Check the Supabase status page: https://status.supabase.com

If Supabase is throttling requests, consider:
- Enabling connection pooling (PgBouncer) in Supabase settings
- Caching frequent read-only queries at the application layer
- Upgrading your Supabase plan

---

## 4. Check for bad deployments

If errors started immediately after a deploy:

```sh
kubectl rollout history deployment/dashboard -n psd
kubectl rollout history deployment/feedback-form -n psd
```

Roll back if necessary:

```sh
kubectl rollout undo deployment/dashboard -n psd
kubectl rollout undo deployment/feedback-form -n psd
```

---

## 5. Scale up to reduce per-pod load

If the error rate is caused by overload rather than a bug, scale up manually:

```sh
kubectl scale deployment/dashboard --replicas=5 -n psd
kubectl scale deployment/feedback-form --replicas=5 -n psd
```

The HPA (HorizontalPodAutoscaler) will also scale automatically when CPU > 70%, but manual scaling can be faster in an incident.

To return to HPA control after the incident:

```sh
kubectl scale deployment/dashboard --replicas=2 -n psd
kubectl scale deployment/feedback-form --replicas=2 -n psd
```

---

## 6. Verify recovery

After applying fixes, watch the error rate return to normal:

```sh
kubectl logs -l app=dashboard -n psd -f | grep '"severity":"ERROR"'
```

Check health endpoints confirm services are healthy:

```sh
curl http://localhost:3000/api/health  # {"status":"ok"}
curl http://localhost:3001/api/health  # {"status":"ok"}
```

---

## 7. Post-incident

- Document the root cause and timeline
- If Supabase keys were exposed or rotated, update the Kubernetes Secret and trigger a rolling restart
- If the error webhook (ERROR_WEBHOOK_URL) was not configured, add it to reduce future detection time
