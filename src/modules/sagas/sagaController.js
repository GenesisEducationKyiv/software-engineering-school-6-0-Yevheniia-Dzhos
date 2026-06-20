import { findSagaById, listRecentSagas } from './sagaRepository.js';
import { AppError } from '../../utils/errors.js';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxSagaListLimit = 100;

function parseNonNegativeInteger(value, fallback) {
  if (value === undefined) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(400, 'Invalid pagination parameter');
  }

  return parsed;
}

function getSagaListFilters(query) {
  const limit = Math.min(
    parseNonNegativeInteger(query.limit, 20),
    maxSagaListLimit
  );
  const offset = parseNonNegativeInteger(query.offset, 0);

  return {
    limit,
    offset,
    state: query.state,
    type: query.type
  };
}

function sanitizeSaga(saga) {
  if (!saga) return saga;

  const safePayload = { ...(saga.payload || {}) };
  delete safePayload.email;
  delete safePayload.confirmToken;

  return {
    ...saga,
    payload: safePayload
  };
}

export async function listSagas(req, res, next) {
  try {
    const sagas = await listRecentSagas(getSagaListFilters(req.query));
    res.status(200).json(sagas.map(sanitizeSaga));
  } catch (error) {
    next(error);
  }
}

export async function getSaga(req, res, next) {
  try {
    if (!uuidRegex.test(req.params.id)) {
      throw new AppError(400, 'Invalid saga id');
    }

    const saga = await findSagaById(req.params.id);

    if (!saga) {
      throw new AppError(404, 'Saga not found');
    }

    res.status(200).json(sanitizeSaga(saga));
  } catch (error) {
    next(error);
  }
}
