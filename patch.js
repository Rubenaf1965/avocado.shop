const fs = require('fs');

const filePath = './app.js'; // Ajusta la ruta si está en otra carpeta

if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Código actualizado para asegurar la carga de productos desde Supabase en el reporte
    const patchCode = `
window.openInventoryReport = async function() {
  const client = getSupabaseClient();
  let productosParaReporte = [];

  if (client) {
    const { data, error } = await client.from('products').select('*');
    if (!error && data) {
      productosParaReporte = data;
      window.products = data;
    } else {
      console.error("Error al obtener productos para el reporte:", error);
    }
  } else {
    productosParaReporte = window.products || [];
  }

  const tbody = document.getElementById('inventoryReportTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  let totalUnidades = 0;

  productosParaReporte.forEach(prod => {
    totalUnidades += parseInt(prod.stock || 0);
    tbody.innerHTML += \`
      <tr>
        <td>\${prod.sku || 'N/A'}</td>
        <td>\${prod.name}</td>
        <td>\${prod.category}</td>
        <td>\${prod.branch}</td>
        <td>$\${prod.price}</td>
        <td>$\${(prod.price * (window.currentBcvRate || 1)).toFixed(2)}</td>
        <td>\${prod.stock}</td>
      </tr>
    \`;
  });

  const countElem = document.getElementById('totalProductsCount');
  const unitsElem = document.getElementById('totalUnitsCount');
  if (countElem) countElem.innerText = productosParaReporte.length;
  if (unitsElem) unitsElem.innerText = totalUnidades;
  
  const modal = document.getElementById('inventoryReportModal');
  if (modal) modal.style.display = 'block';
};
`;

    // Si ya existe la función, la reemplazamos, o la agregamos al final
    if (content.includes('window.openInventoryReport')) {
        console.log("La función ya existe en el archivo. Actualízala manualmente con la lógica de Supabase.");
    } else {
        fs.appendFileSync(filePath, patchCode);
        console.log("✅ Función de reporte sincronizada con Supabase agregada con éxito al final de app_2.js");
    }
} else {
    console.log("❌ No se encontró el archivo app_2.js en la ruta especificada.");
}