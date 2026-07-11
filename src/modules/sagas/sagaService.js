import { findSagaById, listRecentSagas } from './sagaRepository.js';

export function listSagas(filters) {
  return listRecentSagas(filters);
}

export function getSagaById(id) {
  return findSagaById(id);
}
