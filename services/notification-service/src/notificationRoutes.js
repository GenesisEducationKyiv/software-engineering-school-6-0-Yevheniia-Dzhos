import { Router } from 'express';
import { sendSubscriptionConfirmationRest } from './notificationController.js';

const router = Router();

router.post(
  '/api/notifications/subscription-confirmation',
  sendSubscriptionConfirmationRest
);

export default router;
