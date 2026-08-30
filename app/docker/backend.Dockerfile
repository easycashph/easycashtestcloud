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
# ttf-liberation/font-noto: the base alpine image ships zero fonts, so LibreOffice has nothing to
# substitute Word's Arial/Times New Roman/Calibri/Segoe UI with — every generated PDF rendered as
# blank tofu boxes until this was added (2026-07-14, found via visual PDF review, not caught by
# text-extraction-only testing since the underlying text layer survives even with missing glyphs).
# postgresql16-client: pg_dump binary for the MIS "Export Database" feature (2026-08-24 user
# request) - matches the postgres:16-alpine image this stack's own Postgres container runs, so the
# dump format is always compatible with what pg_restore expects for this database.
RUN apk add --no-cache openssl libreoffice ttf-liberation font-noto fontconfig postgresql16-client && fc-cache -f
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev
RUN npx prisma generate
COPY --from=build /app/dist ./dist
COPY templates ./templates
COPY build-info.json ./build-info.json
RUN mkdir -p /app/storage
EXPOSE 4000
CMD ["node", "dist/server.js"]
