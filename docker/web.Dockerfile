FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/catalog/package.json packages/catalog/
COPY packages/commerce/package.json packages/commerce/
COPY packages/ai-engine/package.json packages/ai-engine/
COPY packages/product-registry/package.json packages/product-registry/
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app /app
USER app
EXPOSE 3100
CMD ["npm", "run", "start"]
