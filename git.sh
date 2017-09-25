#!/bin/bash
echo "Updating all Git and Heroku things..."
git add .
git commit -m "Updating server.js"
git push origin master
git push heroku master
