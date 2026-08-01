-- 039: una partita IVA verificata appartiene a un solo profilo.
--
-- Perché serve a livello di database e non basta il controllo nella route:
-- il controllo applicativo perde la corsa se due richieste arrivano insieme, e
-- soprattutto non copre le concessioni fatte a mano dall'admin. Qui il vincolo
-- è strutturale: due profili non possono avere lo stesso numero *verificato*.
--
-- Perché parziale (solo level <> 'none'): due professionisti possono avere una
-- richiesta in corso sullo stesso numero — capita col commercialista che
-- registra due profili, o con un errore di battitura — e quel caso deve poter
-- arrivare davanti a una persona, non essere respinto dal database. Il vincolo
-- scatta al momento della concessione, che è quando conta.
--
-- Idempotente.

-- Se in produzione esistesse già un duplicato verificato, l'indice unico
-- fallirebbe: prima lo cerchiamo e lo segnaliamo in modo esplicito.
do $$
declare
  duplicati int;
begin
  select count(*) into duplicati from (
    select vat_number
      from public.professional_verification
     where vat_number is not null and level <> 'none'
     group by vat_number
    having count(*) > 1
  ) d;
  if duplicati > 0 then
    raise exception 'Ci sono % partite IVA verificate su piu profili: vanno risolte a mano prima di applicare il vincolo', duplicati;
  end if;
end;
$$;

create unique index if not exists professional_verification_vat_verified_unique
  on public.professional_verification (vat_number)
  where vat_number is not null and level <> 'none';
