#!/bin/bash
# Persist-Main - Start Backend

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load .env if it exists
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

BACKEND_PORT="${PERSIST_BACKEND_PORT:-8000}"

echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Persist-Main Backend              ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo ""

# Check if PostgreSQL is running
echo -e "${YELLOW}[1/3] Checking PostgreSQL...${NC}"
if ! pg_isready -q; then
    echo -e "${RED}✗ PostgreSQL is not running${NC}"
    echo "  Start PostgreSQL and try again"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL is running${NC}"

# Check if database exists
if ! psql -lqt | cut -d \| -f 1 | grep -qw appletta; then
    echo -e "${YELLOW}  Creating database 'appletta'...${NC}"
    createdb appletta
    if [ -f "scripts/schema.sql" ]; then
        echo -e "${YELLOW}  Applying schema...${NC}"
        psql appletta < scripts/schema.sql
        echo -e "${GREEN}✓ Database initialized${NC}"
    fi
else
    echo -e "${GREEN}✓ Database 'appletta' exists${NC}"
fi

echo ""

# Check if virtual environment exists
echo -e "${YELLOW}[2/3] Checking dependencies...${NC}"
if [ ! -d ".venv" ]; then
    echo -e "${RED}✗ No virtual environment found. Install dependencies first:${NC}"
    echo "  python3.11 -m venv .venv"
    echo "  .venv/bin/pip install --upgrade pip"
    echo "  .venv/bin/pip install -r requirements.lock.txt"
    exit 1
fi
echo -e "${GREEN}✓ Virtual environment found${NC}"

echo ""
echo -e "${YELLOW}[3/3] Starting backend server...${NC}"
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Backend Starting! 💜              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo "Instance:  ${PERSIST_INSTANCE:-main}"
echo "Backend:   http://localhost:${BACKEND_PORT}"
echo "API Docs:  http://localhost:${BACKEND_PORT}/docs"
echo ""
echo "Press Ctrl+C to stop the backend"
echo ""

# Activate venv and start backend
source .venv/bin/activate
python -m backend.main