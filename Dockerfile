# Step 1: Use an official and lightweight Node.js base image
FROM node:18-alpine

# Step 2: Create and set the working directory inside the container
WORKDIR /usr/src/app

# Step 3: Copy package.json (and package-lock.json, if it exists) to the working directory
# This optimizes the Docker cache. The re-installation will only occur if these dependencies change.
COPY package*.json ./

# Step 4: Install the application dependencies
RUN npm install

# Step 5: Copy the rest of the application's source code to the working directory
COPY . .

# Step 6: Define the command that will be executed when the container starts
CMD [ "node", "main.js" ]
