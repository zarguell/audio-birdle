# Developer commands. The deployed site is built by Python only.
.PHONY: build serve dev lint hooks check check-all test test-js test-python test-e2e test-live manifest audit-region

PYTHON ?= python3

build:
	bash scripts/build-site.sh

serve:
	bash scripts/build-site.sh
	$(PYTHON) -m sitegen serve --no-build

dev:
	bash scripts/build-site.sh
	npx wrangler dev

manifest:
	$(PYTHON) -m sitegen manifest --data-dir public/data

REGION ?= CA
audit-region:
	$(PYTHON) scripts/region-audit.py --region $(REGION) --output region-audits/$(REGION)-audit.json

lint:
	npm run lint
	djlint sitegen/templates --check --lint
	pylint scripts/*.py sitegen/*.py --errors-only

hooks:
	pre-commit install
	pre-commit install --hook-type pre-push

check: lint test-python test-js build

check-all: check test-e2e

test-js:
	npm run test:js

test-python:
	$(PYTHON) -m pytest tests/ -m "not e2e and not live" --no-cov

test-e2e:
	$(PYTHON) -m pytest tests/e2e -m "not live" --no-cov

test-live:
	$(PYTHON) -m pytest tests/e2e/test_live_site.py -m live --no-cov

test: test-python test-js test-e2e
