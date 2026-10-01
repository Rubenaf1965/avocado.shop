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
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    let imageUrl = "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400";

    if (file && client) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await client.storage
          .from('products-images')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Error al subir la imagen:', uploadError.message);
          alert('Hubo un error al subir la imagen al Storage.');
          return;
        }

        const { data: urlData } = client.storage
          .from('products-images')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      } catch (err) {
        console.error("Error procesando la imagen:", err);
        return alert("Error procesando la imagen para el Storage.");
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
      if (data && data.length > 0) {
        window.products.push(data[0]);
      }
    } else {
      newProduct.id = Date.now().toString();
      window.products.push(newProduct);
    }
    
    alert("✅ Producto guardado exitosamente.");
  }

  if (typeof window.fetchProductsFromSupabase === 'function') {
    await window.fetchProductsFromSupabase();
  } else {
    renderStoreProducts();
    if (typeof filterAdminView === 'function') filterAdminView();
  }

  saveState();
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

window.processCheckout = async function() {
  try {
    const clientNameInput = document.getElementById('clientName') || document.querySelector('input[placeholder*="Nombre"]');
    const deliveryOptionSelect = document.getElementById('deliveryOption');
    const branchSelect = document.getElementById('branchSelect');
    const deliveryAddressInput = document.getElementById('deliveryAddressInput');
    const paymentRefInput = document.getElementById('paymentReference') || document.querySelector('input[placeholder*="235623"]');

    const clientName = clientNameInput ? clientNameInput.value.trim() : "Cliente";
    const deliveryType = deliveryOptionSelect ? deliveryOptionSelect.value : "pickup";
    const branch = branchSelect ? branchSelect.value : "San Félix";
    const deliveryAddress = deliveryAddressInput ? deliveryAddressInput.value.trim() : "";
    const paymentReference = paymentRefInput ? paymentRefInput.value.trim() : "";

    if (!clientName) {
      alert("Por favor ingresa el nombre del comprador.");
      return;
    }

    if (deliveryType === 'delivery' && !deliveryAddress) {
      alert("Por favor ingresa la dirección exacta de delivery.");
      return;
    }

    const orderId = 'AVO-' + Math.floor(100000 + Math.random() * 900000);
    const cartItems = window.cart || [];

    if (cartItems.length === 0) {
      alert("Tu carrito está vacío.");
      return;
    }

    const total = cartItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty || 1)), 0);

    const nuevaOrdenData = {
      orderId: orderId,
      clientName: clientName,
      deliveryType: deliveryType === 'delivery' ? `Delivery (${deliveryAddress})` : `Retiro en Sucursal (${branch})`,
      branch: branch,
      total: total,
      paymentReference: paymentReference,
      status: 'En Verificación',
      items: cartItems
    };

    if (typeof crearOrden === 'function') {
      await crearOrden(nuevaOrdenData);
    }

    const itemsText = cartItems.map(i => `• ${i.name || i.product_name} (x${i.qty || 1}) - $${Number(i.price * (i.qty || 1)).toFixed(2)}`).join('\n');
    const message = `*¡Nuevo Pedido!* (${orderId})\n\n*Cliente:* ${clientName}\n*Entrega:* ${nuevaOrdenData.deliveryType}\n*Ref. Pago:* ${paymentReference}\n\n*Productos:*\n${itemsText}\n\n*Total:* $${total.toFixed(2)}`;

    const whatsappNumber = "584143943252";
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');

    window.cart = [];
    localStorage.removeItem('avocado_cart');
    if (typeof updateCartUI === 'function') updateCartUI();

    const cartModal = document.getElementById('cartModal') || document.querySelector('.cart-modal') || document.getElementById('carritoModal');
    if (cartModal) {
      cartModal.classList.add('hidden');
    }
    alert("¡Pedido generado y enviado con éxito!");

  } catch (error) {
    console.error("Error en el proceso de checkout:", error);
    alert("Ocurrió un error al procesar el pedido. Revisa la consola.");
  }
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
    const comm = s.commRate || s.comision || 5;
    return `
      <tr>
        <td class="p-2.5 font-medium text-slate-800">${s.name}</td>
        <td class="p-2.5 text-slate-500">${s.branch}</td>
        <td class="p-2.5 font-semibold text-slate-700">$${s.sales.toFixed(2)}</td>
        <td class="p-2.5 font-bold text-slate-800">${comm}%</td>
        <td class="p-2.5 font-bold text-emerald-600">$${(s.sales * (comm / 100)).toFixed(2)}</td>
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
    const isGlobalAccess = activeAdminBranch === "ALL";
    const currentStatus = o.status || 'En Verificación';
    const badgeClass = getStatusBadgeClass(currentStatus);
    const identifier = o.id || o.orderId || o.order_id;

    return `
      <tr>
        <td class="p-2.5 font-bold">${o.orderId || o.order_id}</td>
        <td class="p-2.5">${o.clientName || o.client_name}</td>
        <td class="p-2.5 text-slate-500">${o.deliveryType || o.delivery_type || 'Retiro'} (${o.branch})</td>
        <td class="p-2.5 font-bold">$${Number(o.total || 0).toFixed(2)}</td>
        <td class="p-2.5">#${o.paymentReference || o.payment_reference || 'N/A'}</td>
        <td class="p-2.5">
          <select onchange="changeOrderStatus('${identifier}', this.value)" class="text-[10px] font-bold rounded-lg px-2 py-1 outline-none cursor-pointer ${badgeClass}">
            <option value="En Verificación" ${currentStatus === 'En Verificación' ? 'selected' : ''}>En Verificación</option>
            <option value="Procesado" ${currentStatus === 'Procesado' ? 'selected' : ''}>Procesado</option>
            <option value="Entregado" ${currentStatus === 'Entregado' ? 'selected' : ''}>Entregado</option>
            <option value="Cancelado" ${currentStatus === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </td>
        <td class="p-2.5 text-center flex justify-center gap-1.5">
          <button onclick="displayOrderDetails('${identifier}')" class="bg-emerald-600 text-white px-2.5 py-1 rounded-md text-[10px] font-bold hover:bg-emerald-700 transition flex items-center gap-1">
            👁️ Ver / Facturar
          </button>
          ${isGlobalAccess ? `<button onclick="deleteOrder('${identifier}')" title="Eliminar Orden" class="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded-md text-[10px] font-bold">🗑️</button>` : ''}
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
    // Sumar las ventas basándose en las órdenes reales de la sucursal (excluyendo canceladas)
    const branchOrders = (window.orders || []).filter(o => {
      const orderBranch = o.branch || '';
      const deliveryType = o.deliveryType || o.delivery_type || '';
      const belongsToBranch = orderBranch === b || deliveryType.includes(b);
      const isNotCancelled = o.status !== "Cancelado";
      return belongsToBranch && isNotCancelled;
    });

    const branchSales = branchOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const branchStock = window.products.filter(p => p.branch === b).reduce((acc, p) => acc + p.stock, 0);

    const statElem = document.getElementById(`stat-${ids[index]}`);
    const stockElem = document.getElementById(`stock-${ids[index]}`);

    if (statElem) statElem.textContent = `$${branchSales.toFixed(2)}`;
    if (stockElem) stockElem.textContent = `Stock: ${branchStock} unidades`;
  });

  const deliveryOrders = window.orders.filter(o => {
    const dType = o.deliveryType || o.delivery_type || '';
    return (dType.includes("Delivery") || dType.includes("Envío")) && o.status !== "Cancelado";
  });
  
  const totalDeliverySales = deliveryOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
  const statDeliveryElem = document.getElementById('stat-delivery');
  const countDeliveryElem = document.getElementById('count-delivery');

  if (statDeliveryElem) statDeliveryElem.textContent = `$${totalDeliverySales.toFixed(2)}`;
  if (countDeliveryElem) countDeliveryElem.textContent = `${deliveryOrders.length} pedido(s) registrado(s)`;
}
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

// ==========================================
// MÓDULO DE REPORTES Y GESTIÓN DE VENDEDORES
// ==========================================
window.closeScreenReport = function() {
  const modal = document.getElementById('screenReportModal');
  if (modal) modal.classList.add('hidden');
};

window.printInventoryReport = function() {
  window.print();
};

window.handleBranchAccessChange = function(selectElement) {
  if (typeof filterByBranch === 'function') {
    filterByBranch(selectElement.value);
  } else {
    activeAdminBranch = selectElement.value;
    filterAdminView();
  }
};

window.addSellerPrompt = function(event) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }

  const name = prompt("Nombre de la nueva vendedora:");
  if (!name || name.trim() === "") return;

  const branch = prompt("Sucursal asignada (San Félix / CC Alta Vista I / CC Alta Vista II):", "San Félix");
  const commissionInput = prompt("% de Comisión (ej: 5):", "5");
  const parsedCommission = parseFloat(String(commissionInput || '5').replace('%', '').trim()) || 5;

  if (typeof registerNewSeller === 'function') {
    registerNewSeller(name.trim(), branch, parsedCommission);
  } else if (typeof window.sellers !== 'undefined') {
    window.sellers.push({
      id: "s_" + Date.now(),
      name: name.trim(),
      branch: branch,
      sales: 0,
      comision: parsedCommission,
      commRate: parsedCommission
    });
    saveState();
    if (typeof renderSellersTable === 'function') {
      renderSellersTable(activeAdminBranch);
    } else {
      location.reload();
    }
  }
};

window.openEditSellerModal = function(id) {
  const modal = document.getElementById('editSellerModal');
  if (modal) modal.classList.remove('hidden');
  if (typeof loadSellerData === 'function') loadSellerData(id);
};

window.closeEditSellerModal = function() {
  const modal = document.getElementById('editSellerModal');
  if (modal) modal.classList.add('hidden');
};

window.deleteSeller = function(idOrIndex) {
  if (confirm("¿Estás seguro de eliminar este vendedor?")) {
    if (typeof removeSeller === 'function') {
      removeSeller(idOrIndex);
    } else if (typeof window.sellers !== 'undefined') {
      window.sellers.splice(idOrIndex, 1);
      saveState();
      renderSellersTable(activeAdminBranch);
    }
  }
};

window.displayInventoryScreen = async function() {
  const client = getSupabaseClient();
  let productos = [];

  if (client) {
    const { data, error } = await client.from('products').select('*');
    if (!error && data) {
      productos = data;
      window.products = data;
    }
  } else {
    productos = window.products || [];
  }

  // Filtro estricto por sucursal activa
  const sucursalActiva = (typeof activeAdminBranch !== 'undefined' && activeAdminBranch) ? activeAdminBranch : (localStorage.getItem('currentBranch') || 'ALL');

  const productosFiltrados = productos.filter(producto => {
    if (!sucursalActiva || sucursalActiva === 'Todas' || sucursalActiva === 'Todas las Sucursales' || sucursalActiva === 'ALL') {
      return true;
    }
    const branchField = producto.branch || producto.sucursal || '';
    return String(branchField).trim().toLowerCase() === String(sucursalActiva).trim().toLowerCase();
  });

  let modal = document.getElementById('inventoryReportModal') || 
              document.getElementById('inventoryScreenModal') || 
              document.getElementById('modalReporteInventario');

  if (!modal) {
    const elementosDiv = document.querySelectorAll('div');
    for (let div of elementosDiv) {
      if (div.innerText && div.innerText.includes('Reporte General de Inventario')) {
        modal = div.closest('.fixed') || div.closest('.modal') || div.parentElement;
        break;
      }
    }
  }

  if (!modal) return;

  const tbody = modal.querySelector('tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  let totalUnidades = 0;
  const tasaBcv = window.currentBcvRate || getActiveBcvRate();

  productosFiltrados.forEach(prod => {
    const stockVal = parseInt(prod.stock || 0);
    totalUnidades += stockVal;
    const precioUsd = parseFloat(prod.price || 0);
    const precioBs = precioUsd * tasaBcv;
    
    tbody.innerHTML += `
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 10px;">${prod.sku || 'N/A'}</td>
        <td style="padding: 10px;">${prod.name}</td>
        <td style="padding: 10px;">${prod.category}</td>
        <td style="padding: 10px;">${prod.branch || prod.sucursal || 'N/A'}</td>
        <td style="padding: 10px;">$${precioUsd.toFixed(2)}</td>
        <td style="padding: 10px;">Bs. ${precioBs.toFixed(2)}</td>
        <td style="padding: 10px; font-weight: bold;">${stockVal}</td>
      </tr>
    `;
  });

  const fechaActual = new Date().toLocaleDateString('es-VE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  
  modal.querySelectorAll('span, p, div').forEach(el => {
    if (el.children.length === 0 && el.innerText) {
      if (el.innerText.includes('Fecha:')) {
        el.innerText = `Fecha: ${fechaActual}`;
      }
      if (el.innerText.includes('Tasa BCV:')) {
        el.innerText = `Tasa BCV: Bs. ${tasaBcv}`;
      }
      if (el.innerText.includes('Total Productos:')) {
        el.innerHTML = `Total Productos: <b>${productosFiltrados.length}</b> &nbsp;&nbsp;&nbsp;&nbsp; Unidades Totales: <b>${totalUnidades}</b>`;
      }
    }
  });

  const botonesCerrar = modal.querySelectorAll('button, svg, path');
  botonesCerrar.forEach(btn => {
    if (btn.innerText && btn.innerText.trim() === 'Cerrar') {
      btn.onclick = (e) => {
        e.preventDefault();
        modal.style.display = 'none';
        modal.classList.add('hidden');
      };
    }
  });

  const btnX = modal.querySelector('button.absolute, button svg, .close-modal');
  if (btnX) {
    const closeBtnElement = btnX.closest('button') || btnX;
    closeBtnElement.onclick = (e) => {
      e.preventDefault();
      modal.style.display = 'none';
      modal.classList.add('hidden');
    };
  }

  modal.style.display = 'block';
  modal.classList.add('hidden');
};


// ==========================================
// GESTIÓN DE ÓRDENES Y FACTURACIÓN
// ==========================================
window.deleteOrder = async function(orderIdOrIdentifier) {
  if (!orderIdOrIdentifier) {
    alert("Error: Identificador de orden inválido.");
    return;
  }

  if (!confirm("¿Estás seguro de que deseas eliminar esta orden?")) return;

  const client = getSupabaseClient();
  if (client) {
    const isNumericOrUuid = !String(orderIdOrIdentifier).startsWith('AVO-');
    const queryField = isNumericOrUuid ? 'id' : 'order_id';

    const { error } = await client.from('orders').delete().eq(queryField, orderIdOrIdentifier);
    if (error) {
      alert("Error al eliminar la orden en Supabase: " + error.message);
      return;
    }
  }

  window.orders = (window.orders || []).filter(o => o.id !== orderIdOrIdentifier && o.orderId !== orderIdOrIdentifier && o.order_id !== orderIdOrIdentifier);
  saveState();
  
  if (typeof filterAdminView === 'function') filterAdminView();
  alert("🗑️ Orden eliminada exitosamente.");
};

window.changeOrderStatus = async function(orderIdOrIdentifier, newStatus) {
  const client = getSupabaseClient();
  
  let order = (window.orders || []).find(o => 
    String(o.id) === String(orderIdOrIdentifier) || 
    String(o.orderId) === String(orderIdOrIdentifier) || 
    String(o.order_id) === String(orderIdOrIdentifier)
  );

  if (!order) {
    alert("No se encontró la información local de la orden.");
    return;
  }

  order.status = newStatus;

  if (newStatus === 'Procesado' || newStatus === 'Completado' || newStatus === 'Entregado') {
    const itemsList = order.items || order.items_json;
    if (itemsList && Array.isArray(itemsList)) {
      for (let item of itemsList) {
        const prodId = item.id || item.product_id;
        const qtyToSubtract = Number(item.qty || item.quantity || 1);

        if (client && prodId) {
          const { data: prodData } = await client
            .from('products')
            .select('stock, id')
            .eq('id', prodId)
            .single();

          if (prodData) {
            const nuevoStock = Math.max(0, Number(prodData.stock) - qtyToSubtract);
            await client
              .from('products')
              .update({ stock: nuevoStock })
              .eq('id', prodId);
          }
        }

        if (window.products && Array.isArray(window.products)) {
          const localProd = window.products.find(p => p.id == prodId);
          if (localProd) {
            localProd.stock = Math.max(0, Number(localProd.stock) - qtyToSubtract);
          }
        }
      }
    }
  }

  if (client) {
    const isAvsCode = String(orderIdOrIdentifier).startsWith('AVO-');
    const queryField = isAvsCode ? 'order_id' : 'id';
    const targetValue = order.orderId || order.order_id || orderIdOrIdentifier;

    const { error: updateError } = await client
      .from('orders')
      .update({ status: newStatus })
      .eq(queryField, targetValue);

    if (updateError) {
      console.error("Error al actualizar estado en Supabase:", updateError.message);
    }
  }

  saveState();
  if (typeof renderStoreProducts === 'function') renderStoreProducts();
  if (typeof updateBranchStats === 'function') updateBranchStats();
  if (typeof filterAdminView === 'function') filterAdminView();
};

window.crearOrden = async function(nuevaOrdenData) {
  const client = getSupabaseClient();
  
  const dbPayload = {
    order_id: nuevaOrdenData.orderId,
    client_name: nuevaOrdenData.clientName,
    delivery_type: nuevaOrdenData.deliveryType,
    branch: nuevaOrdenData.branch,
    user_email: nuevaOrdenData.user || `${nuevaOrdenData.clientName.toLowerCase().replace(/\s+/g, '')}@cliente.com`,
    total: nuevaOrdenData.total,
    payment_reference: nuevaOrdenData.paymentReference,
    status: nuevaOrdenData.status || 'En Verificación',
    items: nuevaOrdenData.items
  };

  if (client) {
    const { data, error } = await client.from('orders').insert([dbPayload]).select();
    if (error) {
      console.error("Error al guardar la orden en Supabase:", error.message);
      alert("Error al guardar la orden en Supabase: " + error.message);
      return null;
    }
    if (data && data.length > 0) {
      nuevaOrdenData.id = data[0].id;
    }
  }

  window.orders = window.orders || [];
  window.orders.unshift(nuevaOrdenData);
  saveState();
  
  if (typeof filterAdminView === 'function') filterAdminView();
  return nuevaOrdenData;
};

window.searchOrderTracking = function() {
  const input = document.getElementById('trackingInput') || document.querySelector('input[placeholder*="AVO-"]');
  if (!input) return;
  const code = input.value.trim();
  
  if (!code) {
    alert("Por favor ingresa un código de orden.");
    return;
  }

  const foundOrder = (window.orders || []).find(o => (o.orderId || o.order_id) === code);
  
  if (foundOrder) {
    alert(`¡Orden Encontrada!\n\n• Código: ${foundOrder.orderId || foundOrder.order_id}\n• Cliente: ${foundOrder.clientName || foundOrder.client_name}\n• Estado: ${foundOrder.status}\n• Total: $${foundOrder.total}`);
  } else {
    alert("No se encontró ninguna orden registrada con el código: " + code);
  }
};

window.toggleDeliveryAddress = function(selectElement) {
  const selectedValue = selectElement.value;
  const addressContainer = document.getElementById('deliveryAddressContainer');
  const branchContainer = document.getElementById('branchContainer') || document.querySelector('.branch-selection-container'); 

  if (!addressContainer) return;

  const isDelivery = selectedValue === 'delivery' || selectedValue.toLowerCase().includes('delivery');

  if (isDelivery) {
    addressContainer.innerHTML = `
      <label class="block text-[11px] font-bold text-gray-700 mb-1">Dirección Exacta de Delivery:</label>
      <input type="text" id="deliveryAddressInput" placeholder="Ej: Urbanización, Calle, Casa/Edificio..." class="w-full border rounded-lg p-2 text-xs outline-none bg-white font-medium">
    `;
    addressContainer.style.display = 'block';

    if (branchContainer) {
      branchContainer.style.display = 'none';
    }
  } else {
    addressContainer.style.display = 'none';
    addressContainer.innerHTML = '';

    if (branchContainer) {
      branchContainer.style.display = 'block';
    }
  }
};

window.displayOrderDetails = function(orderIdOrIdentifier) {
  const ordersList = window.orders || [];

  let order = ordersList.find(o => 
    String(o.id) === String(orderIdOrIdentifier) || 
    String(o.orderId) === String(orderIdOrIdentifier) || 
    String(o.order_id) === String(orderIdOrIdentifier)
  );

  if (!order) {
    console.warn("Orden no encontrada en memoria local con el identificador:", orderIdOrIdentifier);
    alert("No se encontró la información de la orden.");
    return;
  }

  // Obtener la tasa BCV actual (si está definida globalmente en tu app, ej: window.bcvRate o un valor por defecto)
  const bcvRate = window.bcvRate || 859.06; // Puedes ajustarlo según tu variable de tasa
  const totalUSD = Number(order.total || 0);
  const totalBs = totalUSD * bcvRate;

  const itemsList = order.items || order.items_json || [];
  const itemsHtml = Array.isArray(itemsList) && itemsList.length > 0 ? itemsList.map(item => {
    const itemSubtotal = (Number(item.price || 0) * Number(item.qty || item.quantity || 1));
    return `
      <tr class="border-b border-slate-100">
        <td class="p-2.5">${item.name || item.product_name || 'Producto'} (x${item.qty || item.quantity || 1})</td>
        <td class="p-2.5 text-right font-medium">$${itemSubtotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="2" class="p-2.5 text-xs text-gray-500 text-center">Sin detalles de productos</td></tr>';

  const existingModal = document.getElementById('orderDetailsModal');
  if (existingModal) existingModal.remove();

  const modalContainer = document.createElement('div');
  modalContainer.id = 'orderDetailsModal';
  modalContainer.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:bg-white print:fixed print:inset-0 p-4';
  
  modalContainer.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-auto overflow-hidden print:shadow-none print:w-full print:max-w-none print:m-0">
      
      <!-- Cabecera del Modal (Oculta al imprimir) -->
      <div class="flex justify-between items-center bg-slate-900 text-white px-6 py-4 print:hidden">
        <h3 class="text-lg font-semibold">Detalles de Orden: ${order.orderId || order.order_id || order.id}</h3>
        <button onclick="document.getElementById('orderDetailsModal').remove()" class="text-slate-400 hover:text-white text-xl font-bold px-2">&times;</button>
      </div>

      <!-- Cuerpo de la Factura / Orden (Se imprime esta sección) -->
      <div class="p-6 space-y-4 text-slate-700 print:p-8">
        
        <!-- Encabezado para impresión con el Aguacate -->
        <div class="hidden print:block text-center mb-6">
          <div class="flex items-center justify-center gap-2">
            <span class="text-2xl">🥑</span>
            <h1 class="text-2xl font-bold text-slate-900">Avocado Shop</h1>
          </div>
          <p class="text-sm text-slate-500">Insumos de uñas, cejas y pestañas</p>
          <p class="text-xs text-slate-400 mt-1">Comprobante de Venta / Factura</p>
          <hr class="my-3 border-slate-200" />
        </div>

        <!-- Información General -->
        <div class="space-y-1.5 text-sm">
          <p><strong class="text-slate-900">Cliente:</strong> ${order.clientName || order.client_name || order.client || 'Cliente'}</p>
          <p><strong class="text-slate-900">Tipo de Entrega:</strong> ${order.deliveryType || order.delivery_type || 'Retiro'}</p>
          <p>
            <strong class="text-slate-900">Estado:</strong> 
            <span class="inline-block px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full">
              ${order.status || 'Procesado'}
            </span>
          </p>
          <p><strong class="text-slate-900">Referencia de Pago:</strong> ${order.paymentReference || order.payment_reference || order.paymentRef || 'N/A'}</p>
        </div>

        <hr class="border-slate-200" />

        <!-- Listado de Productos -->
        <div>
          <h4 class="text-sm font-semibold text-slate-900 mb-2">Productos:</h4>
          <div class="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th class="p-2.5">Descripción</th>
                  <th class="p-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${itemsHtml}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Totales (Dólares y Bolívares) -->
        <div class="pt-2 border-t border-slate-200 space-y-1 text-right">
          <div class="flex justify-between items-center text-base font-bold text-slate-900">
            <span>Total a Pagar:</span>
            <span class="text-emerald-600">$${totalUSD.toFixed(2)}</span>
          </div>
          <div class="flex justify-between items-center text-xs font-medium text-slate-500">
            <span>Equivalente en Bs. (Tasa BCV: ${bcvRate}):</span>
            <span>Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

      </div>

      <!-- Pie de Página / Botones de Acción (Oculto al imprimir) -->
      <div class="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-200 print:hidden">
        <!-- Botón de Eliminar Orden -->
        <button onclick="if(confirm('¿Estás seguro de eliminar esta orden?')) { deleteOrder('${order.id || order.orderId}'); document.getElementById('orderDetailsModal').remove(); }" class="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium rounded-lg text-xs flex items-center gap-1 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          Eliminar Orden
        </button>

        <div class="flex gap-3">
          <button onclick="document.getElementById('orderDetailsModal').remove()" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg text-sm transition">
            Cerrar
          </button>
          <button onclick="window.print()" class="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-lg text-sm flex items-center gap-2 transition shadow-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-4 0v4H8v-4m4-8h4m-4 4h4" />
            </svg>
            Generar Factura e Imprimir
          </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(modalContainer);
};