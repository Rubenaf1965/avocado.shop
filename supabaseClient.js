// --- CONFIGURACIÓN E INICIALIZACIÓN DE SUPABASE ---
// Reemplaza 'TU_URL_DE_SUPABASE' y 'TU_ANON_KEY_DE_SUPABASE' con las credenciales de tu proyecto en Supabase
const SUPABASE_URL = 'https://xgihkdybvbhzezotinrh.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnaWhrZHlidmJoemV6b3RpbnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNDI0NzcsImV4cCI6MjEwNDgxODQ3N30.DWNNsyDwuYll0245J1FVmlBCI2qMxXuO80tLJxTszMQ';

// Exponer globalmente para que appointments.js, el inventario y las ventas puedan usarlas
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// Inicializar el cliente global de Supabase si la librería del CDN está cargada
if (window.supabase && typeof window.supabase.createClient === 'function') {
    // Si ya existe una instancia previa, la reutilizamos, si no, la creamos
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // Asignamos también a window.supabase para mantener compatibilidad total
    window.supabase = window.supabaseClient;
}