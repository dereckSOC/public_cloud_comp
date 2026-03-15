FROM node:20-alpine
WORKDIR /app/services/feedback-service
COPY services/feedback-service/package.json services/feedback-service/package-lock.json ./
COPY shared /app/shared
RUN npm install --omit=dev
COPY services/feedback-service/src ./src
EXPOSE 4001
ENV PORT=4001
CMD ["node", "src/index.js"]
