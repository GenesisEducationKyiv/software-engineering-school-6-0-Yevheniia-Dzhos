FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY services/notification-service ./services/notification-service

EXPOSE 3002

CMD ["node", "services/notification-service/src/server.js"]
