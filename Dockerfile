# The API server (step 1 is data-only; web/dist is served when it exists in later steps).
FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=7834
COPY package.json package-lock.json* ./
COPY server/package.json server/
RUN npm ci --omit=dev -w server || npm install --omit=dev -w server; npm cache clean --force
COPY server/src server/src
USER node
EXPOSE 7834
# Inside the container the server must listen on all interfaces, so CIBALAB_BIND is set here on purpose.
# The compose file publishes the port on 127.0.0.1 only; do not publish it more widely.
ENV CIBALAB_BIND=0.0.0.0
CMD ["node", "server/src/index.js"]
