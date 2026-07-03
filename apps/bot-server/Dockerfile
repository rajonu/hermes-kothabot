FROM node:22-alpine

WORKDIR /app

# cloudflared client — used at runtime to dial out to a Cloudflare Tunnel
# that exposes a residential SOCKS5 proxy (see start.sh).
RUN apk add --no-cache curl && \
    curl -L -o /usr/local/bin/cloudflared \
      https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && \
    chmod +x /usr/local/bin/cloudflared

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=prod

# Copy source code
COPY src ./src
COPY tsconfig.json ./tsconfig.json
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Install dev dependencies for build
RUN npm ci

# Compile TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

EXPOSE 8081

CMD ["./start.sh"]
