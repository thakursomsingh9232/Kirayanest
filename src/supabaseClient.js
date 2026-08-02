import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hakymnbofdjoqbaebvox.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhha3ltbmJvZmRqb3FiYWVidm94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2OTQzNjgsImV4cCI6MjEwMTI3MDM2OH0.HSugyYNLwr0TFw6qpU7ix9qq3dvP3J6LIklwAlU-B5E";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
