#!/bin/sh
set -e

# Replace the build-time API_URL with the runtime API_URL in the Next.js build output
if [ -n "$API_URL" ]; then
  echo "Replacing build-time API_URL with runtime API_URL: $API_URL"
  # Patch all .next JSON config files (like routes-manifest.json, required-server-files.json, etc.)
  # with the runtime API_URL value.
  find .next -type f -name "*.json" -exec sed -i "s|http://api:4000|$API_URL|g" {} +
fi

if [ -n "$ACTIVITY_SERVICE_URL" ]; then
  echo "Replacing build-time ACTIVITY_SERVICE_URL with runtime ACTIVITY_SERVICE_URL: $ACTIVITY_SERVICE_URL"
  find .next -type f -name "*.json" -exec sed -i "s|http://activity:5005|$ACTIVITY_SERVICE_URL|g" {} +
fi

# Execute the CMD passed to docker run
exec "$@"
