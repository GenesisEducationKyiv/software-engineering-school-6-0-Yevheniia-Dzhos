FROM node:26-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY packages/shared ./packages/shared
COPY services/notification-service ./services/notification-service

EXPOSE 3002

CMD ["node", "services/notification-service/src/server.js"]
