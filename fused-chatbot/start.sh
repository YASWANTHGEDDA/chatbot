#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i ":$1" >/dev/null 2>&1
}

# Check required commands
print_message "Checking required commands..."
for cmd in node npm python pip; do
    if ! command_exists $cmd; then
        print_error "$cmd is not installed"
        exit 1
    fi
done

# Check if ports are available
print_message "Checking port availability..."
if port_in_use 3000; then
    print_error "Port 3000 is already in use"
    exit 1
fi

if port_in_use 5000; then
    print_error "Port 5000 is already in use"
    exit 1
fi

# Install Node.js dependencies
print_message "Installing Node.js dependencies..."
cd server
npm install
if [ $? -ne 0 ]; then
    print_error "Failed to install Node.js dependencies"
    exit 1
fi
cd ..

# Install Python dependencies
print_message "Installing Python dependencies..."
cd server/rag_service
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    print_error "Failed to install Python dependencies"
    exit 1
fi
cd ../..

# Create required directories
print_message "Creating required directories..."
mkdir -p server/rag_service/uploads
mkdir -p server/rag_service/faiss_index

# Start the services
print_message "Starting services..."

# Start RAG service in the background
print_message "Starting RAG service..."
cd server/rag_service
python app.py &
RAG_PID=$!
cd ../..

# Wait for RAG service to start
sleep 5

# Check if RAG service is running
if ! kill -0 $RAG_PID 2>/dev/null; then
    print_error "RAG service failed to start"
    exit 1
fi

# Start Node.js server
print_message "Starting Node.js server..."
cd server
npm start &
NODE_PID=$!
cd ..

# Function to handle script termination
cleanup() {
    print_message "Shutting down services..."
    kill $RAG_PID 2>/dev/null
    kill $NODE_PID 2>/dev/null
    exit 0
}

# Register cleanup function
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait $RAG_PID $NODE_PID 