#!/bin/bash
# Kamera bazasi: xodimlarda yuz qaysi ustunda bor — FAQAT SONLAR.
docker exec -i camera-api-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F " | "' <<'SQL'
select 'xodim jami', count(*) from students_staff where type='xodim';
select 'faol xodim', count(*) from students_staff where type='xodim' and active;
select 'embedding bor', count(*) from students_staff where type='xodim' and biometric_embedding is not null;
select 'biometric_photo_key bor', count(*) from students_staff where type='xodim' and biometric_photo_key is not null;
select 'hemis_photo_url bor', count(*) from students_staff where type='xodim' and hemis_photo_url is not null;
select 'pinfl bor', count(*) from students_staff where type='xodim' and coalesce(pinfl,'')<>'';
select 'hemis_id bor', count(*) from students_staff where type='xodim' and hemis_id is not null;
select 'holat: ' || coalesce(biometrics_status,'-') || ' / sabab=' || coalesce(biometrics_review_reason,'-'), count(*) from students_staff where type='xodim' group by 1 order by 2 desc limit 8;
select 'type: ' || coalesce(type,'-'), count(*) from students_staff group by 1;
select 'jadval: ' || table_name from information_schema.tables where table_schema='public' and (table_name ilike '%face%' or table_name ilike '%person%' or table_name ilike '%embed%' or table_name ilike '%gallery%');
SQL
