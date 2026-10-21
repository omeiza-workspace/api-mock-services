# The mock services.
#
# The local tests are the gate. `make ci` runs them first, so nothing reaches
# a runner that has not been through the same tests on this machine.
#
#   make            list the targets
#   make test       the local tests
#   make pre-ci     the local tests — the step the CI depends on
#   make ci         the local tests, then the CI gate
#   make mocks      start the mocks, for a project to point at
#
# The shared CI kit supplies the rest (doctor, act, hooks-install, config).

# The kit's own `ci` and `help` are replaced by the ones below, so the local
# test always runs first.
CI_KIT_SKIP_COMMON = 1

include .ci/ci.mk

# `make` with no target lists the targets, rather than auditing the
# toolchain.
.DEFAULT_GOAL := help

# The mocks to start by default.
MOCKS ?= stripe resend xero cloudflare paystack

# The compose profile to start — payments, identity, messaging, ai, storage,
# all.
PROFILE ?= all

.PHONY: help test test-watch lint check footprint pre-ci ci ci-fast mocks docker compose clean

help: ## Show the available targets
	@printf '\n\033[1;36mTargets\033[0m\n'
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## .*$$' $(firstword $(MAKEFILE_LIST)) \
		| sort \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@printf '\n'

test: ## Run the tests — the local gate
	@npm test

test-watch: ## Run the tests, and again on every change
	@node --test --watch test/*.test.js

lint: ## Check the house style
	@npm run lint

check: lint test ## The lint and the tests

footprint: ## Check the mocks are still light — memory, CPU and startup
	@npm run footprint

footprint: ## Measure what the engine costs, and fail if it costs too much
	@bash test/footprint.sh

pre-ci: test ## The local tests, before anything else
	@:

ci: pre-ci ## The local tests, then the CI gate
	@$(CI) gate

ci-fast: ## The fast gate — no installs, no services
	@$(CI) gate --fast

mocks: ## Start the mocks, for a project to point at
	@node bin/api-mock-services.js start $(MOCKS)

docker: ## Build the container image
	@docker build -t api-mock-services -f docker/Dockerfile .

compose: ## Start the mocks as containers — make PROFILE=payments for one group
	@docker compose -f examples/docker-compose.yml --profile $(PROFILE) up -d

clean: ## Remove what the local runs leave behind
	@rm -f .mocks.json
	@echo "cleaned"
