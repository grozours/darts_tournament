FROM node:20-alpine AS build

ARG BUILD_ID=local
ENV VITE_BUILD_ID=$BUILD_ID

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
COPY shared/ /app/shared/
RUN npm run build:prod

FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
