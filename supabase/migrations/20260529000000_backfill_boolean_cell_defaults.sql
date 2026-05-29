-- Boolean cells display as false in the UI when unset, but were not persisted.
-- Backfill missing rows so global cell search (search_library_cell_values) can find them.

insert into public.library_asset_values (asset_id, field_id, value_json)
select la.id, lfd.id, 'false'::jsonb
from public.library_assets la
join public.library_field_definitions lfd
  on lfd.library_id = la.library_id
  and lfd.data_type = 'boolean'
left join public.library_asset_values lav
  on lav.asset_id = la.id
  and lav.field_id = lfd.id
where lav.asset_id is null
on conflict (asset_id, field_id) do nothing;
