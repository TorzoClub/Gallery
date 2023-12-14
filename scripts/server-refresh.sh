#!/bin/bash
cd ${SERVER_PATH}
nvm use 18.17.0
npm run stop-dev
git fetch
git pull
cd server
npm install
npm run start-dev
