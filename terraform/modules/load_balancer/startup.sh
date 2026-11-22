#!/bin/bash
set -e

apt-get update
apt-get install -y nginx

cat > /etc/nginx/sites-available/default <<CONF
server {
    listen 80 default_server;
    client_max_body_size 100m;

    location / {
        proxy_pass http://${app_ip};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
CONF

systemctl enable nginx
systemctl restart nginx
