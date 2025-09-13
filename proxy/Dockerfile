FROM nginx:alpine

COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
ENTRYPOINT ["nginx", "-g", "daemon off;"]