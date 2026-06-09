#!/bin/bash
# build-push.sh — Build and push all Docker images to Azure Container Registry
# Usage: ./scripts/build-push.sh <acr-login-server> [tag]
#
# Example: ./scripts/build-push.sh dynamnicrbac.azurecr.io v1.0.0
#
# Prerequisites:
#   - Docker installed and running
#   - az acr login --name <acr-name> already performed
#   - ACR name from Azure Portal or: az acr list --query [].loginServer -o tsv

set -euo pipefail

ACR_SERVER="${1:?Usage: $0 <acr-login-server> [tag]}"
TAG="${2:-latest}"
BUILD_NO="${BUILD_NUMBER:-$(date +%Y%m%d%H%M%S)}"
FULL_TAG="${ACR_SERVER}/dynamic-rbac"

echo "============================================"
echo "Building and pushing to $ACR_SERVER"
echo "Tag: $TAG (build: $BUILD_NO)"
echo "============================================"

# Login to ACR (use credential from env if available)
if [[ -n "${AZURE_CLIENT_ID:-}" ]] && [[ -n "${AZURE_TENANT_ID:-}" ]]; then
    echo "Logging in via Azure Service Principal..."
    az acr login --name "$(echo $ACR_SERVER | cut -d. -f1)" --expose-token 2>/dev/null || true
fi

# ── AuthModule ──────────────────────────────────
echo ""
echo ">>> Building authmodule:$TAG ..."
docker buildx build \
    --platform linux/amd64 \
    --tag "${FULL_TAG}/authmodule:$TAG" \
    --tag "${FULL_TAG}/authmodule:${TAG}-${BUILD_NO}" \
    --file ./be/AuthModule/Dockerfile \
    ./be/AuthModule \
    --push

# ── MainModule ─────────────────────────────────
echo ""
echo ">>> Building mainmodule:$TAG ..."
docker buildx build \
    --platform linux/amd64 \
    --tag "${FULL_TAG}/mainmodule:$TAG" \
    --tag "${FULL_TAG}/mainmodule:${TAG}-${BUILD_NO}" \
    --file ./be/MainModule/Dockerfile \
    ./be/MainModule \
    --push

# ── LocalGateway ────────────────────────────────
echo ""
echo ">>> Building localgateway:$TAG ..."
docker buildx build \
    --platform linux/amd64 \
    --tag "${FULL_TAG}/localgateway:$TAG" \
    --tag "${FULL_TAG}/localgateway:${TAG}-${BUILD_NO}" \
    --file ./be/LocalGateway/Dockerfile \
    ./be/LocalGateway \
    --push

# ── Frontend ───────────────────────────────────
# Build args for VITE_ env vars (passed at build time)
FE_MAIN_API="${VITE_MAIN_API_BASE_URL:-https://your-apim.azure-api.net}"
FE_AUTH_API="${VITE_AUTH_API_BASE_URL:-https://your-apim.azure-api.net}"

echo ""
echo ">>> Building frontend:$TAG ..."
docker buildx build \
    --platform linux/amd64 \
    --tag "${FULL_TAG}/frontend:$TAG" \
    --tag "${FULL_TAG}/frontend:${TAG}-${BUILD_NO}" \
    --build-arg "VITE_MAIN_API_BASE_URL=$FE_MAIN_API" \
    --build-arg "VITE_AUTH_API_BASE_URL=$FE_AUTH_API" \
    --file ./fe/Dockerfile \
    ./fe \
    --push

echo ""
echo "============================================"
echo "Done. Images pushed:"
echo "  ${FULL_TAG}/authmodule:${TAG}"
echo "  ${FULL_TAG}/mainmodule:${TAG}"
echo "  ${FULL_TAG}/localgateway:${TAG}"
echo "  ${FULL_TAG}/frontend:${TAG}"
echo "============================================"
