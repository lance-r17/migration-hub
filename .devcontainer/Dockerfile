FROM mcr.microsoft.com/devcontainers/typescript-node:4-24-trixie

ARG TZ
ENV TZ="$TZ"

# Install basic development tools and iptables/ipset
RUN apt update && apt install -y less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  curl \
  wget \
  gnupg \
  ca-certificates \
  postgresql-client \
  xvfb \
  xauth

# Set up non-root user
USER node

# Install Claude
RUN curl -fsSL https://claude.ai/install.sh | bash

# Install pi
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

# Install kimi
# RUN curl -fsSL https://code.kimi.com/install.sh | bash

