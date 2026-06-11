FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN npm install -g pnpm 2>/dev/null; pnpm install --frozen-lockfile 2>/dev/null || npm install

COPY . .
RUN pnpm run build 2>/dev/null || npm run build

FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN npm install -g pnpm 2>/dev/null; pnpm install --prod --frozen-lockfile 2>/dev/null || npm install --production

COPY server/ ./server/
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
