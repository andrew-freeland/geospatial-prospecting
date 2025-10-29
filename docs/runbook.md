# Runbook

- Rate limits: apply exponential backoff on 429/5xx.
- Waypoint cap: keep total (origin+dest+waypoints) ≤ 25; otherwise batch.
- Delivery fallback: if Slack/Gmail fails, present in-UI preview + links.
- Observability: log requestId, userId, counts, durations, errors (no PII).
- Test mode: use fixtures under `test/fixtures`.
