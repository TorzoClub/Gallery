#!/bin/bash
cd ${SERVER_PATH}
cd server
nvm use 16.13.1
npm run stop-dev
git fetch
git pull
npm install
npm run start-dev
