# ── Build stage: compile the server (tsc) and the client (vite) ───────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

COPY tsconfig.json ./
COPY shared ./shared
COPY engine ./engine
COPY server ./server
COPY cli ./cli
RUN npm run build

COPY client ./client
RUN cd client && npm run build

# ── Runtime stage: plain node, compiled JS, client statics ────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/client/dist ./client/dist

# Room persistence lives here — mount it as a volume
RUN mkdir -p data
VOLUME /app/data

EXPOSE 3001
CMD ["node", "dist/server/index.js"]
