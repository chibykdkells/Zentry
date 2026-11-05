-- Recovered 2026-11-05 from the production database (Neon), where this
-- migration was applied on 2026-05-22 but never committed to the repo.
-- The function and trigger below are copied from pg_get_functiondef /
-- pg_get_triggerdef. Written to be safe to re-run.
--
-- Once a CBT center has claimed an order, block reassigning it to a different
-- CBT center by a concurrent claim (unique_violation, 23505). Unassigning
-- (setting assignedCbtId to NULL) is still allowed, e.g. by the deadline job.

CREATE OR REPLACE FUNCTION public.prevent_order_reassignment()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
    BEGIN
      IF OLD."assignedCbtId" IS NOT NULL
         AND NEW."assignedCbtId" IS NOT NULL
         AND NEW."assignedCbtId" <> OLD."assignedCbtId"
      THEN
        RAISE EXCEPTION
          'Order % is already assigned to CBT center % — reassignment blocked',
          OLD.id, OLD."assignedCbtId"
        USING ERRCODE = '23505';
      END IF;
      RETURN NEW;
    END;
    $function$;

DROP TRIGGER IF EXISTS order_prevent_reassignment ON public."Order";
CREATE TRIGGER order_prevent_reassignment BEFORE UPDATE ON public."Order" FOR EACH ROW EXECUTE FUNCTION prevent_order_reassignment();
