#!/usr/bin/env bash

node build.js
mkdir dist/dist -p
rsync -avzP node_modules/leveldown/prebuilds dist/leveldown
cp node_modules/rabin-wasm/dist/rabin.wasm dist/dist/rabin.wasm
