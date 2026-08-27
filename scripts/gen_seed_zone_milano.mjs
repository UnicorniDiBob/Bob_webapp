import { readFileSync } from "fs";
const src = readFileSync("src/lib/zones.ts", "utf8");
const re = /\{\s*slug:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*lat:\s*([-\d.]+|null),\s*lng:\s*([-\d.]+|null)\s*\}/g;
const rows = [];
let m;
while ((m = re.exec(src)) !== null) rows.push(m.slice(1));
if (rows.length === 0) { console.error("nessuna zona trovata"); process.exit(1); }
const vals = rows.map(([slug, label, lat, lng]) =>
  `  ('${slug}', ${JSON.stringify(label).replace(/^"|"$/g, "'").replace(/'/g, "'")}, ${lat}, ${lng})`
);
console.log(`-- ${rows.length} zone, generate da src/lib/zones.ts (dataset NIL del Comune di Milano, CC-BY).
insert into public.city_zones (city_id, slug, label, lat, lng, source)
select c.id, v.slug, v.label, v.lat, v.lng, 'NIL Comune di Milano (CC-BY)'
from public.cities c
cross join (values
${vals.join(",\n")}
) as v(slug, label, lat, lng)
where c.slug = 'milano'
on conflict (city_id, slug) do update
  set label = excluded.label,
      lat = excluded.lat,
      lng = excluded.lng,
      source = excluded.source,
      updated_at = now();`);
