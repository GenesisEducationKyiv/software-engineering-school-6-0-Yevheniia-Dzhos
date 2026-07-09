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
      expect.stringContaining("status = 'sent'"),
      ['message-1']
    );
  });

  it('claims a fresh message id', async () => {
    database.query.mockResolvedValue({ rowCount: 1 });

    await expect(
      repository.recordProcessedMessage('message-1', 'notification.release.send')
    ).resolves.toBe(true);

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (message_id) DO UPDATE'),
      ['message-1', 'notification.release.send', expect.any(Number)]
    );
  });

  it('does not reclaim a message that is already sent or still fresh', async () => {
    database.query.mockResolvedValue({ rowCount: 0 });

    await expect(
      repository.recordProcessedMessage('message-1', 'notification.release.send')
    ).resolves.toBe(false);
  });

  it('marks a claimed message as sent', async () => {
    database.query.mockResolvedValue({ rowCount: 1 });

    await repository.markProcessedMessageSent('message-1');

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'sent'"),
      ['message-1']
    );
  });

  it('deletes a processed message claim', async () => {
    database.query.mockResolvedValue({ rowCount: 1 });

    await repository.deleteProcessedMessage('message-1');

    expect(database.query).toHaveBeenCalledWith(
      'DELETE FROM processed_messages WHERE message_id = $1',
      ['message-1']
    );
  });
});
