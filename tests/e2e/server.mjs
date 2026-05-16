import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const app = express();

app.use(express.json());
app.use(express.static(path.join(rootDir, 'src/public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/subscribe', (req, res) => {
  const { email, repo } = req.body || {};

  if (!String(email || '').includes('@')) {
    res.status(400).json({ error: 'Invalid email' });
    return;
  }

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(repo || ''))) {
    res.status(400).json({ error: 'Invalid repo format' });
    return;
  }

  res.json({ message: 'Subscription successful. Confirmation email sent.' });
});

const port = Number(process.env.E2E_PORT || 3310);

app.listen(port, '127.0.0.1', () => {
  console.log(`E2E server running on http://127.0.0.1:${port}`);
});
