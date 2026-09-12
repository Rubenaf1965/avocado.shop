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

// Función aux para convertir archivos de imagen a Base64
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
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

let initialProducts = [
  { id: "1", sku: "RUB-001", name: "Rubber Base Avocado Gel 15ml", category: "Preparadores y Bases", branch: "San Félix", price: 12.00, stock: 25, image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400" },
  { id: "2", sku: "LAM-080", name: "Lámpara LED UV Sun X5 Plus 80W", category: "Herramientas y Lámparas", branch: "San Félix", price: 35.00, stock: 10, image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400" },
  { id: "3", sku: "POL-060", name: "Polygel Nude Construction 60g", category: "Sistemas Constructores", branch: "CC Alta Vista I", price: 18.50, stock: 15, image: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=400" },
  { id: "4", sku: "TOP-015", name: "Top Coat No Wipe Ultra Shine", category: "Preparadores y Bases", branch: "CC Alta Vista II", price: 10.00, stock: 0, image: "https://images.unsplash.com/photo-1599948128020-9a44505b0d1b?w=400" }
];

let initialSellers = [
  { id: "s1", name: "María Delgado", branch: "San Félix", sales: 1240.00, commRate: 5 },
  { id: "s2", name: "Andrea Gómez", branch: "CC Alta Vista I", sales: 850.00, commRate: 5 },
  { id: "s3", name: "Carla Rivas", branch: "CC Alta Vista II", sales: 410.00, commRate: 5 }
];

let initialOrders = [
  {
    orderId: "AVO-849201",
    clientName: "María Delgado",
    deliveryType: "Retiro en Sucursal",
    branch: "San Félix",
    user: "m.delgado@gmail.com",
    createdAt: new Date().toISOString(),
    status: "Procesado",
    paymentReference: "984102",
    total: 107.50,
    items: [
      { sku: "RUB-001", name: "Rubber Base Avocado Gel 15ml", qty: 2, price: 12.00 },
      { sku: "LAM-080", name: "Lámpara LED UV Sun X5 Plus 80W", qty: 1, price: 35.00 }
    ]
  }
];

let products = JSON.parse(localStorage.getItem('avocado_products')) || initialProducts;
let sellers = JSON.parse(localStorage.getItem('avocado_sellers')) || initialSellers;
let orders = JSON.parse(localStorage.getItem('avocado_orders')) || initialOrders;
let cart = JSON.parse(localStorage.getItem('avocado_cart')) || [];

function saveState() {
  localStorage.setItem('avocado_products', JSON.stringify(products));
  localStorage.setItem('avocado_sellers', JSON.stringify(sellers));
  localStorage.setItem('avocado_orders', JSON.stringify(orders));
}

document.addEventListener('DOMContentLoaded', () => {
  fetchLiveBcvRate();
  renderStoreProducts();
  renderInventoryTable();
  renderSellersTable();
  renderOrdersTable();
  updateCartUI();
  setupFilters();
  updateBranchStats();

  document.getElementById('userBranchSelect').addEventListener('change', () => {
    renderStoreProducts();
  });
});

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
      adminSelect.value = activeAdminBranch;
      adminSelect.disabled = !masterAdminLoggedIn;

      document.getElementById('adminHeaderSub').textContent = masterAdminLoggedIn 
        ? "Control Multi-Sucursal de Inventario, Vendedores y Facturación"
        : `Panel exclusivo para la Sucursal: ${activeAdminBranch}`;

      filterAdminView();
    } else {
      alert("❌ Clave de acceso incorrecta. Acceso denegado.");
      return;
    }
  }

  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(`tab-${tabId}`).classList.remove('hidden');
};

window.logoutAdmin = () => {
  isAdminAuthenticated = false;
  activeAdminBranch = "ALL";
  masterAdminLoggedIn = false;
  switchTab('store');
  alert("🔒 Sesión administrativa cerrada.");
};

window.handleBranchAccessChange = (selectElem) => {
  if (!masterAdminLoggedIn) return;

  const selectedBranch = selectElem.value;
  if (selectedBranch === activeAdminBranch) return;

  activeAdminBranch = selectedBranch;
  filterAdminView();
};

function renderStoreProducts() {
  const selectedBranch = document.getElementById('userBranchSelect').value;
  const activeCat = document.querySelector('.cat-filter.active')?.getAttribute('data-cat') || 'all';
  const searchVal = document.getElementById('searchInput').value.toLowerCase();

  let filtered = products;

  if (selectedBranch !== "ALL") {
    filtered = filtered.filter(p => p.branch === selectedBranch);
  }

  if (activeCat !== 'all') {
    filtered = filtered.filter(p => p.category === activeCat);
  }

  if (searchVal) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(searchVal));
  }

  renderProducts(filtered);
}

function renderProducts(items) {
  const grid = document.getElementById('productGrid');
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
            <img src="${p.image}" alt="${p.name}" class="w-full h-44 object-cover rounded-xl ${isOut ? 'grayscale opacity-75' : ''}">
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
            <span class="text-base font-extrabold text-gray-900">$${p.price.toFixed(2)}</span>
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

window.addToCart = (id) => {
  const product = products.find(p => p.id === id);
  if (!product || product.stock <= 0) return;
  
  const existing = cart.find(item => item.id === id);
  if (existing) {
    if (existing.qty < product.stock) {
      existing.qty++;
    } else {
      alert('Límite de stock alcanzado.');
      return;
    }
  } else { 
    cart.push({ ...product, qty: 1 }); 
  }
  localStorage.setItem('avocado_cart', JSON.stringify(cart));
  updateCartUI();
};

function updateCartUI() {
  document.getElementById('cartBadge').textContent = cart.reduce((acc, i) => acc + i.qty, 0);
  const totalUSD = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const totalBS = totalUSD * window.bcvRate;

  document.getElementById('cartTotalUSD').textContent = `$${totalUSD.toFixed(2)}`;
  document.getElementById('cartTotalBS').textContent = `Bs. ${totalBS.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  document.getElementById('cartItems').innerHTML = cart.map(i => {
    const itemTotalBs = (i.price * i.qty * window.bcvRate).toFixed(2);
    return `
      <div class="flex items-center justify-between py-2 border-b text-xs">
        <div>
          <p class="font-bold text-gray-800">${i.name}</p>
          <p class="text-gray-500">$${i.price.toFixed(2)} x ${i.qty}</p>
        </div>
        <div class="text-right">
          <span class="font-bold text-gray-900 block">$${(i.price * i.qty).toFixed(2)}</span>
          <span class="text-[10px] font-semibold text-emerald-700">Bs. ${itemTotalBs}</span>
        </div>
      </div>
    `;
  }).join('');
}

window.cancelPurchase = () => {
  if (cart.length > 0) {
    if (!confirm('¿Estás seguro de que deseas cancelar la compra y vaciar el carrito?')) {
      return;
    }
  }
  cart = [];
  localStorage.removeItem('avocado_cart');
  updateCartUI();
  
  document.getElementById('buyerName').value = '';
  document.getElementById('pmReference').value = '';
  document.getElementById('deliveryAddress').value = '';
  
  document.getElementById('cartModal').classList.add('hidden');
};

window.processCheckout = () => {
  if (cart.length === 0) return alert('El carrito está vacío.');
  const buyerName = document.getElementById('buyerName').value.trim();
  const refNum = document.getElementById('pmReference').value.trim();
  const deliveryOption = document.getElementById('deliveryOption').value;
  const deliveryAddress = document.getElementById('deliveryAddress').value.trim();
  const selectedBranch = document.getElementById('cartBranchSelect').value;

  if (!buyerName) return alert('Por favor ingrese el nombre del comprador.');
  if (deliveryOption === 'delivery' && !deliveryAddress) return alert('Por favor ingrese la dirección de envío.');
  if (!refNum) return alert('Por favor ingrese la referencia.');

  const totalUSD = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
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
    items: [...cart],
    total: totalUSD,
    paymentReference: refNum,
    status: 'En Verificación',
    createdAt: new Date().toISOString()
  };

  orders.push(newOrder);
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

  const msg = encodeURIComponent(msgText);
  window.open(`https://wa.me/584143943252?text=${msg}`, '_blank');

  cart = [];
  localStorage.removeItem('avocado_cart');
  updateCartUI();
  document.getElementById('cartModal').classList.add('hidden');
  alert(`Pedido #${orderId} registrado.`);
};

window.searchOrderTracking = () => {
  const code = document.getElementById('trackInput').value.trim();
  const order = orders.find(o => o.orderId.toLowerCase() === code.toLowerCase());
  const resultDiv = document.getElementById('trackResult');

  if (order) {
    document.getElementById('trackClient').textContent = order.clientName;
    document.getElementById('trackDeliveryType').textContent = order.deliveryType || 'Retiro en Sucursal';
    document.getElementById('trackBranch').textContent = order.branch;
    document.getElementById('trackRef').textContent = order.paymentReference;
    document.getElementById('trackTotal').textContent = `$${order.total.toFixed(2)} (Bs. ${(order.total * window.bcvRate).toFixed(2)})`;
    document.getElementById('trackStatus').textContent = order.status;
    
    document.getElementById('btnDownloadTrackInvoice').onclick = () => window.generateInvoicePDF(order, window.bcvRate);
    resultDiv.classList.remove('hidden');
  } else {
    alert('Código de orden no encontrado.');
    resultDiv.classList.add('hidden');
  }
};

function renderInventoryTable(filterBranch = activeAdminBranch) {
  const tbody = document.getElementById('inventoryTableBody');
  const filtered = filterBranch === "ALL" ? products : products.filter(p => p.branch === filterBranch);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-slate-400">No hay productos registrados en esta sucursal.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const realIdx = products.findIndex(item => item.id === p.id);
    return `
      <tr>
        <td class="p-2.5 font-mono font-bold text-slate-700">${p.sku}</td>
        <td class="p-2.5 font-medium text-slate-900">${p.name}</td>
        <td class="p-2.5 text-slate-500">${p.category}</td>
        <td class="p-2.5 text-slate-500">${p.branch}</td>
        <td class="p-2.5 font-bold text-slate-800">$${p.price.toFixed(2)}</td>
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

window.openEditProductModal = (idx) => {
  const prod = products[idx];
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
  products[idx].name = document.getElementById('editPName').value;
  products[idx].category = document.getElementById('editPCategory').value;
  
  if (masterAdminLoggedIn) {
    products[idx].branch = document.getElementById('editPBranch').value;
  }

  products[idx].price = parseFloat(document.getElementById('editPPrice').value);
  products[idx].stock = parseInt(document.getElementById('editPStock').value);

  const fileInput = document.getElementById('editPImage');
  if (fileInput.files && fileInput.files[0]) {
    try {
      products[idx].image = await readFileAsBase64(fileInput.files[0]);
    } catch (err) {
      alert("Error al cargar la nueva imagen.");
      return;
    }
  }

  saveState();
  renderStoreProducts();
  filterAdminView();
  closeEditProductModal();
};

window.displayInventoryScreen = () => {
  const filterBranch = activeAdminBranch;
  const filtered = filterBranch === "ALL" ? products : products.filter(p => p.branch === filterBranch);

  document.getElementById('reportBranchSubtitle').textContent = filterBranch === "ALL" 
    ? "Sucursales: Todas las Sedes" 
    : `Sucursal: ${filterBranch}`;

  document.getElementById('reportDate').textContent = new Date().toLocaleDateString('es-VE');
  document.getElementById('reportBcv').textContent = `Bs. ${window.bcvRate.toFixed(2)}`;

  const tbody = document.getElementById('screenReportBody');
  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td class="p-2 font-mono font-bold">${p.sku}</td>
      <td class="p-2 font-semibold">${p.name}</td>
      <td class="p-2 text-gray-500">${p.category}</td>
      <td class="p-2 text-gray-500">${p.branch}</td>
      <td class="p-2 text-right font-bold">$${p.price.toFixed(2)}</td>
      <td class="p-2 text-right text-emerald-700 font-bold">Bs. ${(p.price * window.bcvRate).toFixed(2)}</td>
      <td class="p-2 text-center font-bold ${p.stock <= 0 ? 'text-red-600' : 'text-gray-800'}">${p.stock}</td>
    </tr>
  `).join('');

  document.getElementById('reportTotalItems').textContent = `Total Productos: ${filtered.length}`;
  document.getElementById('reportTotalStock').textContent = `Unidades Totales: ${filtered.reduce((acc, p) => acc + p.stock, 0)}`;

  document.getElementById('screenReportModal').classList.remove('hidden');
};

window.closeScreenReport = () => {
  document.getElementById('screenReportModal').classList.add('hidden');
};

window.printInventoryReport = () => {
  if (document.getElementById('screenReportModal').classList.contains('hidden')) {
    window.displayInventoryScreen();
  }
  setTimeout(() => {
    window.print();
  }, 300);
};

window.addStockPrompt = (idx) => {
  const prod = products[idx];
  const qtyToAdd = prompt(`Añadir stock a: "${prod.name}" (${prod.branch})\nStock actual: ${prod.stock}\n\nCantidad a sumar:`, "10");
  if (qtyToAdd === null) return;

  const parsedQty = parseInt(qtyToAdd);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    alert("Ingrese una cantidad válida.");
    return;
  }

  products[idx].stock += parsedQty;
  saveState();
  renderStoreProducts();
  filterAdminView();
};

window.deleteProduct = (idx) => {
  const prod = products[idx];
  if (confirm(`¿Eliminar "${prod.name}" de ${prod.branch}?`)) {
    products.splice(idx, 1);
    saveState();
    renderStoreProducts();
    filterAdminView();
  }
};

function renderSellersTable(filterBranch = activeAdminBranch) {
  const tbody = document.getElementById('sellersTableBody');
  const filtered = filterBranch === "ALL" ? sellers : sellers.filter(s => s.branch === filterBranch);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-slate-400">No hay vendedores registrados en esta sucursal.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((s) => {
    const realIndex = sellers.findIndex(item => item.id === s.id);
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

window.openEditSellerModal = (idx) => {
  const seller = sellers[idx];
  document.getElementById('editSIdx').value = idx;
  document.getElementById('editSName').value = seller.name;
  
  const branchSelect = document.getElementById('editSBranch');
  branchSelect.value = seller.branch;
  branchSelect.disabled = !masterAdminLoggedIn;

  document.getElementById('editSSales').value = seller.sales;
  document.getElementById('editSCommRate').value = seller.commRate;
  document.getElementById('editSellerModal').classList.remove('hidden');
};

window.closeEditSellerModal = () => {
  document.getElementById('editSellerModal').classList.add('hidden');
};

window.saveEditedSeller = (e) => {
  e.preventDefault();
  const idx = document.getElementById('editSIdx').value;
  sellers[idx].name = document.getElementById('editSName').value;
  
  if (masterAdminLoggedIn) {
    sellers[idx].branch = document.getElementById('editSBranch').value;
  }

  sellers[idx].sales = parseFloat(document.getElementById('editSSales').value);
  sellers[idx].commRate = parseFloat(document.getElementById('editSCommRate').value);

  saveState();
  filterAdminView();
  closeEditSellerModal();
};

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Procesado':
    case 'Entregado':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    case 'Cancelado':
    case 'Rechazado':
      return 'bg-red-100 text-red-800 border border-red-200';
    case 'En Verificación':
    case 'Pendiente':
    default:
      return 'bg-amber-100 text-amber-800 border border-amber-200';
  }
}

function renderOrdersTable(filterBranch = activeAdminBranch) {
  const tbody = document.getElementById('ordersTableBody');
  const filtered = filterBranch === "ALL" ? orders : orders.filter(o => o.branch === filterBranch);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-slate-400">No hay órdenes registradas para esta sucursal.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    const realIndex = orders.findIndex(item => item.orderId === o.orderId);
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

window.changeOrderStatus = (idx, newStatus) => {
  orders[idx].status = newStatus;
  saveState();
  filterAdminView();
};

window.viewOrderModal = (orderId) => {
  const order = orders.find(o => o.orderId === orderId);
  if (!order) return alert('Orden no encontrada.');

  activeModalOrder = order;

  const dateObj = order.createdAt ? new Date(order.createdAt) : new Date();
  const formattedDate = dateObj.toLocaleDateString('es-VE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const totalBs = order.total * window.bcvRate;

  document.getElementById('orderModalSubtitle').textContent = `Orden N° ${order.orderId} • Cliente: ${order.clientName}`;
  document.getElementById('modalOrderId').textContent = `N° ${order.orderId}`;
  document.getElementById('modalOrderDate').textContent = `Fecha: ${formattedDate}`;

  document.getElementById('modalClientName').textContent = order.clientName;
  document.getElementById('modalClientEmail').textContent = order.user || 'cliente@avocadoshop.com';

  document.getElementById('modalDeliveryType').textContent = order.deliveryType || 'Retiro en Sucursal';
  document.getElementById('modalBranch').textContent = order.branch || 'Sucursal Principal';

  document.getElementById('modalPaymentRef').textContent = `#${order.paymentReference}`;
  document.getElementById('modalBcvRate').textContent = `Bs. ${window.bcvRate.toFixed(2)} / USD`;
  document.getElementById('modalTotalBs').textContent = `Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('modalStatus').textContent = order.status || 'En Verificación';

  document.getElementById('modalTotalUsd').textContent = `$${order.total.toFixed(2)}`;
  document.getElementById('modalTotalBsSummary').textContent = `Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const tbody = document.getElementById('modalOrderItemsBody');
  tbody.innerHTML = (order.items || []).map(item => {
    const itemTotal = (item.price * item.qty).toFixed(2);
    return `
      <tr>
        <td class="p-2.5 font-mono font-bold text-slate-700">${item.sku || 'PROD'}</td>
        <td class="p-2.5 font-medium text-slate-900">${item.name}</td>
        <td class="p-2.5 text-center font-bold text-slate-800">${item.qty}</td>
        <td class="p-2.5 text-right font-medium text-slate-700">$${item.price.toFixed(2)}</td>
        <td class="p-2.5 text-right font-bold text-emerald-700">$${itemTotal}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('btnDownloadInvoiceFromModal').onclick = () => {
    window.generateInvoicePDF(order, window.bcvRate);
  };

  document.getElementById('viewOrderModal').classList.remove('hidden');
};

window.closeOrderModal = () => {
  document.getElementById('viewOrderModal').classList.add('hidden');
  activeModalOrder = null;
};

window.printOrderInvoice = () => {
  window.print();
};

window.deleteOrder = (idx) => {
  if (activeAdminBranch !== "ALL") {
    alert("Acción no permitida. Solo el acceso global puede eliminar órdenes.");
    return;
  }

  const order = orders[idx];
  if (confirm(`¿Estás seguro de que deseas eliminar la orden "${order.orderId}" de ${order.clientName}?`)) {
    orders.splice(idx, 1);
    saveState();
    filterAdminView();
  }
};

function updateBranchStats() {
  const branches = ["San Félix", "CC Alta Vista I", "CC Alta Vista II"];
  const ids = ["sanfelix", "altavista1", "altavista2"];

  branches.forEach((b, index) => {
    const branchSales = sellers.filter(s => s.branch === b).reduce((acc, s) => acc + s.sales, 0);
    const branchStock = products.filter(p => p.branch === b).reduce((acc, p) => acc + p.stock, 0);

    const statElem = document.getElementById(`stat-${ids[index]}`);
    const stockElem = document.getElementById(`stock-${ids[index]}`);

    if (statElem) statElem.textContent = `$${branchSales.toFixed(2)}`;
    if (stockElem) stockElem.textContent = `Stock: ${branchStock} unidades`;
  });

  const deliveryOrders = orders.filter(o => 
    (o.deliveryType === "Delivery" || o.deliveryType === "Envío por Delivery") &&
    o.status !== "Cancelado"
  );
  
  const totalDeliverySales = deliveryOrders.reduce((acc, o) => acc + (o.total || 0), 0);

  const statDeliveryElem = document.getElementById('stat-delivery');
  const countDeliveryElem = document.getElementById('count-delivery');

  if (statDeliveryElem) statDeliveryElem.textContent = `$${totalDeliverySales.toFixed(2)}`;
  if (countDeliveryElem) countDeliveryElem.textContent = `${deliveryOrders.length} pedido(s) registrado(s)`;
}

window.addSellerPrompt = () => {
  const name = prompt("Nombre del vendedor:");
  if (!name || name.trim() === "") return;

  const targetBranch = activeAdminBranch !== "ALL" ? activeAdminBranch : prompt("Sucursal asignada:", "San Félix");
  if (!targetBranch) return;

  const commRate = prompt("Comisión (%):", "5");
  const parsedRate = parseFloat(commRate);

  if (isNaN(parsedRate) || parsedRate < 0) return alert("Porcentaje no válido.");

  sellers.push({
    id: "s" + (sellers.length + 1),
    name: name.trim(),
    branch: targetBranch.trim(),
    sales: 0.00,
    commRate: parsedRate
  });

  saveState();
  filterAdminView();
};

window.deleteSeller = (idx) => {
  if (confirm(`¿Eliminar a ${sellers[idx].name}?`)) {
    sellers.splice(idx, 1);
    saveState();
    filterAdminView();
  }
};

window.filterAdminView = () => {
  renderInventoryTable(activeAdminBranch);
  renderOrdersTable(activeAdminBranch);
  renderSellersTable(activeAdminBranch);
  updateBranchStats();

  const pBranchSelect = document.getElementById('pBranch');
  if (activeAdminBranch !== "ALL") {
    pBranchSelect.value = activeAdminBranch;
    pBranchSelect.disabled = true;
  } else {
    pBranchSelect.disabled = false;
  }
};

window.handleCreateProduct = async (e) => {
  e.preventDefault();
  
  const pBranchSelect = document.getElementById('pBranch');
  const targetBranch = activeAdminBranch !== "ALL" ? activeAdminBranch : pBranchSelect.value;
  const fileInput = document.getElementById('pImage');
  
  if (!fileInput.files || !fileInput.files[0]) {
    alert("Por favor, selecciona una imagen PNG o JPG.");
    return;
  }

  try {
    const base64Image = await readFileAsBase64(fileInput.files[0]);

    const newP = {
      id: (products.length + 1).toString(),
      sku: "PROD-00" + (products.length + 1),
      name: document.getElementById('pName').value,
      category: document.getElementById('pCategory').value,
      branch: targetBranch,
      price: parseFloat(document.getElementById('pPrice').value),
      stock: parseInt(document.getElementById('pStock').value),
      image: base64Image
    };
    
    products.push(newP);
    saveState();
    renderStoreProducts();
    filterAdminView();
    document.getElementById('adminProductForm').reset();
    
    if (activeAdminBranch !== "ALL") {
      pBranchSelect.value = activeAdminBranch;
    }
  } catch (error) {
    alert("Error procesando la imagen. Inténtalo de nuevo.");
  }
};

window.exportDataJSON = () => {
  const backupData = {
    products,
    sellers,
    orders,
    bcvRate: window.bcvRate,
    exportedAt: new Date().toISOString()
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `AvocadoShop_Backup_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

window.importDataJSON = (event) => {
  const fileReader = new FileReader();
  fileReader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);

      if (importedData.products && importedData.sellers) {
        products = importedData.products;
        sellers = importedData.sellers;
        if (importedData.orders) orders = importedData.orders;
        if (importedData.bcvRate) window.bcvRate = importedData.bcvRate;

        saveState();
        updateBcvUI();
        renderStoreProducts();
        filterAdminView();
        alert("✅ Datos e inventario importados con éxito.");
      } else {
        alert("❌ El archivo subido no posee un formato válido para Avocado Shop.");
      }
    } catch (err) {
      alert("❌ Error al procesar el archivo JSON.");
    }
  };

  if (event.target.files[0]) {
    fileReader.readAsText(event.target.files[0]);
  }
};

function setupFilters() {
  document.getElementById('searchInput').addEventListener('input', () => {
    renderStoreProducts();
  });

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

  document.getElementById('btnOpenCart').addEventListener('click', () => document.getElementById('cartModal').classList.remove('hidden'));
  document.getElementById('btnCloseCart').addEventListener('click', () => document.getElementById('cartModal').classList.add('hidden'));
}

window.toggleDeliveryAddress = () => {
  const option = document.getElementById('deliveryOption').value;
  const deliveryContainer = document.getElementById('deliveryAddressContainer');
  const pickupContainer = document.getElementById('pickupBranchContainer');

  if (option === 'delivery') {
    deliveryContainer.classList.remove('hidden');
    pickupContainer.classList.add('hidden');
  } else {
    deliveryContainer.classList.add('hidden');
    pickupContainer.classList.remove('hidden');
  }
};

window.updateBcvRatePrompt = () => {
  const newRate = prompt("Ingrese la tasa actual del BCV (Bs. por USD):", window.bcvRate);
  if (newRate === null) return;

  const parsedRate = parseFloat(newRate);
  if (isNaN(parsedRate) || parsedRate <= 0) {
    alert("Ingrese un monto válido.");
    return;
  }

  window.bcvRate = parsedRate;
  updateBcvUI();
  renderStoreProducts();
  updateCartUI();
};

function updateBcvUI() {
  const formattedRate = `Bs. ${window.bcvRate.toFixed(2)}`;
  const displayDesktop = document.getElementById('bcvRateDisplay');
  const displayMobile = document.getElementById('bcvRateDisplayMobile');
  const displayCart = document.getElementById('cartBcvRate');

  if (displayDesktop) displayDesktop.textContent = formattedRate;
  if (displayMobile) displayMobile.textContent = formattedRate;
  if (displayCart) displayCart.textContent = `${formattedRate} / USD`;
}
