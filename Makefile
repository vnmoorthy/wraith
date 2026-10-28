.PHONY: demo dev web check
demo:            ## one command: install, build, check, serve on :8666
	./run.sh
dev:             ## backend + vite dev server with hot reload
	.venv/bin/python -m wraith & cd web && npx vite
web:             ## rebuild the UI into wraith/static
	cd web && npx vite build
check:           ## live health check against every partner
	.venv/bin/python -m wraith check
