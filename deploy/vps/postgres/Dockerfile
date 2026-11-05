# PostgreSQL 17 plus pgBackRest, from the PostgreSQL project's own apt
# repository (already configured in the official image). ca-certificates is
# needed for pgBackRest to talk TLS to Cloudflare R2.
FROM postgres:17
RUN apt-get update \
 && apt-get install -y --no-install-recommends pgbackrest ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /var/log/pgbackrest /var/lib/pgbackrest \
 && chown postgres:postgres /var/log/pgbackrest /var/lib/pgbackrest
