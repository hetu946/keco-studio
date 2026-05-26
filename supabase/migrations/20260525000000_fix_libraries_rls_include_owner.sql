-- Migration: Fix libraries, library_assets, and folders RLS to include project owners
-- Problem: RLS policies only check project_collaborators. Project owners who are not in
--          project_collaborators (e.g. pre-migration projects or removed collaborator rows)
--          cannot SELECT libraries, causing verifyLibraryAccess to throw "Library not found".
-- Solution: Add is_project_owner() OR is_accepted_collaborator() (same pattern as
--           20260204000000_fix_library_asset_values_rls_include_owner.sql).

-- ============================================================================
-- Libraries
-- ============================================================================

DROP POLICY IF EXISTS "libraries_select_policy" ON public.libraries;
DROP POLICY IF EXISTS "libraries_insert_policy" ON public.libraries;
DROP POLICY IF EXISTS "libraries_update_policy" ON public.libraries;
DROP POLICY IF EXISTS "libraries_delete_policy" ON public.libraries;

CREATE POLICY "libraries_select_policy"
  ON public.libraries FOR SELECT
  USING (
    public.is_project_owner(project_id, auth.uid())
    OR public.is_accepted_collaborator(project_id, auth.uid())
  );

CREATE POLICY "libraries_insert_policy"
  ON public.libraries FOR INSERT
  WITH CHECK (
    public.is_project_owner(project_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_id
        AND pc.user_id = auth.uid()
        AND pc.role IN ('admin', 'editor')
        AND pc.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "libraries_update_policy"
  ON public.libraries FOR UPDATE
  USING (
    public.is_project_owner(project_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_id
        AND pc.user_id = auth.uid()
        AND pc.role IN ('admin', 'editor')
        AND pc.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "libraries_delete_policy"
  ON public.libraries FOR DELETE
  USING (
    public.is_project_owner(project_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_id
        AND pc.user_id = auth.uid()
        AND pc.role IN ('admin', 'editor')
        AND pc.accepted_at IS NOT NULL
    )
  );

COMMENT ON POLICY "libraries_select_policy" ON public.libraries IS
  'Allow project owners and accepted collaborators to view libraries';
COMMENT ON POLICY "libraries_insert_policy" ON public.libraries IS
  'Allow project owners and admin/editor collaborators to create libraries';
COMMENT ON POLICY "libraries_update_policy" ON public.libraries IS
  'Allow project owners and admin/editor collaborators to update libraries';
COMMENT ON POLICY "libraries_delete_policy" ON public.libraries IS
  'Allow project owners and admin/editor collaborators to delete libraries';

-- ============================================================================
-- Library assets
-- ============================================================================

DROP POLICY IF EXISTS "library_assets_select_policy" ON public.library_assets;
DROP POLICY IF EXISTS "library_assets_insert_policy" ON public.library_assets;
DROP POLICY IF EXISTS "library_assets_update_policy" ON public.library_assets;
DROP POLICY IF EXISTS "library_assets_delete_policy" ON public.library_assets;

CREATE POLICY "library_assets_select_policy"
  ON public.library_assets FOR SELECT
  USING (
    library_id IN (
      SELECT l.id
      FROM public.libraries l
      WHERE public.is_project_owner(l.project_id, auth.uid())
         OR public.is_accepted_collaborator(l.project_id, auth.uid())
    )
  );

CREATE POLICY "library_assets_insert_policy"
  ON public.library_assets FOR INSERT
  WITH CHECK (
    library_id IN (
      SELECT l.id
      FROM public.libraries l
      WHERE public.is_project_owner(l.project_id, auth.uid())
         OR EXISTS (
           SELECT 1 FROM public.project_collaborators pc
           WHERE pc.project_id = l.project_id
             AND pc.user_id = auth.uid()
             AND pc.role IN ('admin', 'editor')
             AND pc.accepted_at IS NOT NULL
         )
    )
  );

CREATE POLICY "library_assets_update_policy"
  ON public.library_assets FOR UPDATE
  USING (
    library_id IN (
      SELECT l.id
      FROM public.libraries l
      WHERE public.is_project_owner(l.project_id, auth.uid())
         OR EXISTS (
           SELECT 1 FROM public.project_collaborators pc
           WHERE pc.project_id = l.project_id
             AND pc.user_id = auth.uid()
             AND pc.role IN ('admin', 'editor')
             AND pc.accepted_at IS NOT NULL
         )
    )
  );

CREATE POLICY "library_assets_delete_policy"
  ON public.library_assets FOR DELETE
  USING (
    library_id IN (
      SELECT l.id
      FROM public.libraries l
      WHERE public.is_project_owner(l.project_id, auth.uid())
         OR EXISTS (
           SELECT 1 FROM public.project_collaborators pc
           WHERE pc.project_id = l.project_id
             AND pc.user_id = auth.uid()
             AND pc.role IN ('admin', 'editor')
             AND pc.accepted_at IS NOT NULL
         )
    )
  );

COMMENT ON POLICY "library_assets_select_policy" ON public.library_assets IS
  'Allow project owners and accepted collaborators to read library assets';
COMMENT ON POLICY "library_assets_insert_policy" ON public.library_assets IS
  'Allow project owners and admin/editor collaborators to insert library assets';
COMMENT ON POLICY "library_assets_update_policy" ON public.library_assets IS
  'Allow project owners and admin/editor collaborators to update library assets';
COMMENT ON POLICY "library_assets_delete_policy" ON public.library_assets IS
  'Allow project owners and admin/editor collaborators to delete library assets';

-- ============================================================================
-- Folders
-- ============================================================================

DROP POLICY IF EXISTS "folders_select_policy" ON public.folders;
DROP POLICY IF EXISTS "folders_insert_policy" ON public.folders;
DROP POLICY IF EXISTS "folders_update_policy" ON public.folders;
DROP POLICY IF EXISTS "folders_delete_policy" ON public.folders;

CREATE POLICY "folders_select_policy"
  ON public.folders FOR SELECT
  USING (
    public.is_project_owner(project_id, auth.uid())
    OR public.is_accepted_collaborator(project_id, auth.uid())
  );

CREATE POLICY "folders_insert_policy"
  ON public.folders FOR INSERT
  WITH CHECK (
    public.is_project_owner(project_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_id
        AND pc.user_id = auth.uid()
        AND pc.role IN ('admin', 'editor')
        AND pc.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "folders_update_policy"
  ON public.folders FOR UPDATE
  USING (
    public.is_project_owner(project_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_id
        AND pc.user_id = auth.uid()
        AND pc.role IN ('admin', 'editor')
        AND pc.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "folders_delete_policy"
  ON public.folders FOR DELETE
  USING (
    public.is_project_owner(project_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_id
        AND pc.user_id = auth.uid()
        AND pc.role IN ('admin', 'editor')
        AND pc.accepted_at IS NOT NULL
    )
  );

COMMENT ON POLICY "folders_select_policy" ON public.folders IS
  'Allow project owners and accepted collaborators to view folders';
COMMENT ON POLICY "folders_insert_policy" ON public.folders IS
  'Allow project owners and admin/editor collaborators to create folders';
COMMENT ON POLICY "folders_update_policy" ON public.folders IS
  'Allow project owners and admin/editor collaborators to update folders';
COMMENT ON POLICY "folders_delete_policy" ON public.folders IS
  'Allow project owners and admin/editor collaborators to delete folders';
