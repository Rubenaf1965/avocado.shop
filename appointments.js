
// Agrega esta constante al inicio de appointments.js
const staffMembers = [
    { id: 'staff-1', name: 'Especialista San Félix', branch: 'san felix' },
    { id: 'staff-2', name: 'Especialista Alta Vista', branch: 'cc alta vista i' }
];
const manicureServices = [
    { id: 'manicure', name: 'Manicure', duration: '2 horas' },
    { id: 'pedicure', name: 'Pedicure', duration: '1 hora 40 minutos' }
];
// Procesar la reserva desde el formulario web
window.handleCreateAppointment = (e) => {
  e.preventDefault();

  const clientName = document.getElementById('appClientName').value.trim();
  const clientPhone = document.getElementById('appClientPhone').value.trim();
  const branch = document.getElementById('appBranchSelect').value;
  const serviceId = document.getElementById('appServiceSelect').value;
  const staffId = document.getElementById('appStaffSelect').value;
  const date = document.getElementById('appDate').value;
  const time = document.getElementById('appTimeSelect').value;

  if (!clientName || !clientPhone || !date || !time) {
    alert("Por favor completa todos los campos requeridos.");
    return;
  }

  const service = manicureServices.find(s => s.id === serviceId);
  const staff = staffMembers.find(s => s.id === staffId);
  const appointmentId = 'AVO-CIT-' + Math.floor(1000 + Math.random() * 9000);
  const totalBs = (service.price * window.bcvRate).toFixed(2);

  const newAppointment = {
    appointmentId,
    clientName,
    clientPhone,
    serviceId,
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

  appointments.push(newAppointment);
  saveAppointmentsState();

  // Crear mensaje directo para el WhatsApp de Avocado Shop
  let msg = `✨ *SOLICITUD DE CITA - AVOCADO SPA* ✨\n\n`;
  msg += `🆔 *Cita:* #${appointmentId}\n`;
  msg += `👤 *Cliente:* ${clientName}\n`;
  msg += `💅 *Servicio:* ${service.name}\n`;
  msg += `🏢 *Sucursal:* ${branch}\n`;
  msg += `👩‍🎨 *Especialista:* ${staff ? staff.name : 'Cualquiera disponible'}\n`;
  msg += `📅 *Fecha:* ${date}\n`;
  msg += `⏰ *Hora:* ${time}\n`;
  msg += `💰 *Total:* $${service.price.toFixed(2)} (Bs. ${totalBs})\n\n`;
  msg += `_Quedo a la espera de la confirmación de la cita._`;

  const encodedMsg = encodeURIComponent(msg);
  window.open(`https://wa.me/584143943252?text=${encodedMsg}`, '_blank');

  document.getElementById('appointmentForm').reset();
  alert(`✅ Tu solicitud de cita #${appointmentId} ha sido enviada con éxito.`);
  renderAppointmentsTable();
};

// Renderizar tabla de administración de citas con filtros de sucursal
function renderAppointmentsTable(filterBranch = activeAdminBranch) {
  const tbody = document.getElementById('appointmentsTableBody');
  if (!tbody) return;

  const filtered = filterBranch === "ALL" ? appointments : appointments.filter(a => a.branch === filterBranch);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-slate-400">No hay citas agendadas en esta sucursal.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const realIndex = appointments.findIndex(item => item.appointmentId === a.appointmentId);
    const totalBs = (a.price * window.bcvRate).toFixed(2);
    
    return `
      <tr class="border-b hover:bg-slate-50 text-xs">
        <td class="p-2.5 font-mono font-bold text-slate-700">${a.appointmentId}</td>
        <td class="p-2.5">
          <p class="font-bold text-slate-800">${a.clientName}</p>
          <p class="text-[10px] text-slate-500">${a.clientPhone}</p>
        </td>
        <td class="p-2.5 font-medium text-slate-800">${a.serviceName}</td>
        <td class="p-2.5 text-slate-600">${a.branch} <br><span class="text-[10px] text-emerald-700 font-bold">(${a.staffName})</span></td>
        <td class="p-2.5 font-bold text-slate-700">${a.date}<br><span class="text-slate-500">${a.time}</span></td>
        <td class="p-2.5">
          <select onchange="changeAppointmentStatus(${realIndex}, this.value)" class="text-[10px] font-bold rounded-lg px-2 py-1 border outline-none cursor-pointer">
            <option value="Pendiente" ${a.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="Confirmada" ${a.status === 'Confirmada' ? 'selected' : ''}>Confirmada</option>
            <option value="Completada" ${a.status === 'Completada' ? 'selected' : ''}>Completada</option>
            <option value="Cancelada" ${a.status === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
          </select>
        </td>
        <td class="p-2.5 text-center flex justify-center gap-1.5">
          <button onclick="sendWhatsAppReminder('${a.appointmentId}')" title="Enviar Recordatorio por WhatsApp" class="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
            📲 Recordatorio
          </button>
          <button onclick="deleteAppointment(${realIndex})" title="Eliminar Cita" class="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded-md text-[10px] font-bold">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Cambiar Estado de Cita
window.changeAppointmentStatus = (idx, newStatus) => {
  appointments[idx].status = newStatus;
  saveAppointmentsState();
  renderAppointmentsTable();
};

// Enviar Recordatorio Automático por WhatsApp al Cliente
window.sendWhatsAppReminder = (appointmentId) => {
  const app = appointments.find(a => a.appointmentId === appointmentId);
  if (!app) return alert("Cita no encontrada.");

  const cleanPhone = app.clientPhone.replace(/[^0-9]/g, '');
  const totalBs = (app.price * window.bcvRate).toFixed(2);

  let msg = `Hola *${app.clientName}* 🥑✨ Te escribimos de *Avocado Beauty & Spa*.\n\n`;
  msg += `Te recordamos tu próxima cita de manicura/pedicura:\n`;
  msg += `💅 *Servicio:* ${app.serviceName}\n`;
  msg += `🗓️ *Fecha:* ${app.date}\n`;
  msg += `⏰ *Hora:* ${app.time}\n`;
  msg += `🏢 *Sucursal:* ${app.branch}\n`;
  msg += `👩‍🎨 *Atendido por:* ${app.staffName}\n\n`;
  msg += `Por favor confirma tu asistencia respondiendo a este mensaje. ¡Te esperamos! 🥰`;

  const encoded = encodeURIComponent(msg);
  window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
};

// Eliminar cita
window.deleteAppointment = (idx) => {
  if (confirm("¿Estás seguro de cancelar/eliminar esta cita registrada?")) {
    appointments.splice(idx, 1);
    saveAppointmentsState();
    renderAppointmentsTable();
  }
};
// guardar cita
const guardarCita = async (datosCita) => {
  const { error } = await supabase
    .from('appointments')
    -insert([
      {
        codigo: datosCita.codigo, // Ej: CITA-001
        cliente: datosCita.cliente,
        telefono: datosCita.telefono,
        servicio: datosCita.servicio,
        sucursal_especialista: datosCita.sucursalEspecialista,
        fecha_hora: datosCita.fechaHora,
        estado: 'Pendiente',
        recordatorio_enviado: false
      }
    ]);

  if (error) {
    console.error('Error al guardar la cita:', error.message);
    return false;
  }
  return true;
};
