FROM node:20-alpine AS build

ARG BUILD_ID=local
ARG DEBUG_UI=false
ENV VITE_BUILD_ID=$BUILD_ID
ENV VITE_DEBUG_UI=$DEBUG_UI

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
COPY shared/ /app/shared/
RUN npm run build:prod

FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/runtime-env.sh /docker-entrypoint.d/40-runtime-env.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-env.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
