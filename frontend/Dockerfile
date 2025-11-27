FROM node:22

WORKDIR /app

# Install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy all frontend code
COPY frontend/ .

# Start in development mode (hot reload)
CMD ["npm", "start"]
