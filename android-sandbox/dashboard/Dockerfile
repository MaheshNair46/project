FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Use nginx to serve the built application
RUN apk add --no-cache nginx

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]