#!/bin/bash
# modul.fermi.uz: 192.168.0.101:443 ni ham tinglasin (boshqa saytlar kabi)
set -e
sudo -v
F=/etc/nginx/sites-available/modul.fermi.uz
sudo cp $F ~/modul.fermi.uz.443.bak
grep -q "192.168.0.101:443" $F || sudo sed -i 's#^\(\s*\)listen 443 ssl;\(.*\)$#\1listen 443 ssl;\2\n\1listen 192.168.0.101:443 ssl;#' $F
if sudo nginx -t; then sudo systemctl reload nginx && echo "TAYYOR"; else sudo cp ~/modul.fermi.uz.443.bak $F; echo "XATO, qaytarildi"; exit 1; fi
