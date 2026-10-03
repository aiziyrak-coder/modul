#!/bin/bash
# modul.fermi.uz: 192.168.0.101:80 ni ham tinglasin (boshqa saytlar kabi), keyin SSL
set -e
sudo -v
F=/etc/nginx/sites-available/modul.fermi.uz
sudo cp $F ~/modul.fermi.uz.bak
grep -q "192.168.0.101:80" $F || sudo sed -i 's#^    listen 80;#    listen 80;\n    listen 192.168.0.101:80;#' $F
if sudo nginx -t; then sudo systemctl reload nginx; else sudo cp ~/modul.fermi.uz.bak $F; echo "XATO, qaytarildi"; exit 1; fi
sudo certbot --nginx -d modul.fermi.uz
sudo nginx -t && sudo systemctl reload nginx
echo TAYYOR
