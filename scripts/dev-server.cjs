const { loadEnvConfig } = require('@next/env');
const { startServer } = require('next/dist/server/lib/start-server');

const dir = process.cwd();
const port = Number.parseInt(process.env.PORT || '9002', 10);
const hostname = process.env.HOSTNAME || undefined;

loadEnvConfig(dir);

startServer({
  dir,
  port,
  hostname,
  isDev: true,
  allowRetry: true,
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
