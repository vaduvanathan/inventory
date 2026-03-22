import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jqkjtvjslfzmyjoyocmj.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impxa2p0dmpzbGZ6bXlqb3lvY21qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjY0MjQsImV4cCI6MjA4OTc0MjQyNH0.kQYLg7vSzmGInZMWhZK6UU7YCsJ64H4NYaQ0Sc8X054";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);