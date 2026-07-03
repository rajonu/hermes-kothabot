FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=prod

# Copy source code
COPY src ./src
COPY tsconfig.json ./tsconfig.json

# Install dev dependencies for build
RUN npm ci

# Compile TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

EXPOSE 8080

CMD ["node", "dist/index.js"]
