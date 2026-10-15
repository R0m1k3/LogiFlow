#!/usr/bin/env bash
# Construit le serveur Node de référence du banc, depuis le dernier commit qui le
# contient (REFERENCE_NODE_COMMIT), dans une copie de travail à part. Le serveur
# Node ayant quitté le dépôt, c'est contre lui que Rust est comparé.
# Usage : scripts/bench/reference-node.sh [dossier]   (défaut : .bench-reference)
# Puis : export BENCH_NODE_DIR=<dossier>
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
commit="$(tr -d '[:space:]' < "$root/scripts/bench/REFERENCE_NODE_COMMIT")"
dir="${1:-$root/.bench-reference}"

if [ ! -d "$dir/.git" ] && [ ! -f "$dir/.git" ]; then
  git -C "$root" worktree add --detach "$dir" "$commit" > /dev/null
else
  git -C "$dir" checkout --detach -q "$commit"
fi
cd "$dir"
if [ ! -f dist/index.js ] || [ "$(cat dist/.commit 2>/dev/null)" != "$commit" ]; then
  npm ci --no-audit --no-fund > /dev/null
  scripts/bench/build-node.sh > /dev/null
  echo "$commit" > dist/.commit
fi
echo "$dir"
