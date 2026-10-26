# AICTE SDFP: one container runs the web app, REST API, SQLite database, scheduler and mock bank/AICTE/payment services.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 SDFP_DATA_DIR=/data
COPY --from=build /app /app
VOLUME /data
EXPOSE 8080
CMD ["npx", "tsx", "server/index.ts"]
