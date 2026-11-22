#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# T-101: respaldo diario de la base de Supabase desde el VPS.
# Guía: docs/19-vps.md → "Respaldo diario de la base".
#
# Por qué existe: en el plan gratis Supabase no guarda copias que uno pueda
# recuperar. Si algo borra la base (un error, una migración mala, alguien con
# la llave), se pierden los pedidos de los clientes. Este script saca una
# copia completa cada noche con pg_dump y guarda las últimas 14.
#
# Por qué pg_dump dentro de Docker: así no hay que instalar Postgres en el
# servidor, y la versión de pg_dump se elige con PG_IMAGEN (tiene que ser
# igual o más nueva que la de Supabase, si no pg_dump se niega).
#
# Lo que NO copia: las fotos de comprobantes y los QR (Storage de Supabase).
# Los pedidos, clientes, negocios y configuración sí.
#
# Uso (lo corre cron, ver la guía):  /opt/nexo/respaldo-db.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

DIR_NEXO="${DIR_NEXO:-/opt/nexo}"
# La cadena de conexión vive en un archivo aparte, legible solo por root:
# trae la contraseña de la base, que no va en el repo ni en .env.production
# (la app no la necesita, y así un error en la app no la expone).
ARCHIVO_SECRETO="$DIR_NEXO/respaldo.env"
DIR_RESPALDOS="$DIR_NEXO/respaldos"
DIAS_A_GUARDAR="${DIAS_A_GUARDAR:-14}"

if [[ ! -r "$ARCHIVO_SECRETO" ]]; then
  echo "[respaldo] falta $ARCHIVO_SECRETO (ver docs/19-vps.md)" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ARCHIVO_SECRETO"
: "${SUPABASE_DB_URL:?[respaldo] falta SUPABASE_DB_URL en $ARCHIVO_SECRETO}"
PG_IMAGEN="${PG_IMAGEN:-postgres:17-alpine}"

mkdir -p "$DIR_RESPALDOS"
chmod 700 "$DIR_RESPALDOS"

FECHA="$(date -u +%Y-%m-%d)"
DESTINO="$DIR_RESPALDOS/aurela-$FECHA.dump"
TEMPORAL="$DESTINO.parcial"

# Se escribe primero a un archivo temporal y se renombra solo si pg_dump
# terminó bien: así un respaldo cortado a la mitad nunca reemplaza al bueno
# de ayer ni cuenta como "el de hoy".
# -Fc: formato propio de Postgres, comprimido y restaurable tabla por tabla.
# --no-owner / --no-privileges: se puede restaurar en otro proyecto sin
# chocar con los roles internos de Supabase.
# Solo los esquemas de la app y de los usuarios (login); los internos de
# Supabase se recrean solos en un proyecto nuevo.
if docker run --rm -e PGCONNECT_TIMEOUT=20 "$PG_IMAGEN" \
  pg_dump "$SUPABASE_DB_URL" -Fc --no-owner --no-privileges \
  --schema=public --schema=auth >"$TEMPORAL"; then
  mv "$TEMPORAL" "$DESTINO"
  chmod 600 "$DESTINO"
else
  rm -f "$TEMPORAL"
  echo "[respaldo] pg_dump falló ($FECHA)" >&2
  exit 1
fi

# Rotación: los de más de DIAS_A_GUARDAR días se borran.
find "$DIR_RESPALDOS" -name 'aurela-*.dump' -mtime +"$DIAS_A_GUARDAR" -delete

echo "[respaldo] ok: $DESTINO ($(du -h "$DESTINO" | cut -f1))"

# Opcional: avisarle a un monitor de "latido" (healthchecks.io, gratis) que el
# respaldo corrió. Si una noche no llega el aviso, el monitor manda correo:
# así uno se entera de que los respaldos dejaron de salir sin tener que mirar.
if [[ -n "${RESPALDO_PING_URL:-}" ]]; then
  curl -fsS -m 10 --retry 3 "$RESPALDO_PING_URL" >/dev/null || true
fi
