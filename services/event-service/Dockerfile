FROM node:20-alpine
WORKDIR /app/services/event-service
COPY services/event-service/package.json services/event-service/package-lock.json ./
COPY shared /app/shared
RUN npm install --omit=dev
COPY services/event-service/src ./src
EXPOSE 4000
ENV PORT=4000
CMD ["node", "src/index.js"]
