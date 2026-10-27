FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/api/v1
ARG VITE_FRONTEND_BASE_URL=http://localhost:5173
ARG VITE_GIT_VERSION=dev
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_FRONTEND_BASE_URL=${VITE_FRONTEND_BASE_URL} \
    VITE_GIT_VERSION=${VITE_GIT_VERSION}
RUN npm run build

FROM nginx:stable-alpine
ENV PORT=8080 \
    BACKEND_TARGET=http://api:5002 \
    NGINX_ENVSUBST_FILTER="^(PORT|BACKEND_TARGET)$"
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
