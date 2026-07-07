# --- Sky Root CRM API ---
FROM node:20-alpine

WORKDIR /app

# install deps first for better layer caching
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# uploads live on a mounted volume
RUN mkdir -p /app/uploads
ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads

EXPOSE 4000

# entrypoint waits for DB, applies schema + seeds on first boot, then starts
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
