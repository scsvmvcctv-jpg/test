#!/bin/bash
# Push this project to https://github.com/scsvmvcctv-jpg/test

set -e
cd "$(dirname "$0")"

echo "Adding remote..."
git remote add origin https://github.com/scsvmvcctv-jpg/test.git 2>/dev/null || git remote set-url origin https://github.com/scsvmvcctv-jpg/test.git

echo "Staging any changes..."
git add -A
git diff --staged --quiet || git commit -m "Update: CSE Admin (lecture plans, workload, assessments)"

echo "Pushing to GitHub (you may be prompted to sign in)..."
echo "Note: test repo has existing content. Using --force to replace with this project."
git push -u origin main --force

echo "Done! Project is at https://github.com/scsvmvcctv-jpg/test"
