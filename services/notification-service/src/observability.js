import { createObservability } from '@notifier/shared/modules/observability/index.js';
export const {
  logger,
  registerObservability,
  setNotificationMessagesInFlight
} = createObservability('notification-service');

