FROM node:26-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY services/notification-service ./services/notification-service
COPY src/config/envParsers.js src/config/messagingEnv.js ./src/config/
COPY src/modules/messaging ./src/modules/messaging
COPY src/modules/observability ./src/modules/observability

EXPOSE 3002

CMD ["node", "services/notification-service/src/server.js"]
