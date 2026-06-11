FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production 2>/dev/null || true

COPY . .

ENV NODE_ENV=production
ENV PANEL_API=http://panel:3000

EXPOSE 3001

CMD ["node", "bot.js"]
