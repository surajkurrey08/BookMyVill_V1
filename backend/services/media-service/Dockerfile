# Build from backend/: docker build -f services/media-service/Dockerfile -t bookmyvilla/media-service .
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
ENV PORT=2112 SERVICE_NAME=media-service
EXPOSE 2112
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "services/media-service/src/server.js"]
