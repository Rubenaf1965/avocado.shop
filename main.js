async function fetchLiveBcvRate() {
  const displayElement = document.getElementById('bcvRateDisplay');
  const mobileDisplayElement = document.getElementById('bcvRateDisplayMobile');
  
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
    const data = await res.json();
    
    if (data && data.promedio) {
      window.bcvRate = parseFloat(data.promedio);
      const formattedRate = `Bs. ${window.bcvRate.toFixed(2)}`;
      if (displayElement) displayElement.textContent = formattedRate;
      if (mobileDisplayElement) mobileDisplayElement.textContent = formattedRate;
      return;
    }
  } catch (err) {
    console.warn("Fallo API primaria DolarApi, intentando API de respaldo...", err);
  }

  // Respaldo
  try {
    const res = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv');
    const data = await res.json();
    if (data && data.moneda) {
      window.bcvRate = parseFloat(data.moneda);
      const formattedRate = `Bs. ${window.bcvRate.toFixed(2)}`;
      if (displayElement) displayElement.textContent = formattedRate;
      if (mobileDisplayElement) mobileDisplayElement.textContent = formattedRate;
    }
  } catch (err) {
    console.error("No se pudo obtener la tasa en vivo:", err);
    if (displayElement) displayElement.textContent = "Bs. 36.50 (Base)";
  }
}

// Ejecutar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  fetchLiveBcvRate();
});