import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '@notifier/shared/utils/errors.js';
import { getSaga, listSagas } from './sagaController.js';

const router = Router();

function tokensMatch(candidate, expected) {
  if (typeof candidate !== 'string') return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  if (candidateBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

function requireSagaApiToken(req, _res, next) {
  if (!env.sagaApiToken) {
    next();
    return;
  }

  const bearerToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  const headerToken = req.get('x-saga-api-token');

  if (tokensMatch(headerToken, env.sagaApiToken) || tokensMatch(bearerToken, env.sagaApiToken)) {
    next();
    return;
  }

  next(new AppError(401, 'Saga API token required'));
}

router.get('/sagas', requireSagaApiToken, listSagas);
router.get('/sagas/:id', requireSagaApiToken, getSaga);

export default router;
