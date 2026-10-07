# One backend image for the API Gateway and every microservice.
# Docker Compose and Kubernetes pick the process with the container command:
#   node api-gateway/src/server.js                 (public, port 2001)
#   node services/<name>-service/src/server.js     (internal, ports 2101-2112)
# Without a command it runs the legacy all-in-one server (index.js) on 2001.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .
RUN mkdir -p /app/uploads

EXPOSE 2001 2101 2102 2103 2104 2105 2106 2107 2108 2109 2110 2111 2112

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||2001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
