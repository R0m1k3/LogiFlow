#!/usr/bin/env bash
# Construit l'interface et le serveur Node comme l'image Docker : vite build, puis
# la commande esbuild du Dockerfile, reprise telle quelle pour ne jamais diverger.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
NODE_ENV=production npx vite build
sed -n '/npx esbuild server\/index.production.ts/,/--external:compression$/p' Dockerfile | sed 's/^RUN //' | bash
test -f dist/index.js && test -f dist/public/index.html
