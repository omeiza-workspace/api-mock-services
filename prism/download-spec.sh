#!/bin/sh
# Download the Twilio API v2010 OpenAPI spec.
#
# The specifications are kept in specs/sources.json, and refreshed by
# scripts/update-specs.js — use that, rather than this, so every provider is
# handled the same way.
#
#   node scripts/update-specs.js
#
set -e

cd "$(dirname "$0")/.."

exec node scripts/update-specs.js
