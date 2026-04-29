import * as subscriptionService from '../services/subscriptionService.js';

export async function subscribe(req, res, next) {
  try {
    await subscriptionService.createSubscription(req.body || {});
    res.status(200).json({ message: 'Subscription successful. Confirmation email sent.' });
  } catch (error) {
    next(error);
  }
}

export async function confirm(req, res, next) {
  try {
    await subscriptionService.confirmSubscription(req.params.token);
    res.status(200).json({ message: 'Subscription confirmed successfully' });
  } catch (error) {
    next(error);
  }
}

export async function unsubscribe(req, res, next) {
  try {
    await subscriptionService.unsubscribe(req.params.token);
    res.status(200).json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    next(error);
  }
}

export async function getSubscriptions(req, res, next) {
  try {
    const subscriptions = await subscriptionService.listSubscriptions(req.query.email);
    res.status(200).json(subscriptions);
  } catch (error) {
    next(error);
  }
}
