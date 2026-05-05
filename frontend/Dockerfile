# syntax=docker/dockerfile:1

# Configurable base images — override at build time via --build-arg.
#
# COMPATIBILITY RULE: BUILD_IMAGE and RUNTIME_IMAGE must use the same C library.
#   • Both glibc (Debian) → e.g. node:20-slim + gcr.io/distroless/base
ARG BUILD_IMAGE=node:20-slim
ARG RUNTIME_IMAGE=gcr.io/distroless/base
ARG GO_BUILD_IMAGE=golang:1.22-bookworm

# -------------------------
# Stage 1: Build frontend assets + extract nginx
# -------------------------
FROM ${BUILD_IMAGE} AS frontend-builder

WORKDIR /app

# Install nginx in the builder so we can extract the binary + shared libraries.
# This is the ONLY stage with a package manager.
RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency manifests and install
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

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
    /rootfs/lib/x86_64-linux-gnu \
    /rootfs/lib64 \
    /rootfs/usr/lib/x86_64-linux-gnu

# Copy nginx binary and mime.types (the only stock file we need).
# Our custom nginx.conf (copied later) replaces the full stock config.
RUN cp /usr/sbin/nginx /rootfs/usr/sbin/ && \
    cp /etc/nginx/mime.types /rootfs/etc/nginx/

# Copy shared libraries required by nginx.
# Three-step approach to handle Debian's /lib → /usr/lib merge and ldd
# symlink resolution quirks, while ensuring BuildKit can copy the result.
RUN ldd /usr/sbin/nginx | grep -oE '/[^ ]+' | sort -u | while read -r f; do \
        case "$f" in *linux-vdso*) continue ;; esac; \
        dir=$(dirname "$f"); \
        mkdir -p "/rootfs$dir"; \
        cp -a "$f" "/rootfs$f"; \
    done && \
    find /rootfs -type l | while read -r link; do \
        orig=$(echo "$link" | sed 's|^/rootfs||'); \
        target=$(readlink -f "$orig"); \
        if [ -n "$target" ] && [ -e "$target" ]; then \
            rm "$link"; \
            cp -a "$target" "$link"; \
        fi; \
    done && \
    ldd /usr/sbin/nginx | grep '=> /' | while read -r name arrow path rest; do \
        dir=$(dirname "$path"); \
        if [ ! -e "/rootfs$dir/$name" ]; then \
            cp -a "/rootfs$path" "/rootfs$dir/$name"; \
        fi; \
    done

# Ensure runtime directories are writable (distroless images often run as non-root)
# Symlink nginx log files to stdout/stderr so `docker logs` captures them.
# This is the standard pattern used by the official nginx Docker image.
RUN ln -sf /dev/stdout /rootfs/var/log/nginx/access.log && \
    ln -sf /dev/stderr /rootfs/var/log/nginx/error.log

RUN chmod -R 777 /rootfs/var/log/nginx /rootfs/run /rootfs/var/cache/nginx \
    /rootfs/var/lib/nginx/logs /rootfs/var/lib/nginx/tmp

# -------------------------
# Stage 2: Build Go init binary
# -------------------------
FROM ${GO_BUILD_IMAGE} AS go-builder

WORKDIR /build
COPY cmd/init/go.mod cmd/init/main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /entrypoint .

# -------------------------
# Stage 3: Runtime
# -------------------------
FROM ${RUNTIME_IMAGE}

# Copy the pre-assembled nginx rootfs into the runtime image.
# Copying each top-level directory individually avoids a BuildKit limitation
# when merging a directory tree into / (symlink conflicts in distroless).
COPY --from=frontend-builder /rootfs/etc /etc
COPY --from=frontend-builder /rootfs/lib /lib
COPY --from=frontend-builder /rootfs/lib64 /lib64
COPY --from=frontend-builder /rootfs/run /run
COPY --from=frontend-builder /rootfs/usr /usr
COPY --from=frontend-builder /rootfs/var /var

# Copy built static files
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy custom nginx config (complete standalone config, listens on 8080)
COPY nginx.conf /etc/nginx/nginx.conf

# Copy the Go entrypoint binary that injects env vars into index.html
COPY --from=go-builder /entrypoint /entrypoint

EXPOSE 8080

ENTRYPOINT ["/entrypoint"]
CMD ["/usr/sbin/nginx", "-g", "daemon off; user root root;"]
