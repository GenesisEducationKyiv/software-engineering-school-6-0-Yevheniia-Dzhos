import { findSagaById, listRecentSagas } from './sagaRepository.js';
import { AppError } from '../../utils/errors.js';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listSagas(_req, res, next) {
  try {
    const sagas = await listRecentSagas();
    res.status(200).json(sagas);
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
      res.status(404).json({ error: 'Saga not found' });
      return;
    }

    res.status(200).json(saga);
  } catch (error) {
    next(error);
  }
}
