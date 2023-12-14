#!/bin/bash
cd ${SERVER_PATH}
cd server
nvm use 18.17.0
npm run stop-dev
git fetch
git pull
npm install
npm run start-dev
