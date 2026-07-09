import { query } from '../../db/client.js';
import { createHealthRoutes } from '../../../shared/health/index.js';

export const healthRoutes = createHealthRoutes({
  readinessCheck: () => query('SELECT 1')
});
