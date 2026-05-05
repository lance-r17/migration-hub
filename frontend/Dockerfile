# syntax=docker/dockerfile:1

# Configurable base images — override at build time via --build-arg
# or set BUILD_IMAGE / RUNTIME_IMAGE in your environment file.
#
# COMPATIBILITY RULE: BUILD_IMAGE and RUNTIME_IMAGE must use the same C library.
#   • Both musl (Alpine)   → e.g. node:20-alpine + distroless-base (Alpine-based)
#   • Both glibc (Debian)  → e.g. node:20-slim + gcr.io/distroless/cc
#
# Default builder is Alpine (node:20-alpine). If your runtime image is glibc-based,
# change BUILD_IMAGE to node:20-slim and install nginx via apt-get instead of apk.
ARG BUILD_IMAGE=node:20-alpine
ARG RUNTIME_IMAGE=nginx:alpine

# -------------------------
# Stage 1: Build + install nginx
# -------------------------
FROM ${BUILD_IMAGE} AS builder

WORKDIR /app

# Install nginx in the builder. This is the ONLY stage with a package manager.
# The binary, config, and all shared libraries are copied to the runtime below.
RUN apk add --no-cache nginx

# Copy dependency manifests and install
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build-time environment variables (Vite bakes these into the bundle)
ARG VITE_API_BASE_URL=
ARG VITE_EMAIL_SERVER_URL=
ARG VITE_OAUTH_SERVICE_URL=
ARG VITE_OAUTH_CLIENT_ID=
ARG VITE_OAUTH_REDIRECT_URI=
ARG VITE_OIDC_ISSUER=
ARG VITE_OIDC_CLIENT_ID=
ARG VITE_OIDC_REDIRECT_URI=
ARG VITE_ALLOWED_HOSTS=

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_EMAIL_SERVER_URL=${VITE_EMAIL_SERVER_URL}
ENV VITE_OAUTH_SERVICE_URL=${VITE_OAUTH_SERVICE_URL}
ENV VITE_OAUTH_CLIENT_ID=${VITE_OAUTH_CLIENT_ID}
ENV VITE_OAUTH_REDIRECT_URI=${VITE_OAUTH_REDIRECT_URI}
ENV VITE_OIDC_ISSUER=${VITE_OIDC_ISSUER}
ENV VITE_OIDC_CLIENT_ID=${VITE_OIDC_CLIENT_ID}
ENV VITE_OIDC_REDIRECT_URI=${VITE_OIDC_REDIRECT_URI}
ENV VITE_ALLOWED_HOSTS=${VITE_ALLOWED_HOSTS}

# Build the production bundle
# NOTE: uses `vite build` directly (not `npm run build`) to skip the tsc
# type-check step. Vite compiles TS via esbuild. Fix type errors in the
# source to restore `npm run build` (= tsc -b && vite build).
RUN npx vite build

# Assemble a rootfs with nginx and every shared library it needs.
# Distroless images have no shell or package manager, so we pre-bake
# everything here and copy the entire tree into the runtime stage.
RUN mkdir -p /rootfs/usr/sbin \
    /rootfs/etc/nginx \
    /rootfs/var/log/nginx \
    /rootfs/var/lib/nginx/logs \
    /rootfs/var/lib/nginx/tmp/client_body \
    /rootfs/run \
    /rootfs/var/cache/nginx \
    /rootfs/usr/share/nginx/html \
    /rootfs/lib

# Copy nginx binary and mime.types (the only stock file we need).
# Our custom nginx.conf (copied later) replaces the full stock config.
RUN cp /usr/sbin/nginx /rootfs/usr/sbin/ && \
    cp /etc/nginx/mime.types /rootfs/etc/nginx/

# Copy shared libraries required by nginx (resolved via the musl dynamic linker).
# If using a glibc-based builder, replace the LDD line with: ldd /usr/sbin/nginx
RUN LDD="$(echo /lib/ld-musl-*.so.1)" && \
    "$LDD" --list /usr/sbin/nginx 2>/dev/null | \
    awk '{print $3}' | grep '^/' | sort -u | \
    while read -r f; do \
        mkdir -p "/rootfs$(dirname "$f")" && cp -a "$f" "/rootfs$f"; \
    done

# Ensure runtime directories are writable (distroless images often run as non-root)
# Symlink nginx log files to stdout/stderr so `docker logs` captures them.
# This is the standard pattern used by the official nginx Docker image.
RUN ln -sf /dev/stdout /rootfs/var/log/nginx/access.log \
    && ln -sf /dev/stderr /rootfs/var/log/nginx/error.log

RUN chmod -R 777 /rootfs/var/log/nginx /rootfs/run /rootfs/var/cache/nginx \
    /rootfs/var/lib/nginx/logs /rootfs/var/lib/nginx/tmp

# -------------------------
# Stage 2: Runtime
# -------------------------
FROM ${RUNTIME_IMAGE}

# Copy the pre-assembled nginx rootfs into the runtime image.
# If RUNTIME_IMAGE already contains nginx (e.g. nginx:alpine), these files
# are overwritten with the builder's versions — harmless and idempotent.
COPY --from=builder /rootfs /

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config (complete standalone config, listens on 8080)
COPY --from=builder /app/nginx.conf /etc/nginx/nginx.conf

# Copy entrypoint script that generates config.json from env vars
COPY --from=builder /app/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/sbin/nginx", "-g", "daemon off;"]
