#!/usr/bin/env bash
# Build the static site without relying on a pre-created virtualenv.
#
# Jinja is the only runtime dependency. Installing it into a local build
# directory keeps the command reliable on managed Python installations
# (PEP 668) and in Cloudflare Workers Builds.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPS_DIR="${SITE_BUILD_DEPS:-$ROOT/.build-deps}"

cd "$ROOT"
if python3 -c "import jinja2" >/dev/null 2>&1; then
  exec python3 -m sitegen build "$@"
fi

python3 -m pip install \
  --quiet \
  --disable-pip-version-check \
  --upgrade \
  --target "$DEPS_DIR" \
  -r "$ROOT/requirements-site.txt"

PYTHONPATH="$DEPS_DIR${PYTHONPATH:+:$PYTHONPATH}" \
  exec python3 -m sitegen build "$@"
