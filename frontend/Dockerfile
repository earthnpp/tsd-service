FROM node:20-alpine AS builder
ARG VITE_LIFF_ID
ENV VITE_LIFF_ID=$VITE_LIFF_ID
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN chmod +x node_modules/.bin/vite && npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
