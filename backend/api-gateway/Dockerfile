# Build from backend/: docker build -f api-gateway/Dockerfile -t bookmyvilla/api-gateway .
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
USER node
ENV PORT=2001 SERVICE_NAME=api-gateway
EXPOSE 2001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:2001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "api-gateway/src/server.js"]
