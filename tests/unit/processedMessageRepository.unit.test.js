import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/notification-service/src/database.js', () => ({
  query: vi.fn()
}));

const database = await import('../../services/notification-service/src/database.js');
const repository = await import(
  '../../services/notification-service/src/processedMessageRepository.js'
);

describe('processed message repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks whether a message was processed', async () => {
    database.query.mockResolvedValue({ rowCount: 1 });

    await expect(repository.hasProcessedMessage('message-1')).resolves.toBe(true);
    expect(database.query).toHaveBeenCalledWith(
      'SELECT 1 FROM processed_messages WHERE message_id = $1',
      ['message-1']
    );
  });

  it('records processed messages idempotently', async () => {
    database.query.mockResolvedValue({ rowCount: 1 });

    await repository.recordProcessedMessage('message-1', 'notification.release.send');

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (message_id) DO NOTHING'),
      ['message-1', 'notification.release.send']
    );
  });
});
