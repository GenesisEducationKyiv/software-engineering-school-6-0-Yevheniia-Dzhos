const durationBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const requestCounts = new Map();
const errorCounts = new Map();
const durationHistograms = new Map();

function escapeLabelValue(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');
}

function formatLabels(labels) {
  const entries = Object.entries(labels);

  if (entries.length === 0) return '';

  return `{${entries
    .map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
    .join(',')}}`;
}

function labelsKey(labels) {
  return Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
}

function increment(map, labels, amount = 1) {
  const key = labelsKey(labels);
  const current = map.get(key);

  if (current) {
    current.value += amount;
    return;
  }

  map.set(key, { labels, value: amount });
}

function observeDuration(labels, durationSeconds) {
  const key = labelsKey(labels);
  const current = durationHistograms.get(key) || {
    labels,
    buckets: new Map(durationBuckets.map((bucket) => [bucket, 0])),
    count: 0,
    sum: 0
  };
  for (const bucket of durationBuckets) {
    if (durationSeconds <= bucket) {
      current.buckets.set(bucket, current.buckets.get(bucket) + 1);
    }
  }

  current.count += 1;
  current.sum += durationSeconds;
  durationHistograms.set(key, current);
}

function getStatusClass(statusCode) {
  return `${Math.floor(statusCode / 100)}xx`;
}

function getRoutePath(req) {
  if (req.route?.path) {
    const routePath = Array.isArray(req.route.path) ? req.route.path[0] : req.route.path;
    const originalPath = req.originalUrl?.split('?')[0] || '';
    const routeSegments = routePath.split('/').filter(Boolean);
    const originalSegments = originalPath.split('/').filter(Boolean);

    for (let index = 0; index <= originalSegments.length - routeSegments.length; index += 1) {
      const matches = routeSegments.every((segment, offset) => {
        return segment.startsWith(':') || segment === originalSegments[index + offset];
      });

      if (matches) {
        return `/${[
          ...originalSegments.slice(0, index),
          ...routeSegments
        ].join('/')}`;
      }
    }

    return `${req.baseUrl || ''}${routePath}`;
  }

  return 'unknown';
}

function metricHelp(name, help, type) {
  return [`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`];
}

function counterLines(name, values) {
  return [...values.values()].map(({ labels, value }) => `${name}${formatLabels(labels)} ${value}`);
}

function histogramLines(name) {
  const lines = [];

  for (const histogram of durationHistograms.values()) {
    for (const [bucket, value] of histogram.buckets.entries()) {
      lines.push(`${name}_bucket${formatLabels({ ...histogram.labels, le: bucket })} ${value}`);
    }

    lines.push(`${name}_bucket${formatLabels({ ...histogram.labels, le: '+Inf' })} ${histogram.count}`);
    lines.push(`${name}_sum${formatLabels(histogram.labels)} ${histogram.sum}`);
    lines.push(`${name}_count${formatLabels(histogram.labels)} ${histogram.count}`);
  }

  return lines;
}

export function recordHttpRequest(req, res, durationSeconds) {
  if (req.path === '/metrics') return;

  const statusCode = res.statusCode;
  const baseLabels = {
    method: req.method,
    route: getRoutePath(req)
  };
  const countLabels = {
    ...baseLabels,
    status_code: statusCode,
    status_class: getStatusClass(statusCode)
  };

  increment(requestCounts, countLabels);
  observeDuration(baseLabels, durationSeconds);

  if (statusCode >= 400) {
    increment(errorCounts, countLabels);
  }
}

export function renderMetrics() {
  return [
    ...metricHelp('http_requests_total', 'Total HTTP requests processed by the application.', 'counter'),
    ...counterLines('http_requests_total', requestCounts),
    '',
    ...metricHelp('http_request_errors_total', 'Total HTTP requests completed with 4xx or 5xx status codes.', 'counter'),
    ...counterLines('http_request_errors_total', errorCounts),
    '',
    ...metricHelp('http_request_duration_seconds', 'HTTP request duration in seconds.', 'histogram'),
    ...histogramLines('http_request_duration_seconds'),
    ''
  ].join('\n');
}

export function resetMetrics() {
  requestCounts.clear();
  errorCounts.clear();
  durationHistograms.clear();
}