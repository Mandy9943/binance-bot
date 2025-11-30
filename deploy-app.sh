#!/bin/bash

# Pull the latest changes (if you are running this from a git repo on the VPS)
# git pull origin main

# Build and start the container
docker compose up -d --build

# Show logs
docker compose logs -f
