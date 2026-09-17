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

window.appointments = window.appointments || [];

// Función auxiliar segura para obtener el cliente de Supabase
function getSupabaseClient() {
    const s = window.supabaseClient || window.supabase || window._supabase;
    if (!s) return null;
    const client = s.default && typeof s.default.from === 'function' ? s.default : s;
    return (client && typeof client.from === 'function') ? client : null;
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
            id: item.id, // ID interno para operaciones de base de datos
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
}

// Función para cambiar el estado de la cita en tiempo real
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

// Función para eliminar cita
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

// Renderizar la tabla con diseño responsivo y selector interactivo
function renderAppointmentsTableSafe() {
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;

    if (!window.appointments || window.appointments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-slate-400 text-xs">No hay citas registradas en la base de datos.</td></tr>`;
        return;
    }

    tbody.innerHTML = window.appointments.map(app => `
        <tr class="border-b text-xs text-slate-700 hover:bg-slate-50 transition">
            <td class="p-2.5 font-bold">${app.appointmentId}</td>
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
                </select>
            </td>
            <td class="p-2.5 text-center">
                <button onclick="deleteAppointment('${app.appointmentId}')" title="Eliminar Cita" class="bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded-md text-xs font-bold transition">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// Inicializar al cargar la página
window.addEventListener('DOMContentLoaded', loadAppointmentsFromSupabase);
window.addEventListener('load', loadAppointmentsFromSupabase);

// --- FUNCIONES DE REPORTES EN PANTALLA E IMPRESIÓN ---

window.displayAppointmentsScreen = async function() {
  const modal = document.getElementById('screenAppointmentsModal');
  const tableContainer = document.getElementById('screenAppointmentsBody'); // ID real del HTML
  const totalCounter = document.getElementById('appReportTotalCount');     // ID real del HTML
  const dateElement = document.getElementById('appReportDate');            // ID real del HTML

  // 1. Asignar fecha actual
  if (dateElement) {
    dateElement.textContent = new Date().toLocaleDateString('es-ES');
  }

  // 2. Estado de carga en la tabla
  if (tableContainer) {
    tableContainer.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-slate-400 text-xs">Cargando citas desde Supabase...</td></tr>`;
  }

  // 3. Desplegar el modal
  if (modal) modal.classList.remove('hidden');

  let appointmentsList = [];

  // 4. Consultar datos a Supabase
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('appointments')
        .select('*');

      if (!error && data && data.length > 0) {
        appointmentsList = data;
      }
    }
  } catch (err) {
    console.error('Error recuperando citas para reporte:', err);
  }

  // Fallback si la consulta web devolvió array vacío pero hay datos locales
  if (appointmentsList.length === 0 && Array.isArray(window.appointments) && window.appointments.length > 0) {
    appointmentsList = window.appointments;
  }

  // 5. Inyectar filas con Mapeo Correcto a tu esquema de Supabase
  if (tableContainer) {
    if (appointmentsList.length === 0) {
      tableContainer.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-slate-400 text-xs">No hay citas registradas en el sistema.</td></tr>`;
    } else {
      tableContainer.innerHTML = appointmentsList.map(item => {
        // Mapeo seguro para soportar campos en español (DB) y formato procesado (JS)
        const code = item.codigo || item.appointmentId || item.code || 'AVO-CIT';
        const client = item.cliente || item.clientName || 'N/A';
        const phone = item.telefono || item.clientPhone || 'N/A';
        const service = item.servicio || item.serviceName || 'N/A';
        const staffAndBranch = item.sucursal_especialista || item.staffName || 'San Félix';
        const dateTime = item.fecha_hora || item.dateTime || 'N/A';
        const status = item.estado || item.status || 'Pendiente';

        return `
          <tr class="border-b text-xs text-slate-700 hover:bg-slate-50 transition">
            <td class="p-2.5 font-bold">${code}</td>
            <td class="p-2.5">${client}</td>
            <td class="p-2.5">${phone}</td>
            <td class="p-2.5">${service}</td>
            <td class="p-2.5">${staffAndBranch}</td>
            <td class="p-2.5">${staffAndBranch.split('(')[0].trim()}</td>
            <td class="p-2.5">${dateTime}</td>
            <td class="p-2.5 text-center">
              <span class="px-2 py-1 rounded-full text-[10px] font-bold ${
                status === 'Verificado' || status === 'Confirmada' ? 'bg-emerald-100 text-emerald-800' :
                status === 'En Verificación' || status === 'Pendiente' ? 'bg-amber-100 text-amber-800' :
                'bg-red-100 text-red-800'
              }">${status}</span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 6. Actualizar contador global
  if (totalCounter) {
    totalCounter.textContent = `Total Citas: ${appointmentsList.length}`;
  }
};

window.closeAppointmentsScreen = function() {
  const modal = document.getElementById('screenAppointmentsModal');
  if (modal) modal.classList.add('hidden');
};

window.printAppointmentsReport = function() {
  window.print();
};

window.printAppointmentsReport = function() {
  // Asegura que la tabla se haya poblado antes de mandar a imprimir
  window.displayAppointmentsScreen();

  // Esperar un render para ejecutar la impresión limpia
  setTimeout(() => {
    window.print();
  }, 300);
};

window.closeAppointmentsScreen = function() {
  const modal = document.getElementById('screenAppointmentsModal');
  if (modal) modal.classList.add('hidden');
};

window.printAppointmentsReport = function() {
  window.print();
};
// --- GESTIÓN DE MANICURISTAS ---
window.addStaffPrompt = async function() {
  const name = prompt("Nombre y Apellido de la manicurista:");
  if (!name) return;
  
  const specialty = prompt("Especialidad (ej. Nail Art, Polygel, Manicura Rusa):", "Manicura Rusa & Gel");
  const branch = prompt("Sucursal (San Félix, CC Alta Vista I, CC Alta Vista II):", "San Félix");

  if (name && specialty) {
    // Si usas Supabase:
    if (typeof supabaseClient !== 'undefined') {
      const { data, error } = await supabaseClient
        .from('staff')
        .insert([{ name, specialty, branch, status: 'Activo' }]);
      if (error) alert("Error al guardar: " + error.message);
      else loadStaffTable();
    } else {
      // Sincronización Local / Fallback
      alert(`Manicurista ${name} agregada correctamente.`);
    }
  }
};

window.toggleStaffStatus = async function(id, currentStatus) {
  const newStatus = currentStatus === 'Activo' ? 'Inactivo' : 'Activo';
  if (typeof supabaseClient !== 'undefined') {
    await supabaseClient.from('staff').update({ status: newStatus }).eq('id', id);
    loadStaffTable();
  }
};

window.deleteStaff = async function(id) {
  if (confirm("¿Estás seguro de eliminar esta manicurista?")) {
    if (typeof supabaseClient !== 'undefined') {
      await supabaseClient.from('staff').delete().eq('id', id);
      loadStaffTable();
    }
  }
};

// --- GESTIÓN DE SERVICIOS Y PRECIOS ---
window.addServicePrompt = async function() {
  const name = prompt("Nombre del Servicio (ej. Pedicura Spa + Semipermanente):");
  if (!name) return;
  
  const duration = prompt("Duración aproximada (ej. 45 min, 1h 30m):", "1 hora");
  const priceUsd = parseFloat(prompt("Precio en USD ($):", "20.00"));

  if (name && !isNaN(priceUsd)) {
    if (typeof supabaseClient !== 'undefined') {
      const { data, error } = await supabaseClient
        .from('services')
        .insert([{ name, duration, price_usd: priceUsd }]);
      if (error) alert("Error al guardar servicio: " + error.message);
      else loadServicesTable();
    } else {
      alert(`Servicio "${name}" guardado a $${priceUsd.toFixed(2)}.`);
    }
  }
};

window.deleteService = async function(id) {
  if (confirm("¿Estás seguro de eliminar este servicio del catálogo?")) {
    if (typeof supabaseClient !== 'undefined') {
      await supabaseClient.from('services').delete().eq('id', id);
      loadServicesTable();
    }
  }
};
// Renderizar Tabla Manicuristas
export async function loadStaffTable() {
  const tbody = document.getElementById('staffTableBody');
  if (!tbody) return;

  // Carga de datos (reemplazar según tu estructura de Supabase o array local)
  let staffList = [];
  if (typeof supabaseClient !== 'undefined') {
    const { data } = await supabaseClient.from('staff').select('*');
    staffList = data || [];
  }

  if (staffList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400">No hay manicuristas registradas</td></tr>`;
    return;
  }

  tbody.innerHTML = staffList.map(stf => `
    <tr class="border-b border-slate-50">
      <td class="p-2.5 font-bold text-slate-800">${stf.name}</td>
      <td class="p-2.5 text-slate-600">${stf.specialty}</td>
      <td class="p-2.5 text-slate-600">${stf.branch || 'Todas'}</td>
      <td class="p-2.5">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${stf.status === 'Activo' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}">
          ${stf.status}
        </span>
      </td>
      <td class="p-2.5 text-center">
        <button onclick="toggleStaffStatus('${stf.id}', '${stf.status}')" class="text-xs mr-2">🔄</button>
        <button onclick="deleteStaff('${stf.id}')" class="text-xs text-red-500">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// Renderizar Tabla Servicios
export async function loadServicesTable() {
  const tbody = document.getElementById('servicesTableBody');
  if (!tbody) return;

  const currentBcv = parseFloat(document.getElementById('bcvRateDisplay')?.innerText.replace('Bs. ', '')) || 1;

  let servicesList = [];
  if (typeof supabaseClient !== 'undefined') {
    const { data } = await supabaseClient.from('services').select('*');
    servicesList = data || [];
  }

  if (servicesList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400">No hay servicios registrados</td></tr>`;
    return;
  }

  tbody.innerHTML = servicesList.map(srv => {
    const priceBs = (srv.price_usd * currentBcv).toFixed(2);
    return `
      <tr class="border-b border-slate-50">
        <td class="p-2.5 font-bold text-slate-800">${srv.name}</td>
        <td class="p-2.5 text-slate-500">${srv.duration}</td>
        <td class="p-2.5 font-bold text-emerald-700">$${Number(srv.price_usd).toFixed(2)}</td>
        <td class="p-2.5 font-bold text-slate-700">Bs. ${priceBs}</td>
        <td class="p-2.5 text-center">
          <button onclick="deleteService('${srv.id}')" class="text-xs text-red-500">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}
// ==========================================
// MÓDULO DE GESTIÓN DE MANICURISTAS Y SERVICIOS
// ==========================================

// --- FUNCIONES GLOBALIZADAS PARA MANICURISTAS ---
window.addStaffPrompt = async function() {
  const name = prompt("Nombre y Apellido de la manicurista:");
  if (!name) return;
  
  const specialty = prompt("Especialidad (ej. Nail Art, Polygel, Manicura Rusa):", "Manicura Rusa & Gel");
  const branch = prompt("Sucursal (San Félix, CC Alta Vista I, CC Alta Vista II):", "San Félix");

  if (name && specialty) {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { error } = await supabaseClient
        .from('staff')
        .insert([{ name, specialty, branch, status: 'Activo' }]);
      if (error) alert("Error al guardar en Supabase: " + error.message);
      else window.loadStaffTable();
    } else {
      alert(`Manicurista ${name} agregada correctamente.`);
    }
  }
};

window.toggleStaffStatus = async function(id, currentStatus) {
  const newStatus = currentStatus === 'Activo' ? 'Inactivo' : 'Activo';
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    await supabaseClient.from('staff').update({ status: newStatus }).eq('id', id);
    window.loadStaffTable();
  }
};

window.deleteStaff = async function(id) {
  if (confirm("¿Estás seguro de eliminar esta manicurista?")) {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      await supabaseClient.from('staff').delete().eq('id', id);
      window.loadStaffTable();
    }
  }
};

// --- FUNCIONES GLOBALIZADAS PARA SERVICIOS ---
window.addServicePrompt = async function() {
  const name = prompt("Nombre del Servicio (ej. Pedicura Spa + Semipermanente):");
  if (!name) return;
  
  const duration = prompt("Duración estimada (ej. 45 min, 1h 30m):", "1 hora");
  const priceUsd = parseFloat(prompt("Precio en USD ($):", "20.00"));

  if (name && !isNaN(priceUsd)) {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { error } = await supabaseClient
        .from('services')
        .insert([{ name, duration, price_usd: priceUsd }]);
      if (error) alert("Error al guardar servicio: " + error.message);
      else window.loadServicesTable();
    } else {
      alert(`Servicio "${name}" guardado a $${priceUsd.toFixed(2)}.`);
    }
  }
};

window.deleteService = async function(id) {
  if (confirm("¿Estás seguro de eliminar este servicio del catálogo?")) {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      await supabaseClient.from('services').delete().eq('id', id);
      window.loadServicesTable();
    }
  }
};

// --- RENDERIZADO DE TABLAS EN EL PANEL ADMIN ---
window.loadStaffTable = async function() {
  const tbody = document.getElementById('staffTableBody');
  if (!tbody) return;

  let staffList = [];
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    const { data } = await supabaseClient.from('staff').select('*');
    staffList = data || [];
  }

  if (staffList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400">No hay manicuristas registradas</td></tr>`;
    return;
  }

  tbody.innerHTML = staffList.map(stf => `
    <tr class="border-b border-slate-50">
      <td class="p-2.5 font-bold text-slate-800">${stf.name}</td>
      <td class="p-2.5 text-slate-600">${stf.specialty}</td>
      <td class="p-2.5 text-slate-600">${stf.branch || 'Todas'}</td>
      <td class="p-2.5">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${stf.status === 'Activo' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}">
          ${stf.status}
        </span>
      </td>
      <td class="p-2.5 text-center">
        <button onclick="window.toggleStaffStatus('${stf.id}', '${stf.status}')" class="text-xs mr-2" title="Cambiar Estado">🔄</button>
        <button onclick="window.deleteStaff('${stf.id}')" class="text-xs text-red-500" title="Eliminar">🗑️</button>
      </td>
    </tr>
  `).join('');
};

window.loadServicesTable = async function() {
  const tbody = document.getElementById('servicesTableBody');
  if (!tbody) return;

  const bcvText = document.getElementById('bcvRateDisplay')?.innerText || '0';
  const currentBcv = parseFloat(bcvText.replace(/[^0-9.]/g, '')) || 1;

  let servicesList = [];
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    const { data } = await supabaseClient.from('services').select('*');
    servicesList = data || [];
  }

  if (servicesList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400">No hay servicios registrados</td></tr>`;
    return;
  }

  tbody.innerHTML = servicesList.map(srv => {
    const priceBs = (srv.price_usd * currentBcv).toFixed(2);
    return `
      <tr class="border-b border-slate-50">
        <td class="p-2.5 font-bold text-slate-800">${srv.name}</td>
        <td class="p-2.5 text-slate-500">${srv.duration}</td>
        <td class="p-2.5 font-bold text-emerald-700">$${Number(srv.price_usd).toFixed(2)}</td>
        <td class="p-2.5 font-bold text-slate-700">Bs. ${priceBs}</td>
        <td class="p-2.5 text-center">
          <button onclick="window.deleteService('${srv.id}')" class="text-xs text-red-500" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
};

// Carga inicial automática al inicializar el módulo
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (window.loadStaffTable) window.loadStaffTable();
    if (window.loadServicesTable) window.loadServicesTable();
  }, 500);
});
