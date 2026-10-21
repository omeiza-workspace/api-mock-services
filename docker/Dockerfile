# The container.
#
# One image runs any of the mocks: the name is an argument.
#
#   docker build -t api-mock-services .
#   docker run --rm -p 4001:4001 api-mock-services stripe
#
# The image is small because there is nothing in it to install: the mocks
# are built on Node's own HTTP server, and they have no dependencies. It
# runs as a normal user, and it stops when it is told to.
#
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# No dependencies: the mocks are built on Node's own HTTP server.
COPY package.json ./
COPY src ./src
COPY bin ./bin

# The mocks run as a normal user.
RUN adduser -D mocks && chown -R mocks:mocks /app
USER mocks

# The mock to run, and the port it listens on.
ENV MOCK=stripe
ENV PORT=4001

# A published port has to be reachable from outside the container, so the
# mock listens on every interface here. It is not authenticated — do not
# publish it on a network you do not control.
ENV HOST=0.0.0.0

EXPOSE 4001

# Every mock answers this, so a container can be checked without knowing
# which mock it is.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider "http://localhost:${PORT}/health" || exit 1

ENTRYPOINT ["node", "bin/api-mock-services.js", "start"]
CMD ["stripe"]
