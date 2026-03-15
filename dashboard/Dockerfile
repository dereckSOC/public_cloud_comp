FROM node:20-alpine AS deps
WORKDIR /workspace/dashboard
COPY .npmrc ../.npmrc
COPY dashboard/package*.json ./
COPY shared ../shared
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /workspace/dashboard
COPY --from=deps /workspace/dashboard/node_modules ./node_modules
RUN rm -rf ./node_modules/@psd/shared
COPY shared ./node_modules/@psd/shared
COPY dashboard/ .

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
COPY --from=builder /workspace/dashboard/.next/standalone ./
COPY --from=builder /workspace/dashboard/.next/static ./dashboard/.next/static
COPY --from=builder /workspace/dashboard/public ./dashboard/public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "dashboard/server.js"]
