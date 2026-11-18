let startedAt = process.hrtime.bigint();
let startedCpu = process.cpuUsage();
const requests = [];
const MAX_SAMPLES = 500000;

function recordLoadRequest(req, res, next) {
  if (process.env.NODE_ENV === 'production' || process.env.LOAD_TEST_MODE !== 'true'
    || req.path.startsWith('/__load/') || req.path === '/api/health') return next();
  const start = process.hrtime.bigint();
  res.once('finish', () => {
    requests.push({ durationMs: Number(process.hrtime.bigint() - start) / 1e6, status: res.statusCode });
    if (requests.length > MAX_SAMPLES) requests.splice(0, requests.length - MAX_SAMPLES);
  });
  next();
}

function resetLoadMetrics() {
  requests.length = 0;
  startedAt = process.hrtime.bigint();
  startedCpu = process.cpuUsage();
}

function getLoadMetrics() {
  const latencies = requests.map((request) => request.durationMs).sort((a, b) => a - b);
  const at = (fraction) => latencies.length ? +latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * fraction))].toFixed(2) : 0;
  const cpu = process.cpuUsage(startedCpu);
  const memory = process.memoryUsage();
  return {
    count: requests.length,
    errors: requests.filter((request) => request.status >= 400).length,
    p50: at(0.50), p95: at(0.95), p99: at(0.99),
    durationSeconds: Number(process.hrtime.bigint() - startedAt) / 1e9,
    cpuUserMs: Math.round(cpu.user / 1000), cpuSystemMs: Math.round(cpu.system / 1000),
    rssMB: +(memory.rss / 1024 / 1024).toFixed(1), heapMB: +(memory.heapUsed / 1024 / 1024).toFixed(1),
  };
}

module.exports = { recordLoadRequest, resetLoadMetrics, getLoadMetrics };
