const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    paragraph: { type: 'string', minLength: 1, maxLength: 600 },
    topReasons: { type: 'array', maxItems: 3, items: { type: 'string', minLength: 1, maxLength: 120 } },
  },
  required: ['paragraph', 'topReasons'],
  additionalProperties: false,
};

function validateJsonSchema(value, schema, path = '$') {
  const fail = (message) => { throw new Error(`Invalid model output at ${path}: ${message}`); };
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected object');
    for (const key of schema.required || []) if (!(key in value)) fail(`missing ${key}`);
    if (schema.additionalProperties === false) {
      const unexpected = Object.keys(value).find((key) => !(key in schema.properties));
      if (unexpected) fail(`unexpected property ${unexpected}`);
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (key in value) validateJsonSchema(value[key], childSchema, `${path}.${key}`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) fail('expected array');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail('too many items');
    for (const [index, item] of value.entries()) validateJsonSchema(item, schema.items, `${path}[${index}]`);
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.trim().length < (schema.minLength || 0)) fail('expected non-empty string');
    if (schema.maxLength !== undefined && value.length > schema.maxLength) fail('string too long');
  }
  return value;
}

async function generateJson(prompt, schema, options = {}) {
  const url = options.url || process.env.OLLAMA_URL;
  if (!url) return null;
  const endpoint = new URL('/api/generate', url).toString();
  const controller = new AbortController();
  const timeoutMs = Math.min(5000, options.timeoutMs || 5000);
  let timer;
  try {
    const request = async () => {
      const response = await (options.fetchImpl || fetch)(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: options.model || process.env.OLLAMA_MODEL || 'llama3.2', prompt, format: schema, stream: false }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
      const envelope = await response.json();
      const output = typeof envelope.response === 'string' ? JSON.parse(envelope.response) : envelope.response;
      return validateJsonSchema(output, schema);
    };
    return await Promise.race([
      request(),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Ollama request timed out')); }, timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { SUMMARY_SCHEMA, validateJsonSchema, generateJson };
