export default async function globalTeardown() {
  try {
    await fetch('http://127.0.0.1:3310/shutdown', { method: 'POST' });
  } catch (shutdownError) {
    void shutdownError;
  }
}