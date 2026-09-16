// --- CONSTANTES Y CONFIGURACIÓN DE CITAS ---
const staffMembers = [
    { id: 'stf-1', name: 'Valeria Gómez (Nail Art & Polygel)', branch: 'San Félix' },
    { id: 'stf-2', name: 'Camila Rivas (Manicura Rusa)', branch: 'CC Alta Vista I' },
    { id: 'stf-3', name: 'Daniela Torres (Pedicura Spa & Gel)', branch: 'CC Alta Vista II' }
];

const manicureServices = [
    { id: 'srv-1', name: 'Manicura Rusa + Gelificación', price: 25.00, duration: '2 horas' },
    { id: 'srv-2', name: 'Sistema de Uñas Polygel', price: 35.00, duration: '2 horas' },
    { id: 'srv-3', name: 'Pedicura Spa + Semipermanente', price: 20.00, duration: '1 hora 40 minutos' },
    { id: 'srv-4', name: 'Mantenimiento / Retiro', price: 15.00, duration: '1 hora' }
];

window.appointments = window.appointments || [];
let cachedSupabaseClient = null;

// OBTENER CLIENTE SUPABASE DE FORMA SEGURA
function getSupabaseClient() {
    if (cachedSupabaseClient) return cachedSupabaseClient;

    const s = window.supabase;
    if (!s) return null;

    if (typeof s.createClient === 'function' && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        cachedSupabaseClient = s.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        return cachedSupabaseClient;
    }

    const client = s.default && typeof s.default.from === 'function' ? s.default : s;
    if (client && typeof client.from === 'function') {
        cachedSupabaseClient = client;
        return cachedSupabaseClient;
    }

    return null;
}

// --- PROCESAR LA RESERVA DESDE EL FORMULARIO WEB ---
window.handleCreateAppointment = async (e) => {
    e.preventDefault();

    const clientName = document.getElementById('appClientName')?.value.trim();
    const clientPhone = document.getElementById('appClientPhone')?.value.trim();
    const branch = document.getElementById('appBranchSelect')?.value;
    const serviceSelectElement = document.getElementById('appServiceSelect');
    const serviceId = serviceSelectElement?.value;
    const staffId = document.getElementById('appStaffSelect')?.value;
    const date = document.getElementById('appDate')?.value;
    const time = document.getElementById('appTimeSelect')?.value;

    if (!clientName || !clientPhone || !date || !time) {
        alert("Por favor completa todos los campos requeridos.");
        return;
    }

    let service = manicureServices.find(s => s.id === serviceId || s.name === serviceId);
    if (!service && serviceSelectElement) {
        const selectedText = serviceSelectElement.options[serviceSelectElement.selectedIndex].text;
        service = {
            id: serviceId,
            name: selectedText.split('(')[0].trim() || serviceId,
            price: 25.00
        };
    }

    const staff = staffMembers.find(s => s.id === staffId);
    const appointmentId = 'AVO-CIT-' + Math.floor(100000 + Math.random() * 900000);
    const currentBcv = window.bcvRate || 36.50;
    const totalBs = (service.price * currentBcv).toFixed(2);
    const staffNameFinal = staff ? staff.name : 'Asignación Automática';

    try {
        const client = getSupabaseClient();
        if (client) {
            const { error: dbError } = await client.from('appointments').insert([{
                codigo: appointmentId,
                cliente: clientName,
                telefono: clientPhone,
                servicio: service.name,
                sucursal_especialista: `${branch} (${staffNameFinal})`,
                fecha_hora: `${date} - ${time}`,
                estado: 'Pendiente'
            }]);
            if (dbError) console.error('Aviso de Supabase al insertar:', dbError.message);
        }
    } catch (err) {
        console.error('Excepción al conectar con Supabase:', err);
    }

    await loadAppointmentsFromSupabase();

    let msg = `✨ *SOLICITUD DE CITA - AVOCADO SPA* ✨\n\n`;
    msg += `🆔 *Cita:* #${appointmentId}\n`;
    msg += `👤 *Cliente:* ${clientName}\n`;
    msg += `💅 *Servicio:* ${service.name}\n`;
    msg += `🏢 *Sucursal:* ${branch}\n`;
    msg += `👩‍🎨 *Especialista:* ${staffNameFinal}\n`;
    msg += `📅 *Fecha:* ${date}\n`;
    msg += `⏰ *Hora:* ${time}\n`;
    msg += `💰 *Total:* $${service.price.toFixed(2)} (Bs. ${totalBs})\n\n`;
    msg += `_Quedo a la espera de la confirmación de la cita._`;

    window.open(`https://wa.me/584143943252?text=${encodeURIComponent(msg)}`, '_blank');

    const formEl = document.getElementById('appointmentForm');
    if (formEl) formEl.reset();
    alert(`✅ Tu solicitud de cita #${appointmentId} ha sido enviada con éxito.`);
};

// --- CARGAR Y RENDERIZAR CITAS DESDE SUPABASE ---
async function loadAppointmentsFromSupabase() {
    const client = getSupabaseClient();
    
    if (!client) {
        setTimeout(loadAppointmentsFromSupabase, 800);
        return;
    }
    
    const { data, error } = await client
        .from('appointments')
        .select('*');

    if (error) {
        console.error('Error al cargar citas de Supabase:', error.message);
        return;
    }

    if (data && data.length > 0) {
        window.appointments = data.map(item => ({
            id: item.id,
            appointmentId: item.codigo || item.code || 'N/A',
            clientName: item.cliente || item.client_name || 'Sin nombre',
            clientPhone: item.telefono || item.client_phone || '',
            serviceName: item.servicio || 'Servicio General',
            staffName: item.sucursal_especialista || 'Asignación Automática',
            dateTime: item.fecha_hora || 'Por definir',
            status: item.estado || 'Pendiente'
        }));
    } else {
        window.appointments = [];
    }
    
    renderAppointmentsTableSafe();
    renderAppointmentsScreen();
}

// CAMBIAR ESTADO DE CITA
window.updateAppointmentStatus = async (appointmentId, newStatus) => {
    const client = getSupabaseClient();
    const app = window.appointments.find(a => a.appointmentId === appointmentId || a.id == appointmentId);
    
    if (client && app) {
        const queryField = app.id ? 'id' : 'codigo';
        const queryValue = app.id || app.appointmentId;

        const { error } = await client
            .from('appointments')
            .update({ estado: newStatus })
            .eq(queryField, queryValue);

        if (error) {
            console.error('Error al actualizar estado:', error.message);
            alert('No se pudo actualizar el estado en la base de datos.');
            return;
        }
    }
    await loadAppointmentsFromSupabase();
};

// ELIMINAR CITA
window.deleteAppointment = async (appointmentId) => {
    if (!confirm(`¿Estás seguro de eliminar la cita #${appointmentId}?`)) return;

    const client = getSupabaseClient();
    const app = window.appointments.find(a => a.appointmentId === appointmentId || a.id == appointmentId);

    if (client && app) {
        const queryField = app.id ? 'id' : 'codigo';
        const queryValue = app.id || app.appointmentId;

        const { error } = await client
            .from('appointments')
            .delete()
            .eq(queryField, queryValue);

        if (error) {
            console.error('Error al eliminar cita:', error.message);
            alert('No se pudo eliminar la cita de la base de datos.');
            return;
        }
    }
    await loadAppointmentsFromSupabase();
};

// RENDERIZAR TABLA ADMIN PRINCIPAL
function renderAppointmentsTableSafe() {
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;

    if (!window.appointments || window.appointments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-slate-400 text-xs">No hay citas registradas en la base de datos.</td></tr>`;
        return;
    }

    tbody.innerHTML = window.appointments.map(app => `
        <tr class="border-b text-xs text-slate-700 hover:bg-slate-50 transition">
            <td class="p-2.5 font-bold font-mono">${app.appointmentId}</td>
            <td class="p-2.5"><strong>${app.clientName}</strong><br><span class="text-[11px] text-slate-400">${app.clientPhone}</span></td>
            <td class="p-2.5">${app.serviceName}</td>
            <td class="p-2.5">${app.staffName}</td>
            <td class="p-2.5">${app.dateTime}</td>
            <td class="p-2.5">
                <select onchange="updateAppointmentStatus('${app.appointmentId}', this.value)" class="text-xs font-bold rounded-lg p-1 outline-none border cursor-pointer ${
                    app.status === 'Verificado' || app.status === 'Confirmada' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                    app.status === 'En Verificación' || app.status === 'Pendiente' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                    'bg-red-100 text-red-800 border-red-300'
                }">
                    <option value="Pendiente" ${app.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="En Verificación" ${app.status === 'En Verificación' ? 'selected' : ''}>En Verificación</option>
                    <option value="Verificado" ${app.status === 'Verificado' ? 'selected' : ''}>Verificado</option>
                    <option value="Cancelado" ${app.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
            </td>
            <td class="p-2.5 text-center">
                <button onclick="deleteAppointment('${app.appointmentId}')" title="Eliminar Cita" class="bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded-md text-xs font-bold transition">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// --- PANTALLA COMPLETA DE CITAS ---
window.displayAppointmentsScreen = () => {
    const modal = document.getElementById('appointmentsScreenModal');
    if (modal) {
        modal.classList.remove('hidden');
        renderAppointmentsScreen();
    }
};

window.closeAppointmentsScreen = () => {
    const modal = document.getElementById('appointmentsScreenModal');
    if (modal) modal.classList.add('hidden');
};

window.renderAppointmentsScreen = () => {
    const tbody = document.getElementById('appointmentsScreenTableBody');
    if (!tbody) return;

    const query = (document.getElementById('appScreenSearch')?.value || '').toLowerCase();
    const branchFilter = document.getElementById('appScreenBranchFilter')?.value || 'ALL';

    const filtered = (window.appointments || []).filter(a => {
        const matchesQuery = a.clientName.toLowerCase().includes(query) ||
                             a.appointmentId.toLowerCase().includes(query) ||
                             a.clientPhone.toLowerCase().includes(query);
        const matchesBranch = branchFilter === 'ALL' || a.staffName.includes(branchFilter);
        return matchesQuery && matchesBranch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-slate-400 text-xs">No se encontraron citas coincidentes.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(app => `
        <tr class="border-b text-xs text-slate-700 hover:bg-slate-50 transition">
            <td class="p-3 font-bold font-mono text-slate-900">${app.appointmentId}</td>
            <td class="p-3"><strong>${app.clientName}</strong><br><span class="text-[11px] text-slate-400">${app.clientPhone}</span></td>
            <td class="p-3">${app.serviceName}</td>
            <td class="p-3">${app.staffName}</td>
            <td class="p-3">${app.dateTime}</td>
            <td class="p-3">
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    app.status === 'Verificado' || app.status === 'Confirmada' ? 'bg-emerald-100 text-emerald-800' :
                    app.status === 'En Verificación' || app.status === 'Pendiente' ? 'bg-amber-100 text-amber-800' :
                    'bg-red-100 text-red-800'
                }">${app.status}</span>
            </td>
            <td class="p-3 text-center">
                <button onclick="deleteAppointment('${app.appointmentId}')" class="bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded-md text-xs font-bold transition">🗑️</button>
            </td>
        </tr>
    `).join('');
};

// INICIALIZACIÓN
window.addEventListener('DOMContentLoaded', loadAppointmentsFromSupabase);
window.addEventListener('load', loadAppointmentsFromSupabase);
