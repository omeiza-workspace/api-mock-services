# Locates the CI kit and pulls in its make targets.
#
# Order of preference:
#   1. make CI_KIT=/path/to/ci-kit
#   2. $CI_KIT_PATH
#   3. a kit vendored into .ci/kit   (ci init --vendor)
#   4. ~/.local/share/ci-kit          (bin/install.sh)
#   5. ~/ci-kit, /usr/local/share/ci-kit, /opt/homebrew/share/ci-kit
#
# Install the kit with:
#   curl -fsSL https://raw.githubusercontent.com/omeiza-workspace/ci-kit/main/bin/install.sh | sh

CI_SHIM_DIR := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))

CI_KIT_CANDIDATES := \
  $(CI_KIT_PATH) \
  $(CI_SHIM_DIR)kit \
  $(HOME)/.local/share/ci-kit \
  $(HOME)/ci-kit \
  /usr/local/share/ci-kit \
  /opt/homebrew/share/ci-kit

CI_KIT ?= $(firstword $(foreach d,$(CI_KIT_CANDIDATES),$(if $(wildcard $(d)/make/ci.mk),$(d),)))

ifeq ($(CI_KIT),)
$(error The CI kit was not found. Install it with: curl -fsSL https://raw.githubusercontent.com/omeiza-workspace/ci-kit/main/bin/install.sh | sh  (or: make CI_KIT=/path/to/ci-kit))
endif

include $(CI_KIT)/make/ci.mk
