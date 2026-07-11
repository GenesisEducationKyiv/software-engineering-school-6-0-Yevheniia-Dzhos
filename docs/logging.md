# Structured Logging

The application and notification service write JSON logs to stdout/stderr.
Docker Compose sends both containers' logs through the GELF logging driver to
Logstash, Logstash parses the JSON payload, and Elasticsearch stores the records
for search and aggregation. Kibana is available for visualization.

## Local Run

```bash
docker compose up --build
```

Services:

- API: `http://localhost:3000`
- Elasticsearch: `http://localhost:9200`
- Kibana: `http://localhost:5601`
- Logstash GELF input: `udp://localhost:12201`

In Kibana, create a data view for `github-release-notifier-logs-*`.

## Field Reference

All fields are promoted to the top level by Logstash. The intermediate `app.*`
wrapper and the raw `short_message` GELF field are removed before indexing.

| Field           | Type    | Description                                      |
|-----------------|---------|--------------------------------------------------|
| `@timestamp`    | date    | Event time from the application log              |
| `log.level`     | keyword | `debug` \| `info` \| `warn` \| `error`          |
| `service.name`  | keyword | `github-release-notifier` or `notification-service` |
| `message`       | text    | Human-readable log message                       |
| `requestId`     | keyword | UUID correlating entries for one HTTP request    |
| `method`        | keyword | HTTP method (`GET`, `POST`, ...)                  |
| `path`          | keyword | Request URL path                                 |
| `statusCode`    | integer | HTTP response status code                        |
| `durationMs`    | integer | Request duration in milliseconds                 |
| `userAgent`     | keyword | `User-Agent` header value                        |
| `remoteAddress` | keyword | Client IP address                                |
| `repository`    | keyword | GitHub repository name (scanner logs)            |
| `error.name`    | keyword | Error class name (error logs)                    |
| `error.message` | text    | Error message (error logs)                       |
| `error.stack`   | text    | Stack trace (error logs)                         |

Set `LOG_LEVEL=debug`, `info`, `warn`, or `error` to control verbosity.
