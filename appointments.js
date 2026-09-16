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
      price: 25.00 // Respaldo por defecto
    };
  }

  const staff = staffMembers.find(s => s.id === staffId);
  const appointmentId = 'AVO-CIT-' + Math.floor(1000 + Math.random() * 9000);
  const currentBcv = window.bcvRate || 36.50;
  const totalBs = (service.price * currentBcv).toFixed(2);

  const newAppointment = {
    appointmentId,
    clientName,
    clientPhone,
    serviceId: service.id,
    serviceName: service.name,
    price: service.price,
    branch,
    staffId,
    staffName: staff ? staff.name : 'Asignación Automática',
    date,
    time,
    status: 'Pendiente',
    createdAt: new Date().toISOString()
  };
// Guardar en Supabase si está disponible la función o el cliente
  const client = window.supabaseClient || (typeof supabase !== 'undefined' && typeof supabase.from === 'function' ? supabase : null);
  
  if (typeof guardarCita === 'function') {
    await guardarCita({
      codigo: appointmentId,
      cliente: clientName,
      telefono: clientPhone,
      servicio: service.name,
      sucursalEspecialista: `${branch} (${newAppointment.staffName})`,
      fechaHora: `${date} - ${time}`
    });
  } else if (client) {
    await client.from('appointments').insert([{
      codigo: appointmentId,
      cliente: clientName,
      telefono: clientPhone,
      servicio: service.name,
      sucursal_especialista: `${branch} (${newAppointment.staffName})`,
      fecha_hora: `${date} - ${time}`,
      estado: 'Pendiente'
    }]);
  }

  // Recargar las citas desde Supabase para actualizar la tabla inmediatamente
  await loadAppointmentsFromSupabase();

  // Guardar en Supabase y base de datos local
  if (typeof guardarCita === 'function') {
    await guardarCita({
      codigo: appointmentId,
      cliente: clientName,
      telefono: clientPhone,
      servicio: service.name,
      sucursalEspecialista: `${branch} (${newAppointment.staffName})`,
      fechaHora: `${date} - ${time}`
    });
  }

  // Recargar las citas desde Supabase para actualizar la tabla inmediatamente
  await loadAppointmentsFromSupabase();

  // Crear mensaje directo para el WhatsApp de Avocado Shop
  let msg = `✨ *SOLICITUD DE CITA - AVOCADO SPA* ✨\n\n`;
  msg += `🆔 *Cita:* #${appointmentId}\n`;
  msg += `👤 *Cliente:* ${clientName}\n`;
  msg += `💅 *Servicio:* ${service.name}\n`;
  msg += `🏢 *Sucursal:* ${branch}\n`;
  msg += `👩‍🎨 *Especialista:* ${newAppointment.staffName}\n`;
  msg += `📅 *Fecha:* ${date}\n`;
  msg += `⏰ *Hora:* ${time}\n`;
  msg += `💰 *Total:* $${service.price.toFixed(2)} (Bs. ${totalBs})\n\n`;
  msg += `_Quedo a la espera de la confirmación de la cita._`;

  const encodedMsg = encodeURIComponent(msg);
  window.open(`https://wa.me/584143943252?text=${encodedMsg}`, '_blank');

  // Resetear formulario y avisar
  const formEl = document.getElementById('appointmentForm');
  if (formEl) formEl.reset();
  alert(`✅ Tu solicitud de cita #${appointmentId} ha sido enviada con éxito.`);
};

// --- CARGAR Y RENDERIZAR CITAS DESDE SUPABASE ---
async function loadAppointmentsFromSupabase() {
  const client = window.supabaseClient || 
                 window.supabase || 
                 (typeof supabase !== 'undefined' && typeof supabase.from === 'function' ? supabase : null);
  
  if (!client || typeof client.from !== 'function') {
    setTimeout(loadAppointmentsFromSupabase, 500);
    return;
  }
  
  const { data, error } = await client
    .from('appointments')
    .select('*');

  if (error) {
    console.error('Error al cargar citas de Supabase:', error.message);
    return;
  }

  console.log('Citas obtenidas de Supabase:', data); // <-- Para verificar en la consola (F12)

  if (data) {
    window.appointments = data.map(item => ({
      appointmentId: item.codigo || 'N/A',
      clientName: item.cliente || 'Sin nombre',
      clientPhone: item.telefono || '',
      serviceName: item.servicio || 'Servicio General',
      branch: item.sucursal_especialista ? item.sucursal_especialista.split('(')[0].trim() : 'San Félix',
      staffName: item.sucursal_especialista || 'Asignación Automática',
      date: item.fecha_hora ? item.fecha_hora.split('-')[0].trim() : '',
      time: item.fecha_hora ? item.fecha_hora.split('-')[1]?.trim() : '',
      status: item.estado || 'Pendiente',
      price: 25.00
    }));

    renderAppointmentsTableSafe();
  }
}

// Función robusta para pintar las citas en la tabla de la interfaz
function renderAppointmentsTableSafe() {
  // Buscamos la tabla o el contenedor dentro de la "Agenda del Centro de Manicura"
  let tbody = document.querySelector('#appointmentsTableBody') || 
              document.querySelector('.agenda-table tbody') || 
              document.querySelector('table tbody');

  // Si la tabla no tiene tbody explícito, intentamos ubicar la tabla de la agenda
  if (!tbody) {
    const tables = document.querySelectorAll('table');
    // Por lo general la segunda tabla es la de inventario, la primera o la que está en la sección de agenda es esta
    if (tables.length > 0) {
      // Buscamos la tabla que esté cerca de "Agenda del Centro de Manicura"
      const agendaHeader = Array.from(document.querySelectorAll('h3, h4, div')).find(el => el.textContent.includes('Agenda del Centro de Manicura'));
      if (agendaHeader) {
        const parentCard = agendaHeader.closest('div');
        const targetTable = parentCard ? parentCard.querySelector('table') : null;
        if (targetTable) {
          tbody = targetTable.querySelector('tbody') || targetTable;
        }
      }
    }
  }

  if (!tbody) {
    console.warn('No se encontró el contenedor de la tabla de citas en el DOM.');
    return;
  }

  // Si hay una función original definida por el usuario, la usamos; si no, pintamos por defecto
  if (typeof renderAppointmentsTable === 'function' && renderAppointmentsTable !== renderAppointmentsTableSafe) {
    try {
      renderAppointmentsTable();
      return;
    } catch (e) {
      console.log('Usando renderizado seguro alternativo...');
    }
  }

  // Pintar filas en la tabla
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
      <td style="padding: 10px 16px; font-size: 13px;">${app.date} - ${app.time}</td>
      <td style="padding: 10px 16px; font-size: 13px;"><span style="background: #eefbf4; color: #00a66c; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${app.status}</span></td>
    </tr>
  `).join('');
}

window.addEventListener('DOMContentLoaded', () => {
  loadAppointmentsFromSupabase();
});
window.addEventListener('load', () => {
  loadAppointmentsFromSupabase();
});