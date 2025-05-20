#!/bin/bash

# Create directories if they don't exist
mkdir -p dist/views
mkdir -p dist/public

# Copy view files
echo "Copying view files..."
cp -R src/views/* dist/views/

# Copy public files
echo "Copying public files..."
cp -R src/public/* dist/public/

echo "Asset copying completed."