window.generateInvoicePDF = (orderData, rate = window.bcvRate) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  // Encabezado principal
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("🥑 Avocado Shop C.A.", 15, 16);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Insumos de uñas, cejas y pestañas • RIF: J-501234567", 15, 23);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURA DIGITAL", 195, 15, { align: "right" });
  doc.setFontSize(9);
  doc.text(`Orden #${orderData.orderId}`, 195, 22, { align: "right" });

  // Datos Emisor y Cliente
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS DEL EMISOR", 15, 38);
  doc.text("DATOS DEL CLIENTE", 110, 38);
  doc.setDrawColor(226, 232, 240);
  doc.line(15, 40, 100, 40);
  doc.line(110, 40, 195, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Avocado Shop C.A. | RIF: J-501234567", 15, 46);
  doc.text(`Método: ${orderData.deliveryType || 'Retiro en Sucursal'}`, 15, 51);
  doc.text(`Cliente: ${orderData.clientName}`, 110, 46);
  doc.text(`Ubicación/Dir: ${orderData.branch || 'San Félix'}`, 110, 51);

  // Tabla de Productos
  const tableBody = (orderData.items || []).map(i => [
    i.sku || 'PROD',
    i.name,
    i.qty.toString(),
    `$${i.price.toFixed(2)}`,
    `$${(i.price * i.qty).toFixed(2)}`
  ]);

  doc.autoTable({
    startY: 58,
    head: [['SKU', 'Producto', 'Cant.', 'Precio ($)', 'Total ($)']],
    body: tableBody,
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 25 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'right', cellWidth: 25 },
      4: { halign: 'right', cellWidth: 25 }
    }
  });

  // Pie de Factura / Totales
  const finalY = doc.lastAutoTable.finalY + 8;
  const totalBS = orderData.total * rate;

  doc.setFillColor(236, 253, 245);
  doc.roundedRect(15, finalY, 95, 25, 2, 2, 'F');
  doc.setTextColor(6, 95, 70);
  doc.setFont("helvetica", "bold");
  doc.text("PAGO MÓVIL BANESCO (0134)", 20, finalY + 6);
  doc.setFont("helvetica", "normal");
  doc.text(`Referencia: #${orderData.paymentReference}`, 20, finalY + 12);
  doc.text(`Tasa BCV Aplicada: ${rate.toFixed(2)} Bs/$`, 20, finalY + 17);
  doc.text(`Monto en Bolívares: Bs. ${totalBS.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 20, finalY + 22);

  doc.setFillColor(5, 150, 105);
  doc.rect(130, finalY + 10, 65, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL FINAL:", 135, finalY + 16);
  doc.text(`$${orderData.total.toFixed(2)}`, 190, finalY + 16, { align: "right" });

  doc.save(`Factura_AvocadoShop_${orderData.orderId}.pdf`);
};