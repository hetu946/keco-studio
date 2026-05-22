-- Resolve asset -> project_id without library_assets RLS (owners may lack collaborator rows).

CREATE OR REPLACE FUNCTION public.get_asset_project_id(p_asset_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT l.project_id
  FROM public.library_assets la
  JOIN public.libraries l ON l.id = la.library_id
  WHERE la.id = p_asset_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_asset_project_id(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_asset_project_id(UUID) IS
  'Returns project_id for an asset. SECURITY DEFINER so app auth checks work for project owners.';
