import { Router } from 'express';
import {
    subscribe,
    confirm,
    unsubscribeUser,
    getSubscriptions
} from './subscriptionController.js';

const router = Router();

router.post('/subscribe', subscribe);
router.get('/confirm/:token', confirm);
router.get('/unsubscribe/:token', unsubscribeUser);
router.get('/subscriptions', getSubscriptions);

export default router;
