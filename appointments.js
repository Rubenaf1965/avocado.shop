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

// --- CARGAR CITAS DESDE SUPABASE AL PANEL ---
async function loadAppointmentsFromSupabase() {
  if (typeof supabase === 'undefined') return;
  
  const { data, error } = await supabase
    .from('appointments')
    .select('*');

  if (error) {
    console.error('Error al cargar citas de Supabase:', error.message);
    return;
  }

  if (data) {
    window.appointments = data.map(item => ({
      appointmentId: item.codigo,
      clientName: item.cliente,
      clientPhone: item.telefono,
      serviceName: item.servicio,
      branch: item.sucursal_especialista ? item.sucursal_especialista.split('(')[0].trim() : 'San Félix',
      staffName: item.sucursal_especialista || 'Asignación Automática',
      date: item.fecha_hora ? item.fecha_hora.split('-')[0].trim() : '',
      time: item.fecha_hora ? item.fecha_hora.split('-')[1]?.trim() : '',
      status: item.estado || 'Pendiente',
      price: 25.00
    }));

    if (typeof renderAppointmentsTable === 'function') {
      renderAppointmentsTable();
    }
  }
}

// --- EJECUTAR AL CARGAR LA VENTANA ---
window.addEventListener('DOMContentLoaded', () => {
  loadAppointmentsFromSupabase();
});