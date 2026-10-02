#!/bin/bash
# modul.fermi.uz (yangi) + malaka.fermi.uz (yo'nalishi yangi dasturga o'tkaziladi). Boshqa saytlarga tegmaydi.
set -e
sudo -v
AV=/etc/nginx/sites-available; EN=/etc/nginx/sites-enabled
STAMP=$(date +%F-%H%M)
sudo cp $AV/malaka.fermi.uz ~/malaka.fermi.uz.$STAMP.bak

sudo tee $AV/modul.fermi.uz >/dev/null <<'CONF'
server {
    listen 80;
    server_name modul.fermi.uz;
    client_max_body_size 200m;
    location / {
        proxy_pass http://127.0.0.1:9220;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}
CONF
[ -e $EN/modul.fermi.uz ] || sudo ln -s $AV/modul.fermi.uz $EN/modul.fermi.uz

# malaka: faqat proxy_pass porti 9060 -> 9221
sudo sed -i 's#proxy_pass http://127.0.0.1:9060;#proxy_pass http://127.0.0.1:9221;#' $AV/malaka.fermi.uz
sudo sed -i 's#client_max_body_size 100m;#client_max_body_size 200m;#' $AV/malaka.fermi.uz

if sudo nginx -t; then
  sudo systemctl reload nginx
  echo "nginx reload OK"
else
  echo "XATO: nginx -t o'tmadi, o'zgarishlar qaytarilmoqda"
  sudo cp ~/malaka.fermi.uz.$STAMP.bak $AV/malaka.fermi.uz
  sudo rm -f $EN/modul.fermi.uz
  sudo nginx -t && echo "qaytarildi"
  exit 1
fi
sudo certbot --nginx -d modul.fermi.uz
sudo nginx -t && sudo systemctl reload nginx
echo "TAYYOR"
