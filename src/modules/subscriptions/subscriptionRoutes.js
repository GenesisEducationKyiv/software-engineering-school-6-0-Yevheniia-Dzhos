import { Router } from 'express';
import { createSubscriptionController } from './subscriptionController.js';

export function createSubscriptionRoutes(dependencies) {
    const router = Router();
    const {
        subscribe,
        confirm,
        unsubscribeUser,
        getSubscriptions
    } = createSubscriptionController(dependencies);

    router.post('/subscribe', subscribe);
    router.get('/confirm/:token', confirm);
    router.get('/unsubscribe/:token', unsubscribeUser);
    router.get('/subscriptions', getSubscriptions);

    return router;
}
