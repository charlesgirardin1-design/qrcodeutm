# Image de production — Photothèque Croix-Rouge
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npx next build
ENV NODE_ENV=production \
    PORT=3000 \
    STORAGE_DRIVER=local \
    LOCAL_STORAGE_DIR=/data/storage
VOLUME ["/data"]
EXPOSE 3000
# Migrations + seed idempotent à chaque démarrage, puis serveur.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next start -p ${PORT}"]
