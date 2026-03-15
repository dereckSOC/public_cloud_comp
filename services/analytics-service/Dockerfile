FROM node:20-alpine
WORKDIR /app/services/analytics-service
COPY services/analytics-service/package.json services/analytics-service/package-lock.json ./
COPY shared /app/shared
RUN npm install --omit=dev
COPY services/analytics-service/src ./src
EXPOSE 4002
ENV PORT=4002
CMD ["node", "src/index.js"]
