# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
# libreoffice: headless docx->pdf conversion for loan document generation (ADR-051 §4) — free,
# self-hosted, no external service. Large package (~600MB), accepted as the standard low-cost
# approach per CLAUDE.md's deployment philosophy rather than a paid conversion API.
RUN apk add --no-cache openssl libreoffice
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev
RUN npx prisma generate
COPY --from=build /app/dist ./dist
COPY templates ./templates
RUN mkdir -p /app/storage
EXPOSE 4000
CMD ["node", "dist/server.js"]
