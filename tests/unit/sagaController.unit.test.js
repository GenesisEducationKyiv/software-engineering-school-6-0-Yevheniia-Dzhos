import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/sagas/sagaRepository.js', () => ({
  findSagaById: vi.fn(),
  listRecentSagas: vi.fn()
}));

const sagaRepository = await import('../../src/modules/sagas/sagaRepository.js');
const { getSaga, listSagas } = await import('../../src/modules/sagas/sagaController.js');

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
  };
}

describe('saga controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unknown saga state filters', async () => {
    const response = createResponse();
    const next = vi.fn();

    await listSagas({ query: { state: 'PENDNG' } }, response, next);

    expect(sagaRepository.listRecentSagas).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      message: 'Invalid saga state'
    }));
  });

  it('rejects unknown saga type filters', async () => {
    const response = createResponse();
    const next = vi.fn();

    await listSagas({ query: { type: 'unknown-saga' } }, response, next);

    expect(sagaRepository.listRecentSagas).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 400,
      message: 'Invalid saga type'
    }));
  });

  it('passes valid saga filters to the repository', async () => {
    sagaRepository.listRecentSagas.mockResolvedValue([]);
    const response = createResponse();

    await listSagas({
      query: {
        limit: '5',
        offset: '10',
        state: 'COMPLETED',
        type: 'subscription-confirmation'
      }
    }, response, vi.fn());

    expect(sagaRepository.listRecentSagas).toHaveBeenCalledWith({
      limit: 5,
      offset: 10,
      state: 'COMPLETED',
      type: 'subscription-confirmation'
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith([]);
  });

  it('sanitizes sensitive saga fields in list responses', async () => {
    sagaRepository.listRecentSagas.mockResolvedValue([{
      id: 'saga-1',
      type: 'subscription-confirmation',
      state: 'FAILED',
      payload: {
        email: 'user@example.com',
        confirmToken: 'secret-token',
        repo: 'owner/repo'
      },
      error: 'Database unavailable at postgres://internal'
    }]);
    const response = createResponse();

    await listSagas({ query: {} }, response, vi.fn());

    expect(response.json).toHaveBeenCalledWith([{
      id: 'saga-1',
      type: 'subscription-confirmation',
      state: 'FAILED',
      payload: { repo: 'owner/repo' },
      error: 'Saga failed, check internal logs for details'
    }]);
  });

  describe('getSaga', () => {
    it('rejects an id that is not a valid UUID', async () => {
      const response = createResponse();
      const next = vi.fn();

      await getSaga({ params: { id: 'not-a-uuid' } }, response, next);

      expect(sagaRepository.findSagaById).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 400,
        message: 'Invalid saga id'
      }));
    });

    it('returns 404 when no saga matches the id', async () => {
      sagaRepository.findSagaById.mockResolvedValue(null);
      const response = createResponse();
      const next = vi.fn();

      await getSaga({ params: { id: '123e4567-e89b-12d3-a456-426614174000' } }, response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 404,
        message: 'Saga not found'
      }));
    });

    it('sanitizes sensitive saga fields in the single-saga response', async () => {
      sagaRepository.findSagaById.mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'subscription-confirmation',
        state: 'FAILED',
        payload: {
          email: 'user@example.com',
          confirmToken: 'secret-token',
          repo: 'owner/repo'
        },
        error: 'Database unavailable at postgres://internal'
      });
      const response = createResponse();

      await getSaga(
        { params: { id: '123e4567-e89b-12d3-a456-426614174000' } },
        response,
        vi.fn()
      );

      expect(sagaRepository.findSagaById)
        .toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'subscription-confirmation',
        state: 'FAILED',
        payload: { repo: 'owner/repo' },
        error: 'Saga failed, check internal logs for details'
      });
    });
  });
});
