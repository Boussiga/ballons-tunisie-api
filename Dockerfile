# Stage 1: install the dependencies and generate the Prisma client
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

# Stage 2: final image (production dependencies + code only)
FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
# Create / update the tables, then start the API
CMD npx prisma db push --skip-generate && node app.js
