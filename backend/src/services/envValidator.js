const { z } = require('zod');

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  ROOM_TTL_HOURS: z.coerce.number().positive().default(168),
  ROOM_CLEANUP_INTERVAL_MS: z.coerce.number().positive().default(3600000),
  REDIS_URL: z.string().url().optional().or(z.literal('')),
  OLLAMA_URL: z.string().url().optional().or(z.literal('')),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_PATH: z.string().optional()
});

function validateEnv(env = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    const message = `Environment validation failed:\n${errorDetails}\nPlease check your .env configuration against .env.example.`;
    if (env.NODE_ENV !== 'test') {
      console.error(message);
      process.exit(1);
    }
    throw new Error(message);
  }
  return parsed.data;
}

module.exports = {
  envSchema,
  validateEnv
};
