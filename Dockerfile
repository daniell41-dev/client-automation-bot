# ═══════════════════════════════════════════════════════════════════════════
# T-61: imagen de producción de Nexo para el VPS (ver docs/19-vps.md).
#
# Tres etapas para que la imagen final lleve solo lo necesario para correr:
# dependencias → build → runtime con el server.js de `output: "standalone"`.
#
# Las NEXT_PUBLIC_* van como build args porque Next las incrusta en el
# JavaScript del navegador al compilar. El resto de los secretos (tokens de
# WhatsApp, service role de Supabase, keys de IA) NO pasan por acá: llegan en
# runtime por el env_file del docker-compose, así nunca quedan en la imagen.
# ═══════════════════════════════════════════════════════════════════════════

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Sin root: si alguien llegara a ejecutar algo dentro del contenedor, no
# tiene permisos sobre el sistema.
RUN addgroup -S nexo && adduser -S nexo -G nexo
COPY --from=build --chown=nexo:nexo /app/.next/standalone ./
COPY --from=build --chown=nexo:nexo /app/.next/static ./.next/static
COPY --from=build --chown=nexo:nexo /app/public ./public
USER nexo
EXPOSE 3000
# Next termina los after() pendientes (el procesamiento del webhook) antes de
# salir con SIGTERM; docker compose le da el margen con stop_grace_period.
STOPSIGNAL SIGTERM
CMD ["node", "server.js"]
