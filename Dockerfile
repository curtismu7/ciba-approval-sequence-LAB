# Build the web bundle, then run the API server serving it.
FROM node:26-alpine AS webbuild
WORKDIR /app
COPY package.json package-lock.json* ./
COPY web/package.json web/
RUN npm ci -w web || npm install -w web
COPY web/ web/
RUN npm run build -w web

# The API server (rule 24b: talkTrack.js lives in web/src and is imported at runtime).
FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=7834
COPY package.json package-lock.json* ./
COPY server/package.json server/
RUN npm ci --omit=dev -w server || npm install --omit=dev -w server; npm cache clean --force
COPY server/src server/src
COPY --from=webbuild /app/web/dist web/dist
COPY web/src/talkTrack.js web/src/talkTrack.js
USER node
EXPOSE 7834
# Inside the container the server must listen on all interfaces, CIBALAB_BIND is set here on purpose.
# The compose file publishes the port on 127.0.0.1 only; do not publish it more widely.
ENV CIBALAB_BIND=0.0.0.0
CMD ["node", "server/src/index.js"]
