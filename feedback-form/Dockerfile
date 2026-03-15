FROM node:20-alpine AS deps
WORKDIR /workspace/feedback-form
COPY .npmrc ../.npmrc
COPY feedback-form/package*.json ./
COPY shared ../shared
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /workspace/feedback-form
COPY --from=deps /workspace/feedback-form/node_modules ./node_modules
RUN rm -rf ./node_modules/@psd/shared
COPY shared ./node_modules/@psd/shared
COPY feedback-form/ .

ARG NEXT_PUBLIC_DB_URL
ARG NEXT_PUBLIC_DB_ANON_KEY
ENV NEXT_PUBLIC_DB_URL=$NEXT_PUBLIC_DB_URL
ENV NEXT_PUBLIC_DB_ANON_KEY=$NEXT_PUBLIC_DB_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /workspace/feedback-form/.next/standalone ./
COPY --from=builder /workspace/feedback-form/.next/static ./feedback-form/.next/static
COPY --from=builder /workspace/feedback-form/public ./feedback-form/public
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
CMD ["node", "feedback-form/server.js"]
