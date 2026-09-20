# Connect ShopShield to Supabase

## 1. Run the migration

In your Supabase project, open SQL Editor, create a query, paste the entire contents of `supabase/migrations/20260920000100_shop_state.sql`, and run it once on a new database.

This is the complete migration for this integration: table, owner-only row-level security, validation, and atomic save function.

Alternatively, with the Supabase CLI installed:

```sh
supabase init
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## 2. Add your connection values

Copy `.env.example` to `.env.local` and replace both values:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Find these in your Supabase Connect dialog. Vite explicitly exposes only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from the unprefixed environment variables to the browser. Use a publishable key here, never a service-role or secret key. Environment files are ignored by Git. In hosting, set the same build-time variables and rebuild.

## 3. Create an account and start

Supabase dashboard → Authentication → Users → Add user: create an email/password user with a confirmed email. Restart the app with `pnpm dev` (or `npm run dev`) and sign in.

Each Supabase account owns a separate shop with owner/Partner access. Shared shops, employee invitations, and Staff/Tech cloud permissions are not implemented. Another Supabase account gets a different shop. Local PIN, barcode, and TOTP accounts work only in offline mode, when both Supabase variables are absent.

## 4. Import existing data

At first cloud sign-in, choose **Import this browser’s data** from the same browser and app address that held your local records. Import is only allowed into an empty cloud shop. Local records remain intact. PIN accounts, passwords, TOTP secrets, signing keys, and visual editor overrides are not uploaded.

**Start fresh** uses the app’s existing default inventory, not an empty inventory.

## Database schema

`public.shop_state` has one row per account:

| Column | Meaning |
| --- | --- |
| owner_id | Supabase Auth user ID, primary key |
| data | JSONB object of serialized business collections |
| version | Revision for rejecting concurrent overwrites |
| updated_at | Last successful save |

This is a document schema preserving the existing nested app models, not separate relational tables for each business entity. It covers inventory, ledger, day state, bills and line items, customers, services, workers and transactions, expenses, shopping, partner transactions, rentals, projects, activity logs, and settings. Values retain the existing serialized JSON format; day state is a plain string. It is intended for the current small-shop app rather than high-volume workloads.

Example SQL inspection:

```sql
select owner_id, (data->>'shopshield_bills')::jsonb as bills
from public.shop_state;
```

Anonymous access and direct client writes are denied. `save_shop_state` authenticates the caller, checks collection names and shapes, and atomically saves all collections only if their expected revision matches. Clients cannot choose another owner ID. Deleting a Supabase account deletes its shop data through a foreign-key cascade.

## Save behavior

Wait for **Saved to Supabase** before closing. Cloud mode requires a connection. Load errors do not fall back to local records. Save errors block editing and offer an export of unsaved changes. Export before reloading, as reloading discards unsaved changes. Backup recovery is manual.

A second device loads the latest records at sign-in or reload. Live updates into an already-open device are not implemented. Concurrent edits produce a conflict instead of silently overwriting another device. Export, reload, and reconcile manually.

## Verify after configuration

1. Add a customer, wait for Saved, then reload and verify it remains.
2. Open the same account in another browser and verify the record appears.
3. Sign into a different account and verify its data is separate.
4. Edit the same account in two tabs; the stale tab should show a conflict.
5. Disconnect the network and edit; the app should report unsaved changes.

References: [Supabase sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
