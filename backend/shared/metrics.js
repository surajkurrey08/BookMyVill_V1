// Minimal Prometheus text-format metrics (no extra dependency): request counts
// by method/status class, a latency histogram, and process gauges.

const BUCKETS = [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

function createMetrics(service) {
  const requests = new Map(); // "method|status" -> count
  const histogram = { buckets: BUCKETS.map(() => 0), sum: 0, count: 0 };
  const counters = new Map(); // custom counters: name -> Map(labelString -> value)

  return {
    observeRequest(method, status, durationMs) {
      const key = `${method}|${String(status)[0]}xx`;
      requests.set(key, (requests.get(key) || 0) + 1);
      const seconds = durationMs / 1000;
      BUCKETS.forEach((bound, i) => { if (seconds <= bound) histogram.buckets[i]++; });
      histogram.sum += seconds; histogram.count++;
    },
    increment(name, labels = {}) {
      const series = counters.get(name) || new Map();
      const key = Object.entries(labels).map(([k, v]) => `${k}="${String(v).replace(/"/g, '')}"`).join(',');
      series.set(key, (series.get(key) || 0) + 1);
      counters.set(name, series);
    },
    render() {
      const label = `service="${service}"`;
      const lines = [
        '# HELP bmv_http_requests_total HTTP requests handled.', '# TYPE bmv_http_requests_total counter',
        ...[...requests].map(([key, value]) => { const [method, status] = key.split('|'); return `bmv_http_requests_total{${label},method="${method}",status="${status}"} ${value}`; }),
        '# HELP bmv_http_request_duration_seconds Request latency.', '# TYPE bmv_http_request_duration_seconds histogram',
        ...BUCKETS.map((bound, i) => `bmv_http_request_duration_seconds_bucket{${label},le="${bound}"} ${histogram.buckets[i]}`),
        `bmv_http_request_duration_seconds_bucket{${label},le="+Inf"} ${histogram.count}`,
        `bmv_http_request_duration_seconds_sum{${label}} ${histogram.sum.toFixed(3)}`,
        `bmv_http_request_duration_seconds_count{${label}} ${histogram.count}`,
        '# HELP bmv_process_resident_memory_bytes Resident memory.', '# TYPE bmv_process_resident_memory_bytes gauge',
        `bmv_process_resident_memory_bytes{${label}} ${process.memoryUsage().rss}`,
        '# HELP bmv_process_uptime_seconds Process uptime.', '# TYPE bmv_process_uptime_seconds gauge',
        `bmv_process_uptime_seconds{${label}} ${Math.round(process.uptime())}`
      ];
      for (const [name, series] of counters) {
        lines.push(`# TYPE ${name} counter`);
        for (const [key, value] of series) lines.push(`${name}{${[label, key].filter(Boolean).join(',')}} ${value}`);
      }
      return `${lines.join('\n')}\n`;
    }
  };
}

module.exports = { createMetrics };
