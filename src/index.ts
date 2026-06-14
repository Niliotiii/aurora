import { createServer } from './server.ts';
import { config } from './config.ts';

const app = createServer();

await app.listen({ port: config.server.port, host: '0.0.0.0' });
console.log(`🚀 Aurora API running on http://0.0.0.0:${config.server.port}`);
