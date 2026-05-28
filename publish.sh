#!/bin/bash
docker buildx build --platform linux/amd64 -t ismasans/fandock:latest --push .
echo "✅ Image published to Docker Hub"