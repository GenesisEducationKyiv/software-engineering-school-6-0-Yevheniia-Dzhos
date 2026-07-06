# RED Metrics

The application exposes RED metrics for HTTP traffic in Prometheus text format
at `/metrics`.

## Metrics

- `http_requests_total`: request rate source, labeled by `method`, `route`,
  `status_code`, and `status_class`
- `http_request_duration_seconds`: request duration histogram

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
and a `GitHub Release Notifier RED Metrics` dashboard.

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
