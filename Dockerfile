# Image de production : interface construite par Vite + serveur Rust (server-rs/).
# Node ne sert qu'à construire l'interface ; il n'est pas dans l'image finale.

# Interface (dist/public)
FROM node:20-alpine AS client-build
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js components.json ./
COPY client/ client/
COPY shared/ shared/
RUN NODE_ENV=production npx vite build && test -f dist/public/index.html

# Serveur : binaire statique (musl) pour l'image Alpine
FROM rust:1.97-alpine AS rust-build
RUN apk add --no-cache musl-dev
WORKDIR /build
# Dépendances d'abord : couche en cache tant que Cargo.lock ne change pas
COPY server-rs/Cargo.toml server-rs/Cargo.lock ./server-rs/
RUN mkdir -p server-rs/src && echo "fn main() {}" > server-rs/src/main.rs && \
    cargo build --release --locked --manifest-path server-rs/Cargo.toml && \
    rm -rf server-rs/src
COPY server-rs/build.rs ./server-rs/build.rs
COPY server-rs/src ./server-rs/src
COPY shared/permissions.json ./shared/permissions.json
RUN touch server-rs/src/main.rs && \
    cargo build --release --locked --manifest-path server-rs/Cargo.toml

FROM alpine:3.20 AS production
# pg_dump/psql pour les sauvegardes, wget pour la sonde de santé
RUN apk add --no-cache postgresql-client wget tzdata ca-certificates && \
    addgroup -g 1001 -S logiflow && adduser -S logiflow -u 1001 -G logiflow
WORKDIR /app
COPY --from=rust-build /build/server-rs/target/release/logiflow /app/bin/logiflow
COPY --from=client-build /app/dist/public /app/dist/public
COPY migrations/ /app/migrations/
RUN mkdir -p /app/backups && chown -R logiflow:logiflow /app/backups
USER logiflow

ENV PORT=3000 \
    STATIC_DIR=/app/dist/public \
    BACKUP_DIR=/app/backups \
    NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["/app/bin/logiflow"]
