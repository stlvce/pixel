FROM nginx:alpine

COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 4173
ENTRYPOINT ["nginx", "-g", "daemon off;"]