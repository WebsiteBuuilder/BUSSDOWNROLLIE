#!/bin/bash
# Roulette Test Runner Script
# Runs comprehensive roulette system tests with coverage

echo "======================================"
echo "🎲 Roulette Testing System"
echo "======================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ Installing dependencies..."
    npm install
fi

echo "📦 Running Roulette Test Suite"
echo ""

# Run tests with coverage
echo "Running tests with coverage report..."
npm test -- tests/roulette --coverage

echo ""
echo "======================================"
echo "✅ Test Execution Complete"
echo "======================================"
echo ""
echo "📊 Coverage reports generated:"
echo "  - Text: Displayed above"
echo "  - JSON: coverage/coverage-final.json"
echo "  - HTML: coverage/index.html (open in browser)"
echo ""
