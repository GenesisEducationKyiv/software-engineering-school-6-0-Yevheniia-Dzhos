FROM node:26-alpine

WORKDIR /app

COPY services/notification-service/package*.json ./
RUN npm ci --omit=dev

COPY services/notification-service ./services/notification-service
COPY shared ./shared

EXPOSE 3002

CMD ["node", "services/notification-service/src/server.js"]
