// --- CONSTANTES Y CONFIGURACIÓN DE CITAS ---
const staffMembers = [
    { id: 'staff-1', name: 'Especialista San Félix', branch: 'san felix' },
    { id: 'staff-2', name: 'Especialista Alta Vista', branch: 'cc alta vista i' }
];

const manicureServices = [
    { id: 'manicure', name: 'Manicure', price: 20.00, duration: '2 horas' },
    { id: 'pedicure', name: 'Pedicure', price: 18.00, duration: '1 hora 40 minutos' },
    { id: 'Manicura Rusa + Gelificación', name: 'Manicura Rusa + Gelificación', price: 25.00, duration: '2 horas' }
];

// Arreglo global de citas
window.appointments = window.appointments || [];

// Función auxiliar segura para obtener el cliente de Supabase (Corregida y Blindada)
function getSupabaseClient() {
    const s = window.supabaseClient || window.supabase || window._supabase;
    if (!s) return null;
    
    // Si viene envuelto en una propiedad default (típico de algunos imports de ES Modules)
    const client = s.default && typeof s.default.from === 'function' ? s.default : s;
    
    if (client && typeof client.from === 'function') {
        return client;
    }
    return null;
}

// --- PROCESAR LA RESERVA DESDE EL FORMULARIO WEB ---
window.handleCreateAppointment = async (e) => {
    e.preventDefault();

    const clientName = document.getElementById('appClientName').value.trim();
    const clientPhone = document.getElementById('appClientPhone').value.trim();
    const branch = document.getElementById('appBranchSelect').value;
    const serviceSelectElement = document.getElementById('appServiceSelect');
    const serviceId = serviceSelectElement.value;
    const staffId = document.getElementById('appStaffSelect').value;
    const date = document.getElementById('appDate').value;
    const time = document.getElementById('appTimeSelect').value;

    if (!clientName || !clientPhone || !date || !time) {
        alert("Por favor completa todos los campos requeridos.");
        return;
    }

    // Búsqueda flexible del servicio
    let service = manicureServices.find(s => s.id === serviceId || s.name === serviceId);
    if (!service) {
        const selectedText = serviceSelectElement.options[serviceSelectElement.selectedIndex].text;
        service = {
            id: serviceId,
            name: selectedText.split('(')[0].trim() || serviceId,
            price: 25.00
        };
    }

    const staff = staffMembers.find(s => s.id === staffId);
    const appointmentId = 'AVO-CIT-' + Math.floor(1000 + Math.random() * 9000);
    const currentBcv = window.bcvRate || 36.50;
    const totalBs = (service.price * currentBcv).toFixed(2);
    const staffNameFinal = staff ? staff.name : 'Asignación Automática';

    // Intentar guardar en Supabase de forma segura sin bloquear el flujo si falla
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
            if (dbError) {
                console.error('Aviso de Supabase al insertar:', dbError.message);
            }
        }
    } catch (err) {
        console.error('Excepción al conectar con Supabase:', err);
    }

    // Actualizar la tabla localmente de inmediato
    await loadAppointmentsFromSupabase();

    // Crear mensaje directo para el WhatsApp de Avocado Shop
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

    const encodedMsg = encodeURIComponent(msg);
    window.open(`https://wa.me/584143943252?text=${encodedMsg}`, '_blank');

    // Resetear formulario y avisar con éxito
    const formEl = document.getElementById('appointmentForm') || document.querySelector('form');
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
            appointmentId: item.codigo || item.code || item.id || 'N/A',
            clientName: item.cliente || item.client_name || item.nombre || 'Sin nombre',
            clientPhone: item.telefono || item.client_phone || item.phone || '',
            serviceName: item.servicio || item.service_name || 'Servicio General',
            staffName: item.sucursal_especialista || item.staff || 'Asignación Automática',
            dateTime: item.fecha_hora || item.date || 'Por definir',
            status: item.estado || item.status || 'Pendiente'
        }));

        renderAppointmentsTableSafe();
    } else {
        window.appointments = [];
        renderAppointmentsTableSafe();
    }
}

// Función para pintar la tabla de forma segura en la Agenda
function renderAppointmentsTableSafe() {
    const agendaHeader = Array.from(document.querySelectorAll('h3, h4, div')).find(el => el.textContent.includes('Agenda del Centro de Manicura'));
    const parentCard = agendaHeader ? agendaHeader.closest('div') : null;
    const targetTable = parentCard ? parentCard.querySelector('table') : document.querySelector('table');
    const tbody = targetTable ? targetTable.querySelector('tbody') : null;

    if (!tbody) return;

    if (!window.appointments || window.appointments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 15px; color: #64748b;">No hay citas registradas en la base de datos.</td></tr>`;
        return;
    }

    tbody.innerHTML = window.appointments.map(app => `
        <tr>
            <td style="padding: 10px 16px; font-size: 13px;">${app.appointmentId}</td>
            <td style="padding: 10px 16px; font-size: 13px;"><strong>${app.clientName}</strong><br><span style="font-size: 11px; color: #64748b;">${app.clientPhone}</span></td>
            <td style="padding: 10px 16px; font-size: 13px;">${app.serviceName}</td>
            <td style="padding: 10px 16px; font-size: 13px;">${app.staffName}</td>
            <td style="padding: 10px 16px; font-size: 13px;">${app.dateTime}</td>
            <td style="padding: 10px 16px; font-size: 13px;">
                <span style="background: #eefbf4; color: #00a66c; padding: 4px 8px; border-radius: 4px; font-weight: bold; display: inline-block;">
                    ${app.status}
                </span>
            </td>
        </tr>
    `).join('');
}

// Inicializar al cargar la página
window.addEventListener('DOMContentLoaded', loadAppointmentsFromSupabase);
window.addEventListener('load', loadAppointmentsFromSupabase);
