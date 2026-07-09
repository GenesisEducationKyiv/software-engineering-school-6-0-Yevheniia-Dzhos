import { beforeEach, describe, expect, it, vi } from 'vitest';

const publish = vi.fn();
const closePublisher = vi.fn();
const closeBroker = vi.fn();

vi.mock('@notifier/shared/modules/messaging/brokerClient.js', () => ({
  createBrokerClient: vi.fn(() => ({ close: closeBroker }))
}));
vi.mock('@notifier/shared/modules/messaging/notificationPublisher.js', () => ({
  createNotificationPublisher: vi.fn(() => ({
    publish,
    close: closePublisher
  }))
}));

const notifications = await import('../../src/modules/notifications/index.js');

describe('notifications module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes subscription confirmation commands', async () => {
    await notifications.sendSubscriptionConfirmation(
      'user@example.com',
      'token-123',
      'owner/repo'
    );

    expect(publish).toHaveBeenCalledWith(
      'notification.subscription-confirmation.send',
      {
        email: 'user@example.com',
        token: 'token-123',
        repo: 'owner/repo'
      }
    );
  });

  it('publishes release commands', async () => {
    await notifications.sendReleaseNotification(
      'user@example.com',
      'owner/repo',
      'v1.0.0',
      'unsubscribe-token'
    );

    expect(publish).toHaveBeenCalledWith('notification.release.send', {
      email: 'user@example.com',
      repo: 'owner/repo',
      tag: 'v1.0.0',
      unsubscribeToken: 'unsubscribe-token'
    });
  });

  it('closes publisher resources', async () => {
    await notifications.closeNotificationPublisher();

    expect(closePublisher).toHaveBeenCalledTimes(1);
    expect(closeBroker).toHaveBeenCalledTimes(1);
  });
});
