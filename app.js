// ==========================================
// CONSTANTES, CONFIGURACIÓN Y CLIENTE SUPABASE
// ==========================================
window.bcvRate = 36.50;

const branchPasswords = {
  "ALL": "geral1212",
  "San Félix": "sanfelix2026",
  "CC Alta Vista I": "altavista2020",
  "CC Alta Vista II": "altavista6060"
};

let activeAdminBranch = "ALL";
let isAdminAuthenticated = false;
let masterAdminLoggedIn = false;
let activeModalOrder = null;
let sequentialBatch = [];

// Arrays globales para la aplicación
window.products = [];
window.sellers = JSON.parse(localStorage.getItem('avocado_sellers')) || [
  { id: "s1", name: "María Delgado", branch: "San Félix", sales: 1240.00, commRate: 5 },
  { id: "s2", name: "Andrea Gómez", branch: "CC Alta Vista I", sales: 850.00, commRate: 5 },
  { id: "s3", name: "Carla Rivas", branch: "CC Alta Vista II", sales: 410.00, commRate: 5 }
];
window.orders = JSON.parse(localStorage.getItem('avocado_orders')) || [];
window.cart = JSON.parse(localStorage.getItem('avocado_cart')) || [];
window.appointments = window.appointments || [];

// Helper para obtener el cliente Supabase
function getSupabaseClient() {
  const s = window.supabaseClient || window.supabase || window._supabase;
  if (!s) return null;
  const client = s.default && typeof s.default.from === 'function' ? s.default : s;
  return (client && typeof client.from === 'function') ? client : null;
}

// Convertir archivos a Base64
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function saveState() {
  localStorage.setItem('avocado_sellers', JSON.stringify(window.sellers));
  localStorage.setItem('avocado_orders', JSON.stringify(window.orders));
}

// ==========================================
// TASA BCV Y UTILIDADES DE FECHA
// ==========================================
function getActiveBcvRate() {
  if (window.bcvRate && !isNaN(window.bcvRate) && window.bcvRate > 0) {
    return parseFloat(window.bcvRate);
  }
  const bcvBadge = document.getElementById('bcvRateDisplay') || document.querySelector('[id*="bcv"]');
  if (bcvBadge) {
    const parsed = parseFloat(bcvBadge.innerText.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 847.44;
}

async function fetchLiveBcvRate() {
  const primaryApi = 'https://ve.dolarapi.com/v1/dolares/oficial';
  const fallbackApi = 'https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv';

  try {
    const response = await fetch(primaryApi, { cache: 'no-store' });
    if (!response.ok) throw new Error("Falló API Principal");
    const data = await response.json();
    if (data && data.promedio) {
      window.bcvRate = parseFloat(data.promedio);
      localStorage.setItem('avocado_last_bcv', window.bcvRate);
      updateBcvUI();
      renderStoreProducts();
      updateCartUI();
      return;
    }
  } catch (errorPrimary) {
    try {
      const responseFallback = await fetch(fallbackApi, { cache: 'no-store' });
      if (!responseFallback.ok) throw new Error("Falló API Respaldo");
      const dataFallback = await responseFallback.json();
      if (dataFallback && dataFallback.moneda) {
        window.bcvRate = parseFloat(dataFallback.moneda);
        localStorage.setItem('avocado_last_bcv', window.bcvRate);
        updateBcvUI();
        renderStoreProducts();
        updateCartUI();
        return;
      }
    } catch (errorFallback) {
      console.error("APIs fallaron, usando caché.");
    }
  }

  const savedRate = localStorage.getItem('avocado_last_bcv');
  if (savedRate) {
    window.bcvRate = parseFloat(savedRate);
  }
  updateBcvUI();
  renderStoreProducts();
  updateCartUI();
}

function updateBcvUI() {
  const formattedRate = `Bs. ${window.bcvRate.toFixed(2)}`;
  const displayDesktop = document.getElementById('bcvRateDisplay');
  const displayMobile = document.getElementById('bcvRateDisplayMobile');
  const displayCart = document.getElementById('cartBcvRate');

  if (displayDesktop) displayDesktop.textContent = formattedRate;
  if (displayMobile) displayMobile.textContent = formattedRate;
  if (displayCart) displayCart.textContent = `${formattedRate} / USD`;
}

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

// ==========================================
// CATÁLOGO Y PRODUCTOS (SUPABASE INTEGRATED)
// ==========================================
async function renderStoreProducts() {
  const selectedBranch = document.getElementById('userBranchSelect')?.value || 'ALL';
  const activeCat = document.querySelector('.cat-filter.active')?.getAttribute('data-cat') || 'all';
  const searchVal = document.getElementById('searchInput')?.value.toLowerCase() || '';

  const client = getSupabaseClient();

  if (client) {
    try {
      let query = client.from('products').select('*');
      if (selectedBranch !== "ALL") {
        query = query.eq('branch', selectedBranch);
      }
      if (activeCat !== 'all') {
        query = query.eq('category', activeCat);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) {
        window.products = data;
      }
    } catch (err) {
      console.error("Error consultando Supabase para productos:", err.message);
    }
  }

  let filtered = window.products;
  if (searchVal) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(searchVal));
  }

  renderProducts(filtered);
}

function renderProducts(items) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  if (items.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-slate-400 font-medium">No se encontraron productos en esta sucursal.</div>`;
    return;
  }

  grid.innerHTML = items.map(p => {
    const isOut = p.stock <= 0;
    const priceBs = (p.price * window.bcvRate).toFixed(2);
    
    const stockBadge = isOut 
      ? `<span class="bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider">AGOTADO</span>`
      : `<span class="bg-emerald-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-md backdrop-blur-sm">Stock: ${p.stock}</span>`;

    return `
      <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition relative flex flex-col justify-between">
        <div>
          <div class="relative mb-3">
            <img src="${p.image || 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400'}" alt="${p.name}" class="w-full h-44 object-cover rounded-xl ${isOut ? 'grayscale opacity-75' : ''}">
            <div class="absolute top-2 right-2">
              ${stockBadge}
            </div>
          </div>
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">${p.category}</span>
            <span class="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">${p.branch}</span>
          </div>
          <h3 class="font-bold text-gray-800 text-xs h-8 overflow-hidden">${p.name}</h3>
        </div>

        <div class="flex items-center justify-between mt-4 pt-2 border-t border-gray-50">
          <div>
            <span class="text-base font-extrabold text-gray-900">$${Number(p.price).toFixed(2)}</span>
            <span class="block text-[11px] font-bold text-emerald-700">Bs. ${priceBs}</span>
          </div>
          <button 
            onclick="addToCart('${p.id}')" 
            ${isOut ? 'disabled' : ''}
            class="${isOut ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'} px-3 py-1.5 rounded-lg text-xs font-semibold transition">
            ${isOut ? 'Sin Stock' : '+ Agregar'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.handleCreateProduct = async (e) => {
  e.preventDefault();

  const pBranchSelect = document.getElementById('pBranch');
  const targetBranch = activeAdminBranch !== "ALL" ? activeAdminBranch : pBranchSelect.value;
  const name = document.getElementById('pName').value;
  const category = document.getElementById('pCategory').value;
  const price = parseFloat(document.getElementById('pPrice').value);
  const stock = parseInt(document.getElementById('pStock').value);

  const client = getSupabaseClient();

  if (sequentialBatch.length > 0) {
    const productsToInsert = sequentialBatch.map((item, idx) => ({
      sku: item.sku,
      name: sequentialBatch.length > 1 ? `${name} (#${idx + 1})` : name,
      category: category,
      branch: targetBranch,
      price: price,
      stock: stock,
      image: item.image
    }));

    if (client) {
      const { data, error } = await client.from('products').insert(productsToInsert).select();
      if (error) return alert("Error en Supabase: " + error.message);
      if (data) window.products.push(...data);
    } else {
      productsToInsert.forEach(p => { p.id = Date.now().toString(); window.products.push(p); });
    }

    alert(`✅ Lote de ${sequentialBatch.length} producto(s) guardado(s).`);
    sequentialBatch = [];
    document.getElementById('sequentialPreviewContainer').innerHTML = '';
  } else {
    const fileInput = document.getElementById('pImage');
    let imageUrl = "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400";

    if (fileInput && fileInput.files && fileInput.files[0]) {
      try {
        imageUrl = await readFileAsBase64(fileInput.files[0]);
      } catch (err) {
        return alert("Error procesando imagen.");
      }
    }

    const newProduct = {
      sku: "PROD-00" + (window.products.length + 1),
      name: name,
      category: category,
      branch: targetBranch,
      price: price,
      stock: stock,
      image: imageUrl
    };

    if (client) {
      const { data, error } = await client.from('products').insert([newProduct]).select();
      if (error) return alert("Error en Supabase: " + error.message);
      if (data && data.length > 0) window.products.push(data[0]);
    } else {
      newProduct.id = Date.now().toString();
      window.products.push(newProduct);
    }
    alert("✅ Producto individual guardado con éxito.");
  }

  saveState();
  renderStoreProducts();
  filterAdminView();
  document.getElementById('adminProductForm').reset();
  if (activeAdminBranch !== "ALL") pBranchSelect.value = activeAdminBranch;
};

window.openEditProductModal = (idx) => {
  const prod = window.products[idx];
  document.getElementById('editPIdx').value = idx;
  document.getElementById('editPName').value = prod.name;
  document.getElementById('editPCategory').value = prod.category;
  
  const branchSelect = document.getElementById('editPBranch');
  branchSelect.value = prod.branch;
  branchSelect.disabled = !masterAdminLoggedIn;

  document.getElementById('editPPrice').value = prod.price;
  document.getElementById('editPStock').value = prod.stock;
  document.getElementById('editPImage').value = ''; 
  document.getElementById('editProductModal').classList.remove('hidden');
};

window.closeEditProductModal = () => {
  document.getElementById('editProductModal').classList.add('hidden');
};

window.saveEditedProduct = async (e) => {
  e.preventDefault();
  const idx = document.getElementById('editPIdx').value;
  const prod = window.products[idx];

  const updatedData = {
    name: document.getElementById('editPName').value,
    category: document.getElementById('editPCategory').value,
    price: parseFloat(document.getElementById('editPPrice').value),
    stock: parseInt(document.getElementById('editPStock').value)
  };

  if (masterAdminLoggedIn) {
    updatedData.branch = document.getElementById('editPBranch').value;
  }

  const fileInput = document.getElementById('editPImage');
  if (fileInput.files && fileInput.files[0]) {
    try {
      updatedData.image = await readFileAsBase64(fileInput.files[0]);
    } catch (err) {
      alert("Error al cargar la nueva imagen.");
      return;
    }
  }

  const client = getSupabaseClient();
  if (client && prod.id) {
    const { error } = await client.from('products').update(updatedData).eq('id', prod.id);
    if (error) return alert("Error al actualizar en Supabase: " + error.message);
  }

  Object.assign(window.products[idx], updatedData);
  saveState();
  renderStoreProducts();
  filterAdminView();
  closeEditProductModal();
};

window.deleteProduct = async (idx) => {
  const prod = window.products[idx];
  if (confirm(`¿Eliminar "${prod.name}" de ${prod.branch}?`)) {
    const client = getSupabaseClient();
    if (client && prod.id) {
      const { error } = await client.from('products').delete().eq('id', prod.id);
      if (error) return alert("Error al eliminar en Supabase: " + error.message);
    }
    window.products.splice(idx, 1);
    saveState();
    renderStoreProducts();
    filterAdminView();
  }
};

window.addStockPrompt = async (idx) => {
  const prod = window.products[idx];
  const qtyToAdd = prompt(`Añadir stock a: "${prod.name}" (${prod.branch})\nStock actual: ${prod.stock}\n\nCantidad a sumar:`, "10");
  if (qtyToAdd === null) return;

  const parsedQty = parseInt(qtyToAdd);
  if (isNaN(parsedQty) || parsedQty <= 0) return alert("Ingrese una cantidad válida.");

  const newStock = prod.stock + parsedQty;
  const client = getSupabaseClient();
  if (client && prod.id) {
    const { error } = await client.from('products').update({ stock: newStock }).eq('id', prod.id);
    if (error) return alert("Error actualizando stock: " + error.message);
  }

  window.products[idx].stock = newStock;
  saveState();
  renderStoreProducts();
  filterAdminView();
};

// ==========================================
// CARRITO Y PROCESAMIENTO DE COMPRAS
// ==========================================
window.addToCart = (id) => {
  const product = window.products.find(p => p.id === id || p.id == id);
  if (!product || product.stock <= 0) return;  
  const existing = window.cart.find(item => item.id === id || item.id == id);
  if (existing) {
    if (existing.qty < product.stock) {
      existing.qty++;
    } else {
      return alert('Límite de stock alcanzado.');
    }
  } else { 
    window.cart.push({ ...product, qty: 1 }); 
  }
  localStorage.setItem('avocado_cart', JSON.stringify(window.cart));
  updateCartUI();
};

function updateCartUI() {
  const cartBadge = document.getElementById('cartBadge');
  if (cartBadge) cartBadge.textContent = window.cart.reduce((acc, i) => acc + i.qty, 0);

  const totalUSD = window.cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const totalBS = totalUSD * window.bcvRate;

  const cartTotalUSD = document.getElementById('cartTotalUSD');
  const cartTotalBS = document.getElementById('cartTotalBS');
  if (cartTotalUSD) cartTotalUSD.textContent = `$${totalUSD.toFixed(2)}`;
  if (cartTotalBS) cartTotalBS.textContent = `Bs. ${totalBS.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const cartItems = document.getElementById('cartItems');
  if (cartItems) {
    cartItems.innerHTML = window.cart.map(i => {
      const itemTotalBs = (i.price * i.qty * window.bcvRate).toFixed(2);
      return `
        <div class="flex items-center justify-between py-2 border-b text-xs">
          <div>
            <p class="font-bold text-gray-800">${i.name}</p>
            <p class="text-gray-500">$${Number(i.price).toFixed(2)} x ${i.qty}</p>
          </div>
          <div class="text-right">
            <span class="font-bold text-gray-900 block">$${(i.price * i.qty).toFixed(2)}</span>
            <span class="text-[10px] font-semibold text-emerald-700">Bs. ${itemTotalBs}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

window.cancelPurchase = () => {
  if (window.cart.length > 0) {
    if (!confirm('¿Estás seguro de que deseas cancelar la compra y vaciar el carrito?')) return;
  }
  window.cart = [];
  localStorage.removeItem('avocado_cart');
  updateCartUI();
  
  if (document.getElementById('buyerName')) document.getElementById('buyerName').value = '';
  if (document.getElementById('pmReference')) document.getElementById('pmReference').value = '';
  if (document.getElementById('deliveryAddress')) document.getElementById('deliveryAddress').value = '';
  
  document.getElementById('cartModal').classList.add('hidden');
};

window.processCheckout = () => {
  if (window.cart.length === 0) return alert('El carrito está vacío.');
  const buyerName = document.getElementById('buyerName').value.trim();
  const refNum = document.getElementById('pmReference').value.trim();
  const deliveryOption = document.getElementById('deliveryOption').value;
  const deliveryAddress = document.getElementById('deliveryAddress').value.trim();
  const selectedBranch = document.getElementById('cartBranchSelect').value;

  if (!buyerName) return alert('Por favor ingrese el nombre del comprador.');
  if (deliveryOption === 'delivery' && !deliveryAddress) return alert('Por favor ingrese la dirección de envío.');
  if (!refNum) return alert('Por favor ingrese la referencia.');

  const totalUSD = window.cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const totalBS = totalUSD * window.bcvRate;
  const orderId = 'AVO-' + Math.floor(100000 + Math.random() * 900000);

  const deliveryTypeLabel = deliveryOption === 'delivery' ? 'Delivery' : 'Retiro en Sucursal';
  const branchOrAddress = deliveryOption === 'delivery' ? deliveryAddress : selectedBranch;

  const newOrder = {
    orderId,
    clientName: buyerName,
    deliveryType: deliveryTypeLabel,
    branch: branchOrAddress,
    user: `${buyerName.toLowerCase().replace(/\s+/g, '')}@cliente.com`,
    items: [...window.cart],
    total: totalUSD,
    paymentReference: refNum,
    status: 'En Verificación',
    createdAt: new Date().toISOString()
  };

  window.orders.push(newOrder);
  saveState();
  filterAdminView();

  let msgText = `¡Hola Avocado Shop! Orden #${orderId}\n`;
  msgText += `Cliente: ${buyerName}\n`;
  msgText += `Tipo de Entrega: ${deliveryTypeLabel}\n`;
  if (deliveryOption === 'delivery') {
    msgText += `Dirección de Envío: ${deliveryAddress}\n`;
  } else {
    msgText += `Sucursal de Retiro: ${selectedBranch}\n`;
  }
  msgText += `Total USD: $${totalUSD.toFixed(2)}\n`;
  msgText += `Monto Pago Móvil: Bs. ${totalBS.toFixed(2)} (Tasa BCV: ${window.bcvRate.toFixed(2)})\n`;
  msgText += `Ref Pago Móvil: ${refNum}`;

  window.open(`https://wa.me/584143943252?text=${encodeURIComponent(msgText)}`, '_blank');

  window.cart = [];
  localStorage.removeItem('avocado_cart');
  updateCartUI();
  document.getElementById('cartModal').classList.add('hidden');
  alert(`Pedido #${orderId} registrado.`);
};

// ==========================================
// MÓDULO DE CITAS Y RESERVAS (SUPABASE)
// ==========================================
window.populateAppointmentSelects = async function() {
  const client = getSupabaseClient();
  if (!client) return;

  const serviceSelect = document.getElementById('appServiceSelect');
  const staffSelect = document.getElementById('appStaffSelect');

  const { data: serviciosData } = await client.from('servicios').select('*');
  if (serviceSelect && serviciosData && serviciosData.length > 0) {
    serviceSelect.innerHTML = '<option value="">Selecciona un servicio</option>' + 
      serviciosData.map(s => {
        const precio = Number(s.precio_usd ?? s.precio ?? 0);
        return `<option value="${s.id}" data-price="${precio}" data-name="${s.nombre}">${s.nombre} ($${precio.toFixed(2)})</option>`;
      }).join('');
  }

  const { data: staffData } = await client.from('manicuristas').select('*').eq('activo', true);
  if (staffSelect && staffData && staffData.length > 0) {
    staffSelect.innerHTML = '<option value="">Selecciona una especialista</option>' + 
      staffData.map(m => `<option value="${m.id}" data-name="${m.nombre}">${m.nombre} (${m.sucursal || 'San Félix'})</option>`).join('');
  }
};

window.handleCreateAppointment = async (e) => {
  e.preventDefault();

  const clientName = document.getElementById('appClientName').value.trim();
  const clientPhone = document.getElementById('appClientPhone').value.trim();
  const branch = document.getElementById('appBranchSelect').value;
  const serviceSelectElement = document.getElementById('appServiceSelect');
  const staffSelectElement = document.getElementById('appStaffSelect');
  const date = document.getElementById('appDate').value;
  const time = document.getElementById('appTimeSelect').value;

  if (!clientName || !clientPhone || !date || !time) {
    alert("Por favor completa todos los campos requeridos.");
    return;
  }

  const selectedServiceOption = serviceSelectElement.options[serviceSelectElement.selectedIndex];
  const serviceName = selectedServiceOption?.dataset?.name || selectedServiceOption?.text.split('(')[0].trim() || 'Servicio General';
  const servicePrice = parseFloat(selectedServiceOption?.dataset?.price) || 20.00;

  const selectedStaffOption = staffSelectElement.options[staffSelectElement.selectedIndex];
  const staffNameFinal = selectedStaffOption?.dataset?.name || selectedStaffOption?.text.split('(')[0].trim() || 'Asignación Automática';

  const sucursalEspecialistaFinal = `${branch} (${staffNameFinal})`;
  const fechaHoraISO = formatToISO(date, time);
  const client = getSupabaseClient();

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

async function loadAppointmentsFromSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    setTimeout(loadAppointmentsFromSupabase, 800);
    return;
  }
  
  const { data, error } = await client.from('appointments').select('*');
  if (error) return console.error('Error al cargar citas de Supabase:', error.message);

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

    if (error) return alert('No se pudo actualizar el estado en la base de datos.');
  }
  await loadAppointmentsFromSupabase();
};

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

    if (error) return alert('No se pudo eliminar la cita de la base de datos.');
  }
  await loadAppointmentsFromSupabase();
};

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

// ==========================================
// GESTIÓN DE MANICURISTAS Y SERVICIOS
// ==========================================
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

// ==========================================
// VISTAS DE ADMINISTRACIÓN Y REPORTES
// ==========================================
window.switchTab = (tabId) => {
  if (tabId === 'admin' && !isAdminAuthenticated) {
    const passwordEntered = prompt("🔑 Ingresa la clave de acceso al Panel Administrativo:");
    if (passwordEntered === null) return;

    let authBranch = null;
    for (const [branchKey, pass] of Object.entries(branchPasswords)) {
      if (pass === passwordEntered) {
        authBranch = branchKey;
        break;
      }
    }

    if (authBranch) {
      isAdminAuthenticated = true;
      activeAdminBranch = authBranch;
      masterAdminLoggedIn = (authBranch === "ALL");

      const adminSelect = document.getElementById('adminBranchFilter');
      if (adminSelect) {
        adminSelect.value = activeAdminBranch;
        adminSelect.disabled = !masterAdminLoggedIn;
      }

      const adminHeaderSub = document.getElementById('adminHeaderSub');
      if (adminHeaderSub) {
        adminHeaderSub.textContent = masterAdminLoggedIn 
          ? "Control Multi-Sucursal de Inventario, Vendedores y Facturación"
          : `Panel exclusivo para la Sucursal: ${activeAdminBranch}`;
      }

      filterAdminView();
    } else {
      alert("❌ Clave de acceso incorrecta. Acceso denegado.");
      return;
    }
  }

  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.remove('hidden');
};

window.logoutAdmin = () => {
  isAdminAuthenticated = false;
  activeAdminBranch = "ALL";
  masterAdminLoggedIn = false;
  switchTab('store');
  alert("🔒 Sesión administrativa cerrada.");
};

window.filterAdminView = () => {
  renderInventoryTable(activeAdminBranch);
  renderOrdersTable(activeAdminBranch);
  renderSellersTable(activeAdminBranch);
  updateBranchStats();

  const pBranchSelect = document.getElementById('pBranch');
  if (pBranchSelect) {
    if (activeAdminBranch !== "ALL") {
      pBranchSelect.value = activeAdminBranch;
      pBranchSelect.disabled = true;
    } else {
      pBranchSelect.disabled = false;
    }
  }
};

function renderInventoryTable(filterBranch = activeAdminBranch) {
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;
  const filtered = filterBranch === "ALL" ? window.products : window.products.filter(p => p.branch === filterBranch);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-slate-400">No hay productos registrados en esta sucursal.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const realIdx = window.products.findIndex(item => item.id === p.id);
    return `
      <tr>
        <td class="p-2.5 font-mono font-bold text-slate-700">${p.sku}</td>
        <td class="p-2.5 font-medium text-slate-900">${p.name}</td>
        <td class="p-2.5 text-slate-500">${p.category}</td>
        <td class="p-2.5 text-slate-500">${p.branch}</td>
        <td class="p-2.5 font-bold text-slate-800">$${Number(p.price).toFixed(2)}</td>
        <td class="p-2.5 font-bold ${p.stock <= 0 ? 'text-red-600' : 'text-slate-700'}">${p.stock}</td>
        <td class="p-2.5">
          ${p.stock <= 0 
            ? '<span class="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">AGOTADO</span>' 
            : '<span class="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">Disponible</span>'}
        </td>
        <td class="p-2.5 text-center flex justify-center gap-1.5">
          <button onclick="openEditProductModal(${realIdx})" title="Editar Producto" class="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded text-[10px] font-bold">✏️ Editar</button>
          <button onclick="addStockPrompt(${realIdx})" title="Añadir/Ajustar Stock" class="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded text-[10px] font-bold">➕ Stock</button>
          <button onclick="deleteProduct(${realIdx})" title="Eliminar Producto" class="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded text-[10px] font-bold">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderSellersTable(filterBranch = activeAdminBranch) {
  const tbody = document.getElementById('sellersTableBody');
  if (!tbody) return;
  const filtered = filterBranch === "ALL" ? window.sellers : window.sellers.filter(s => s.branch === filterBranch);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-slate-400">No hay vendedores registrados en esta sucursal.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((s) => {
    const realIndex = window.sellers.findIndex(item => item.id === s.id);
    return `
      <tr>
        <td class="p-2.5 font-medium text-slate-800">${s.name}</td>
        <td class="p-2.5 text-slate-500">${s.branch}</td>
        <td class="p-2.5 font-semibold text-slate-700">$${s.sales.toFixed(2)}</td>
        <td class="p-2.5 font-bold text-slate-800">${s.commRate}%</td>
        <td class="p-2.5 font-bold text-emerald-600">$${(s.sales * (s.commRate / 100)).toFixed(2)}</td>
        <td class="p-2.5 text-center flex justify-center gap-1.5">
          <button onclick="openEditSellerModal(${realIndex})" title="Editar Vendedor" class="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded text-[10px] font-bold">✏️ Editar</button>
          <button onclick="deleteSeller(${realIndex})" title="Eliminar Vendedor" class="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded text-[10px] font-bold">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderOrdersTable(filterBranch = activeAdminBranch) {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;
  const filtered = filterBranch === "ALL" ? window.orders : window.orders.filter(o => o.branch === filterBranch);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-slate-400">No hay órdenes registradas para esta sucursal.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    const realIndex = window.orders.findIndex(item => item.orderId === o.orderId);
    const isGlobalAccess = activeAdminBranch === "ALL";
    const currentStatus = o.status || 'En Verificación';
    const badgeClass = getStatusBadgeClass(currentStatus);

    return `
      <tr>
        <td class="p-2.5 font-bold">${o.orderId}</td>
        <td class="p-2.5">${o.clientName}</td>
        <td class="p-2.5 text-slate-500">${o.deliveryType || 'Retiro'} (${o.branch})</td>
        <td class="p-2.5 font-bold">$${o.total.toFixed(2)}</td>
        <td class="p-2.5">#${o.paymentReference}</td>
        <td class="p-2.5">
          <select onchange="changeOrderStatus(${realIndex}, this.value)" class="text-[10px] font-bold rounded-lg px-2 py-1 outline-none cursor-pointer ${badgeClass}">
            <option value="En Verificación" ${currentStatus === 'En Verificación' ? 'selected' : ''}>En Verificación</option>
            <option value="Procesado" ${currentStatus === 'Procesado' ? 'selected' : ''}>Procesado</option>
            <option value="Entregado" ${currentStatus === 'Entregado' ? 'selected' : ''}>Entregado</option>
            <option value="Cancelado" ${currentStatus === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </td>
        <td class="p-2.5 text-center flex justify-center gap-1.5">
          <button onclick="viewOrderModal('${o.orderId}')" class="bg-emerald-600 text-white px-2.5 py-1 rounded-md text-[10px] font-bold hover:bg-emerald-700 transition flex items-center gap-1">
            👁️ Ver / Facturar
          </button>
          ${isGlobalAccess ? `<button onclick="deleteOrder(${realIndex})" title="Eliminar Orden" class="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded-md text-[10px] font-bold">🗑️</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Procesado':
    case 'Entregado':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    case 'Cancelado':
    case 'Rechazado':
      return 'bg-red-100 text-red-800 border border-red-200';
    default:
      return 'bg-amber-100 text-amber-800 border border-amber-200';
  }
}

function updateBranchStats() {
  const branches = ["San Félix", "CC Alta Vista I", "CC Alta Vista II"];
  const ids = ["sanfelix", "altavista1", "altavista2"];

  branches.forEach((b, index) => {
    const branchSales = window.sellers.filter(s => s.branch === b).reduce((acc, s) => acc + s.sales, 0);
    const branchStock = window.products.filter(p => p.branch === b).reduce((acc, p) => acc + p.stock, 0);

    const statElem = document.getElementById(`stat-${ids[index]}`);
    const stockElem = document.getElementById(`stock-${ids[index]}`);

    if (statElem) statElem.textContent = `$${branchSales.toFixed(2)}`;
    if (stockElem) stockElem.textContent = `Stock: ${branchStock} unidades`;
  });

  const deliveryOrders = window.orders.filter(o => 
    (o.deliveryType === "Delivery" || o.deliveryType === "Envío por Delivery") &&
    o.status !== "Cancelado"
  );
  
  const totalDeliverySales = deliveryOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  const statDeliveryElem = document.getElementById('stat-delivery');
  const countDeliveryElem = document.getElementById('count-delivery');

  if (statDeliveryElem) statDeliveryElem.textContent = `$${totalDeliverySales.toFixed(2)}`;
  if (countDeliveryElem) countDeliveryElem.textContent = `${deliveryOrders.length} pedido(s) registrado(s)`;
}

// Configuración de eventos de la interfaz
function setupFilters() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderStoreProducts();
    });
  }

  document.querySelectorAll('.cat-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.cat-filter').forEach(b => {
        b.classList.remove('bg-emerald-600', 'text-white');
        b.classList.add('bg-white', 'text-gray-600');
      });
      e.target.classList.remove('bg-white', 'text-gray-600');
      e.target.classList.add('bg-emerald-600', 'text-white');

      renderStoreProducts();
    });
  });

  const btnOpenCart = document.getElementById('btnOpenCart');
  const btnCloseCart = document.getElementById('btnCloseCart');
  if (btnOpenCart) btnOpenCart.addEventListener('click', () => document.getElementById('cartModal').classList.remove('hidden'));
  if (btnCloseCart) btnCloseCart.addEventListener('click', () => document.getElementById('cartModal').classList.add('hidden'));
}

// Inicialización general al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  fetchLiveBcvRate();
  renderStoreProducts();
  setupFilters();

  const userBranchSelect = document.getElementById('userBranchSelect');
  if (userBranchSelect) {
    userBranchSelect.addEventListener('change', () => {
      renderStoreProducts();
    });
  }

  setTimeout(() => {
    if (window.loadAppointmentsFromSupabase) window.loadAppointmentsFromSupabase();
    if (window.populateAppointmentSelects) window.populateAppointmentSelects();
    if (window.loadStaffTable) window.loadStaffTable();
    if (window.loadServicesTable) window.loadServicesTable();
  }, 500);
});