import { query } from '../../db/client.js';
import { createHealthRoutes } from '@notifier/shared/modules/health/index.js';

export const healthRoutes = createHealthRoutes({
  readinessCheck: () => query('SELECT 1')
});
