#!/bin/sh
set -eu

WEB_ROOT="/usr/share/nginx/html"

if [ ! -f "$WEB_ROOT/index.html" ]; then
  echo "ERROR: missing $WEB_ROOT/index.html"
  echo "The web image does not contain the built frontend files."
  echo "Please deploy from the project root and rebuild the web image."
  exit 1
fi

if [ ! -f "$WEB_ROOT/logo.png" ]; then
  echo "ERROR: missing $WEB_ROOT/logo.png"
  echo "The application logo was not copied into the web image."
  echo "Please make sure web/public/logo.png exists and rebuild the web image."
  exit 1
fi
