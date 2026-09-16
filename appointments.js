// Agrega o verifica las constantes al inicio de appointments.js
const staffMembers = [
    { id: 'staff-1', name: 'Especialista San Félix', branch: 'san felix' },
    { id: 'staff-2', name: 'Especialista Alta Vista', branch: 'cc alta vista i' }
];

const manicureServices = [
    { id: 'manicure', name: 'Manicure', price: 20.00, duration: '2 horas' },
    { id: 'pedicure', name: 'Pedicure', price: 18.00, duration: '1 hora 40 minutos' },
    { id: 'Manicura Rusa + Gelificación', name: 'Manicura Rusa + Gelificación', price: 25.00, duration: '2 horas' }
];

// Procesar la reserva desde el formulario web
window.handleCreateAppointment = (e) => {
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

  // Búsqueda flexible: por ID exacto, por coincidencia en el texto o valor por defecto
  let service = manicureServices.find(s => s.id === serviceId || s.name === serviceId);
  if (!service) {
    // Intento de rescate si el select pasa el texto completo con precio
    const selectedText = serviceSelectElement.options[serviceSelectElement.selectedIndex].text;
    service = {
      id: serviceId,
      name: selectedText.split('(')[0].trim() || serviceId,
      price: 25.00 // Precio por defecto de respaldo para evitar errores
    };
  }

  const staff = staffMembers.find(s => s.id === staffId);
  const appointmentId = 'AVO-CIT-' + Math.floor(1000 + Math.random() * 9000);
  const currentBcv = window.bcvRate || 36.50; // Respaldo por si la tasa global tarda un instante
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

  // Guardar en memoria local o arreglo global si existe
  if (typeof appointments !== 'undefined') {
    appointments.push(newAppointment);
    if (typeof saveAppointmentsState === 'function') saveAppointmentsState();
  }

  // Guardar en Supabase si está disponible la función
  if (typeof guardarCita === 'function') {
    guardarCita({
      codigo: appointmentId,
      cliente: clientName,
      telefono: clientPhone,
      servicio: service.name,
      sucursalEspecialista: `${branch} (${newAppointment.staffName})`,
      fechaHora: `${date} - ${time}`
    });
  }

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

  // Intentar resetear formulario y refrescar tabla si los elementos existen
  const formEl = document.getElementById('appointmentForm');
  if (formEl) formEl.reset();
  alert(`✅ Tu solicitud de cita #${appointmentId} ha sido enviada con éxito.`);
  
  if (typeof renderAppointmentsTable === 'function') {
    renderAppointmentsTable();
  }
};