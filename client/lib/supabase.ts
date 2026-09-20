import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.SUPABASE_URL?.trim();
const key = import.meta.env.SUPABASE_PUBLISHABLE_KEY?.trim();
export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured ? createClient(url!, key!) : null;

export const supabaseConfigError = Boolean(url) !== Boolean(key) ? 'Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local, then restart the app.' : '';
