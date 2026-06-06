import { createApp } from './app.js';
import { env } from './config.js';

const app = createApp();

app.listen(env.port, () => {
  console.log(`Notification service started on port ${env.port}`);
});
