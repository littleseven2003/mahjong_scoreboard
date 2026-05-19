FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.d/10-check-static-files.sh /docker-entrypoint.d/10-check-static-files.sh
COPY --from=build /app/dist /usr/share/nginx/html
RUN chmod +x /docker-entrypoint.d/10-check-static-files.sh \
  && find /usr/share/nginx/html -type d -exec chmod 755 {} \; \
  && find /usr/share/nginx/html -type f -exec chmod 644 {} \;

EXPOSE 80
