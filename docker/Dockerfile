# The container.
#
# One image runs any of the mocks: the name is an argument.
#
#   docker build -t api-mock-services .
#   docker run --rm -p 4001:4001 api-mock-services stripe
#
FROM node:20-alpine

WORKDIR /app

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

EXPOSE 4001

ENTRYPOINT ["node", "bin/api-mock-services.js", "start"]
CMD ["stripe"]
