# GPU Co-op — convenience Makefile
# Run `make help` to see all targets.

.PHONY: help install dev dev-nosandbox build typecheck clean ip proto mac win linux rebuild kill fix-sandbox

help:  ## Show this help
	@echo "GPU Co-op — common tasks:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
	@echo ""

install:  ## Install dependencies and rebuild native modules for Electron
	npm install

dev:  ## Start the app in dev mode (Vite + Electron + tsc --watch)
	npm run dev

dev-nosandbox:  ## Linux: start dev mode without Chromium sandbox (use if you hit chrome-sandbox errors)
	ELECTRON_EXTRA_ARGS=--no-sandbox npm run dev

fix-sandbox:  ## Linux: fix chrome-sandbox permissions (one-time, requires sudo). Re-run after npm install.
	@echo "Fixing chrome-sandbox permissions (requires sudo)..."
	sudo chown root:root node_modules/electron/dist/chrome-sandbox
	sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
	@echo "Done. You can now run 'make dev'."

build:  ## Production build (Vite + tsc + copy proto)
	npm run build

typecheck:  ## Run TypeScript typecheck without emitting
	npm run typecheck

proto:  ## Copy coop.proto into dist/proto
	npm run copy:proto

clean:  ## Remove build output
	rm -rf dist

rebuild:  ## Rebuild better-sqlite3 for Electron (fix native module mismatch)
	npx electron-rebuild -f -w better-sqlite3

ip:  ## Print this machine's LAN IPs (share these with peers for LAN connect)
	@echo "Your LAN IPs (other machine should connect to one of these on :50051):"
	@ifconfig 2>/dev/null | grep -E 'inet (192\.168|10\.|172\.)' | awk '{print "  " $$2 ":50051"}' || \
		ipconfig 2>/dev/null | grep -E 'IPv4 Address' | awk -F: '{print "  " $$2 ":50051"}'

kill:  ## Kill any stuck electron/daemon processes (useful if dev hangs)
	@pkill -f "electron" 2>/dev/null || true
	@pkill -f "dist/daemon/index.js" 2>/dev/null || true
	@echo "Killed electron/daemon processes"

mac:  ## Build .dmg for macOS
	npm run build:mac

win:  ## Build .exe installer for Windows
	npm run build:win

linux:  ## Build AppImage/.deb for Linux
	npm run build:linux
