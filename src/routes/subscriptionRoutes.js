import { Router } from 'express';
import * as controller from '../controllers/subscriptionController.js';

const router = Router();
router.post('/subscribe', controller.subscribe);
router.get('/confirm/:token', controller.confirm);
router.get('/unsubscribe/:token', controller.unsubscribe);
router.get('/subscriptions', controller.getSubscriptions);

export default router;
