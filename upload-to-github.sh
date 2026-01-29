#!/bin/bash
# Run this script to push the project to GitHub
# Repo: https://github.com/scsvmvcctv-jpg/cse-admin

set -e
cd "$(dirname "$0")"

echo "Initializing git..."
git init
git branch -M main

echo "Staging files..."
git add .

echo "Creating initial commit..."
git commit -m "Initial commit: CSE Admin (lecture plans, workload, assessments)"

echo "Adding remote..."
git remote add origin https://github.com/scsvmvcctv-jpg/cse-admin.git 2>/dev/null || git remote set-url origin https://github.com/scsvmvcctv-jpg/cse-admin.git

echo "Pushing to GitHub..."
git push -u origin main

echo "Done! Project is at https://github.com/scsvmvcctv-jpg/cse-admin"
