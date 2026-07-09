import { Router } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '@notifier/shared/utils/errors.js';
import { getSaga, listSagas } from './sagaController.js';

const router = Router();

function requireSagaApiToken(req, _res, next) {
  if (!env.sagaApiToken) {
    next();
    return;
  }

  const bearerToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  const headerToken = req.get('x-saga-api-token');

  if (headerToken === env.sagaApiToken || bearerToken === env.sagaApiToken) {
    next();
    return;
  }

  next(new AppError(401, 'Saga API token required'));
}

router.get('/sagas', requireSagaApiToken, listSagas);
router.get('/sagas/:id', requireSagaApiToken, getSaga);

export default router;
