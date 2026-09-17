// --- CONSTANTES Y CONFIGURACIÓN DE CITAS ---
window.appointments = window.appointments || [];

// Función auxiliar segura para obtener el cliente de Supabase
function getSupabaseClient() {
    const s = window.supabaseClient || window.supabase || window._supabase;
    if (!s) return null;
    const client = s.default && typeof s.default.from === 'function' ? s.default : s;
    return (client && typeof client.from === 'function') ? client : null;
}

// OBTENER TASA BCV GLOBAL ACTIVA
function getActiveBcvRate() {
    if (window.bcvRate && !isNaN(window.bcvRate) && window.bcvRate > 0) {
        return parseFloat(window.bcvRate);
    }
    const bcvBadge = document.getElementById('bcvRateDisplay') || document.querySelector('[id*="bcv"]');
    if (bcvBadge) {
        const parsed = parseFloat(bcvBadge.innerText.replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 36.50; // Fallback por defecto
}

// FUNCIÓN PARA CONVERTIR FECHA Y HORA A TIMESTAMPTZ ISO COMPATIBLE CON POSTGRESQL
function formatToISO(dateStr, timeStr) {
    try {
        if (!dateStr) return new Date().toISOString();
        
        let cleanedTime = (timeStr || '09:00').trim().toUpperCase();
        let hours = 9;
        let minutes = 0;

        const isPM = cleanedTime.includes('PM');
        const isAM = cleanedTime.includes('AM');

        cleanedTime = cleanedTime.replace(/AM|PM/g, '').trim();
        const parts = cleanedTime.split(':');

        if (parts.length >= 1) hours = parseInt(parts[0], 10) || 0;
        if (parts.length >= 2) minutes = parseInt(parts[1], 10) || 0;

        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;

        const hStr = String(hours).padStart(2, '0');
        const mStr = String(minutes).padStart(2, '0');

        return `${dateStr}T${hStr}:${mStr}:00+00:00`;
    } catch (err) {
        console.error("Error al formatear timestamptz:", err);
        return `${dateStr}T09:00:00+00:00`;
    }
}

// POBLAR SELECTS DEL FORMULARIO DE RESERVA DESDE SUPABASE
window.populateAppointmentSelects = async function() {
    const client = getSupabaseClient();
    if (!client) return;

    const serviceSelect = document.getElementById('appServiceSelect');
    const staffSelect = document.getElementById('appStaffSelect');

    // Cargar Servicios
    const { data: serviciosData } = await client.from('servicios').select('*');
    if (serviceSelect && serviciosData && serviciosData.length > 0) {
        serviceSelect.innerHTML = '<option value="">Selecciona un servicio</option>' + 
            serviciosData.map(s => {
                const precio = Number(s.precio_usd ?? s.precio ?? 0);
                return `<option value="${s.id}" data-price="${precio}" data-name="${s.nombre}">${s.nombre} ($${precio.toFixed(2)})</option>`;
            }).join('');
    }

    // Cargar Manicuristas/Especialistas activas
    const { data: staffData } = await client.from('manicuristas').select('*').eq('activo', true);
    if (staffSelect && staffData && staffData.length > 0) {
        staffSelect.innerHTML = '<option value="">Selecciona una especialista</option>' + 
            staffData.map(m => `<option value="${m.id}" data-name="${m.nombre}">${m.nombre} (${m.sucursal || 'San Félix'})</option>`).join('');
    }
};

// PROCESAR RESERVA DESDE EL FORMULARIO WEB
window.handleCreateAppointment = async (e) => {
    e.preventDefault();

    const clientName = document.getElementById('appClientName')?.value.trim();
    const clientPhone = document.getElementById('appClientPhone')?.value.trim();
    const branch = document.getElementById('appBranchSelect')?.value;
    const serviceSelectElement = document.getElementById('appServiceSelect');
    const staffSelectElement = document.getElementById('appStaffSelect');
    const date = document.getElementById('appDate')?.value;
    const time = document.getElementById('appTimeSelect')?.value;

    if (!clientName || !clientPhone || !date || !time) {
        alert("Por favor completa todos los campos requeridos.");
        return;
    }

    const selectedServiceOption = serviceSelectElement?.options[serviceSelectElement.selectedIndex];
    const serviceName = selectedServiceOption?.dataset?.name || selectedServiceOption?.text.split('(')[0].trim() || 'Servicio General';
    const servicePrice = parseFloat(selectedServiceOption?.dataset?.price) || 20.00;

    const selectedStaffOption = staffSelectElement?.options[staffSelectElement.selectedIndex];
    const staffNameFinal = selectedStaffOption?.dataset?.name || selectedStaffOption?.text.split('(')[0].trim() || 'Asignación Automática';

    const sucursalEspecialistaFinal = `${branch} (${staffNameFinal})`;
    const fechaHoraISO = formatToISO(date, time);
    const client = getSupabaseClient();

    // 1. Validar disponibilidad en Supabase
    if (client) {
        try {
            const { data: existingAppointments, error: checkError } = await client
                .from('appointments')
                .select('*')
                .eq('sucursal_especialista', sucursalEspecialistaFinal);

            if (!checkError && existingAppointments && existingAppointments.length > 0) {
                const conflicto = existingAppointments.find(app => {
                    const estado = (app.estado || '').toLowerCase();
                    const esActiva = estado !== 'cancelado' && estado !== 'cancelada';
                    const mismaFechaHora = app.fecha_hora === fechaHoraISO || 
                                          app.fecha_hora.includes(`${date}T`) || 
                                          app.fecha_hora.includes(`${date} - ${time}`);
                    return esActiva && mismaFechaHora;
                });

                if (conflicto) {
                    alert(`⚠️ NO DISPONIBILIDAD\n\nLa especialista ${staffNameFinal} en la sucursal ${branch} ya cuenta con una cita registrada el ${date} a las ${time}.\n\nPor favor, selecciona otro horario o especialista.`);
                    return;
                }
            }
        } catch (err) {
            console.error('Excepción al validar duplicados:', err);
        }
    }

    // 2. Registro de la cita
    const appointmentId = 'AVO-CIT-' + Math.floor(1000 + Math.random() * 9000);
    const currentBcv = getActiveBcvRate();
    const totalBs = (servicePrice * currentBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    try {
        if (client) {
            const { error: dbError } = await client.from('appointments').insert([{
                codigo: appointmentId,
                cliente: clientName,
                telefono: clientPhone,
                servicio: serviceName,
                sucursal_especialista: sucursalEspecialistaFinal,
                fecha_hora: fechaHoraISO,
                estado: 'Pendiente'
            }]);
            
            if (dbError) {
                alert("Hubo un error al guardar la cita en la base de datos: " + dbError.message);
                return;
            }
        }
    } catch (err) {
        console.error('Excepción al conectar con Supabase:', err);
    }

    await loadAppointmentsFromSupabase();

    // 3. Enviar notificación por WhatsApp
    let msg = `✨ *SOLICITUD DE CITA - AVOCADO SPA* ✨\n\n`;
    msg += `🆔 *Cita:* #${appointmentId}\n`;
    msg += `👤 *Cliente:* ${clientName}\n`;
    msg += `💅 *Servicio:* ${serviceName}\n`;
    msg += `🏢 *Sucursal:* ${branch}\n`;
    msg += `👩‍🎨 *Especialista:* ${staffNameFinal}\n`;
    msg += `📅 *Fecha:* ${date}\n`;
    msg += `⏰ *Hora:* ${time}\n`;
    msg += `💰 *Total:* $${servicePrice.toFixed(2)} (Bs. ${totalBs})\n\n`;
    msg += `_Quedo a la espera de la confirmación de la cita._`;

    window.open(`https://wa.me/584143943252?text=${encodeURIComponent(msg)}`, '_blank');

    const formEl = document.getElementById('appointmentForm') || document.querySelector('form');
    if (formEl) formEl.reset();
    alert(`✅ Tu solicitud de cita #${appointmentId} ha sido enviada con éxito.`);
};

// CARGAR Y RENDERIZAR CITAS DESDE SUPABASE
async function loadAppointmentsFromSupabase() {
    const client = getSupabaseClient();
    
    if (!client) {
        setTimeout(loadAppointmentsFromSupabase, 800);
        return;
    }
    
    const { data, error } = await client.from('appointments').select('*');

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
}

// CAMBIAR ESTADO DE LA CITA
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
            alert('No se pudo eliminar la cita de la base de datos.');
            return;
        }
    }
    await loadAppointmentsFromSupabase();
};

// RENDERIZAR TABLA DE CITAS
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
                    <option value="Cancelado" ${app.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
            </td>
            <td class="p-2.5 text-center">
                <button onclick="deleteAppointment('${app.appointmentId}')" title="Eliminar Cita" class="bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded-md text-xs font-bold transition">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// FUNCIONES DE REPORTE Y REVISIÓN EN PANTALLA
window.displayAppointmentsScreen = async function() {
    const modal = document.getElementById('screenAppointmentsModal');
    const tableContainer = document.getElementById('screenAppointmentsBody');
    const totalCounter = document.getElementById('appReportTotalCount');
    const dateElement = document.getElementById('appReportDate');

    if (dateElement) dateElement.textContent = new Date().toLocaleDateString('es-VE');
    if (tableContainer) tableContainer.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-slate-400 text-xs">Cargando citas desde Supabase...</td></tr>`;
    if (modal) modal.classList.remove('hidden');

    let appointmentsList = [];
    const supabase = getSupabaseClient();

    if (supabase) {
        const { data, error } = await supabase.from('appointments').select('*');
        if (!error && data) appointmentsList = data;
    }

    if (appointmentsList.length === 0 && Array.isArray(window.appointments)) {
        appointmentsList = window.appointments;
    }

    if (tableContainer) {
        if (appointmentsList.length === 0) {
            tableContainer.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-slate-400 text-xs">No hay citas registradas en el sistema.</td></tr>`;
        } else {
            tableContainer.innerHTML = appointmentsList.map(item => {
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

    if (totalCounter) totalCounter.textContent = `Total Citas: ${appointmentsList.length}`;
};

window.closeAppointmentsScreen = function() {
    const modal = document.getElementById('screenAppointmentsModal');
    if (modal) modal.classList.add('hidden');
};

window.printAppointmentsReport = function() {
    window.displayAppointmentsScreen();
    setTimeout(() => { window.print(); }, 300);
};

// GESTIÓN DE MANICURISTAS Y SERVICIOS EN SUPABASE
window.addStaffPrompt = async function() {
    const nombre = prompt("Nombre y Apellido de la manicurista:");
    if (!nombre) return;
    
    const sucursal = prompt("Sucursal (San Félix, CC Alta Vista I, CC Alta Vista II):", "San Félix");

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('manicuristas').insert([{ nombre, sucursal, activo: true }]);
        if (error) {
            alert("Error al guardar en Supabase: " + error.message);
        } else {
            await window.loadStaffTable();
            await window.populateAppointmentSelects();
        }
    }
};

window.deleteStaff = async function(id) {
    if (!confirm("¿Estás seguro de eliminar esta manicurista?")) return;
    
    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('manicuristas').delete().eq('id', id);
        if (error) {
            alert("Error al eliminar: " + error.message);
        } else {
            await window.loadStaffTable();
            await window.populateAppointmentSelects();
        }
    }
};

window.addServicePrompt = async function() {
    const nombre = prompt("Nombre del Servicio (ej. Pedicura Spa + Semipermanente):");
    if (!nombre) return;
    
    const duracion = prompt("Duración estimada (ej. 45 min, 1h 30m):", "1 hora");
    const precioInput = parseFloat(prompt("Precio en USD ($):", "20.00"));

    if (nombre && !isNaN(precioInput)) {
        const client = getSupabaseClient();
        if (client) {
            const { error } = await client.from('servicios').insert([{ 
                nombre: nombre, 
                duracion: duracion, 
                precio_usd: precioInput, 
                precio: precioInput 
            }]);
            
            if (error) {
                alert("Error al guardar servicio: " + error.message);
            } else {
                await window.loadServicesTable();
                await window.populateAppointmentSelects();
            }
        }
    }
};

window.deleteService = async function(id) {
    if (!confirm("¿Estás seguro de eliminar este servicio del catálogo?")) return;

    const client = getSupabaseClient();
    if (client) {
        const { error } = await client.from('servicios').delete().eq('id', id);
        if (error) {
            alert("Error al eliminar: " + error.message);
        } else {
            await window.loadServicesTable();
            await window.populateAppointmentSelects();
        }
    }
};

window.loadStaffTable = async function() {
    const tbody = document.getElementById('staffTableBody');
    if (!tbody) return;

    let staffList = [];
    const client = getSupabaseClient();
    if (client) {
        const { data, error } = await client.from('manicuristas').select('*');
        if (!error) staffList = data || [];
    }

    if (staffList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400">No hay manicuristas registradas</td></tr>`;
        return;
    }

    tbody.innerHTML = staffList.map(stf => `
        <tr class="border-b border-slate-50">
            <td class="p-2.5 font-bold text-slate-800">${stf.nombre}</td>
            <td class="p-2.5 text-slate-600">${stf.especialidad || 'Especialista'}</td>
            <td class="p-2.5 text-slate-600">${stf.sucursal || 'San Félix'}</td>
            <td class="p-2.5">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${stf.activo !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}">
                    ${stf.activo !== false ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="p-2.5 text-center">
                <button onclick="window.deleteStaff('${stf.id}')" class="text-xs text-red-500 hover:font-bold" title="Eliminar">🗑️</button>
            </td>
        </tr>
    `).join('');
};

window.loadServicesTable = async function() {
    const tbody = document.getElementById('servicesTableBody');
    if (!tbody) return;

    const currentBcv = getActiveBcvRate();
    let servicesList = [];
    const client = getSupabaseClient();

    if (client) {
        const { data, error } = await client.from('servicios').select('*');
        if (!error) servicesList = data || [];
    }

    if (servicesList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400">No hay servicios registrados</td></tr>`;
        return;
    }

    tbody.innerHTML = servicesList.map(srv => {
        const precioUsd = Number(srv.precio_usd ?? srv.precio ?? 0);
        const priceBs = (precioUsd * currentBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        return `
            <tr class="border-b border-slate-50">
                <td class="p-2.5 font-bold text-slate-800">${srv.nombre}</td>
                <td class="p-2.5 text-slate-500">${srv.duracion || 'N/A'}</td>
                <td class="p-2.5 font-bold text-emerald-700">$${precioUsd.toFixed(2)}</td>
                <td class="p-2.5 font-bold text-slate-700">Bs. ${priceBs}</td>
                <td class="p-2.5 text-center">
                    <button onclick="window.deleteService('${srv.id}')" class="text-xs text-red-500 hover:font-bold" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
};

// Carga e inicialización al estar listo el DOM
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.loadAppointmentsFromSupabase) window.loadAppointmentsFromSupabase();
        if (window.populateAppointmentSelects) window.populateAppointmentSelects();
        if (window.loadStaffTable) window.loadStaffTable();
        if (window.loadServicesTable) window.loadServicesTable();
    }, 500);
});