# GitHub Release Notification API

Тестове завдання на Node.js.

## Що реалізовано

- REST API згідно `swagger.yaml`
- підписка на релізи GitHub-репозиторію
- підтвердження підписки через email
- відписка через токен
- отримання списку підписок за email
- перевірка існування репозиторію через GitHub API
- збереження даних у PostgreSQL
- міграції при старті сервісу
- періодична перевірка нових релізів
- Dockerfile і docker-compose.yml
- unit-тести для частини бізнес-логіки

## Запуск

```bash
cp .env.example .env
docker compose up --build
```

## Доступні сервіси

- API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/docs`
- MailHog: `http://localhost:8025`

## Основні ендпоінти

- `POST /api/subscribe`
- `GET /api/confirm/{token}`
- `GET /api/unsubscribe/{token}`
- `GET /api/subscriptions?email=...`

## Примітка

Для локальної перевірки email використовується MailHog.

