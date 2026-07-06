# RED Metrics

The application exposes RED metrics for HTTP traffic in Prometheus text format
at `/metrics`.

## Metrics

Default `prom-client` metrics are enabled for Node.js runtime health:

- CPU usage
- memory and heap usage
- event loop lag
- active handles and resources

Application HTTP RED metrics:

- `http_requests_total`: request rate source, labeled by `method`, `route`,
  `status_code`, and `status_class`
- `http_request_duration_seconds`: request duration histogram

Scanner business metrics:

- `release_scanner_runs_total`: release scanner runs by `status`
- `release_scanner_duration_seconds`: release scanner duration histogram
- `release_notifications_sent_total`: release notification emails sent by scanner
- `release_scanner_repository_failures_total`: scanner failures by repository

## Local Run

```bash
docker compose up --build
```

Services:

- Application metrics: `http://localhost:3000/metrics`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`

Prometheus scrapes the app every 15 seconds using
`config/prometheus.yml`.

Grafana is provisioned automatically with Prometheus as the default datasource
and a `GitHub Release Notifier RED Metrics` dashboard. The dashboard includes
HTTP RED panels, runtime CPU and memory panels from `prom-client` default
metrics, and scanner workload panels for duration, sent emails, and repository
failures.

Default Grafana credentials:

- username: `admin`
- password: `admin`

## PromQL Examples

Request rate:

```promql
rate(http_requests_total[1m])
```

Error rate:

```promql
sum(rate(http_requests_total{status_class=~"4xx|5xx"}[1m])) / sum(rate(http_requests_total[1m]))
```

P95 latency:

```promql
histogram_quantile(0.95, sum by (le, route, method) (rate(http_request_duration_seconds_bucket[1m])))
```

CPU usage:

```promql
rate(process_cpu_seconds_total{job="github-release-notifier"}[1m])
```

Memory usage:

```promql
process_resident_memory_bytes{job="github-release-notifier"}
nodejs_heap_size_used_bytes{job="github-release-notifier"}
```

Release notifications sent:

```promql
increase(release_notifications_sent_total[1h])
```

Scanner failures by repository:

```promql
sum by (repository) (increase(release_scanner_repository_failures_total[1h]))
```

Scanner p95 duration:

```promql
histogram_quantile(0.95, sum by (le, status) (rate(release_scanner_duration_seconds_bucket[5m])))
```
