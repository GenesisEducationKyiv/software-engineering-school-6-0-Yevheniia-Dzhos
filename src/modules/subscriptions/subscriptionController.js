import {
  createSubscription,
  confirmSubscription,
  unsubscribe,
  listSubscriptions
} from './subscriptionService.js';

export async function subscribe(req, res, next) {
  try {
    await createSubscription(req.body || {});
    res.status(200).json({ message: 'Subscription successful. Confirmation email sent.' });
  } catch (error) {
    next(error);
  }
}

export async function confirm(req, res, next) {
  try {
    await confirmSubscription(req.params.token);
    res.status(200).json({ message: 'Subscription confirmed successfully' });
  } catch (error) {
    next(error);
  }
}

export async function unsubscribeUser(req, res, next) {
  try {
    await unsubscribe(req.params.token);
    res.status(200).json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    next(error);
  }
}

export async function getSubscriptions(req, res, next) {
  try {
    const subscriptions = await listSubscriptions(req.query.email);
    res.status(200).json(subscriptions);
  } catch (error) {
    next(error);
  }
}
