# Developer commands. The deployed site is built by Python only.
.PHONY: build serve lint test test-js test-python test-e2e test-live manifest

PYTHON ?= python3

build:
	bash scripts/build-site.sh

serve:
	bash scripts/build-site.sh
	$(PYTHON) -m sitegen serve --no-build

manifest:
	$(PYTHON) -m sitegen manifest --data-dir public/data

lint:
	npm run lint
	djlint sitegen/templates --check --lint
	pylint scripts/*.py sitegen/*.py --errors-only

test-js:
	npm run test:js

test-python:
	$(PYTHON) -m pytest tests/ -m "not e2e and not live" --no-cov

test-e2e:
	$(PYTHON) -m pytest tests/e2e -m "not live" --no-cov

test-live:
	$(PYTHON) -m pytest tests/e2e/test_live_site.py -m live --no-cov

test: test-python test-js test-e2e
