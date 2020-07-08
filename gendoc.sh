#!/usr/bin/env bash
set -euo pipefail
IFS=$'\t\n'

git clone -b gh-pages "https://github.com/${TRAVIS_REPO_SLUG}.git" gh-pages


DOCS_DIR=gh-pages/$TRAVIS_BRANCH
rm -rf "$DOCS_DIR"
mkdir -p "$DOCS_DIR"

# "Build" the documentation
npm run jsdoc

cp -a "docs/." "$DOCS_DIR/docs/"

echo "Documentation successfully built"
if [[ -n $TRAVIS_PULL_REQUEST_BRANCH ]]; then
    # We are building a pull request, nothing to do here
    echo "Building a PR with ID=$TRAVIS_PULL_REQUEST, skipping the deployment."
    exit 0
fi

cd "$DOCS_DIR"

git config push.default simple
git config user.name "Travis CI"
git config user.email "travis@travis-ci.org"

git add --all
git commit -m "Deploy code docs to GitHub Pages Travis build: $TRAVIS_BUILD_NUMBER" -m "Commit: $TRAVIS_COMMIT"
git push --force "https://${GH_TOKEN}@github.com/${TRAVIS_REPO_SLUG}.git"

echo "Documentation successfully published"
