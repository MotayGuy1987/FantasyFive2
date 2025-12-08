// Immediate visible feedback
document.title = "Loading... - Fantasy Mini League";

// Show loading message immediately
document.body.innerHTML = `
  <div id="status" style="
    font-family: Arial, sans-serif; 
    padding: 20px; 
    background: #e3f2fd; 
    border-left: 4px solid #2196f3;
    margin: 20px;
  ">
    <h2 style="margin: 0 0 10px 0; color: #1976d2;">🔄 Loading React App...</h2>
    <div id="progress"></div>
  </div>
  <div id="root"></div>
`;

const progress = document.getElementById('progress')!;

function updateStatus(message: string, isError = false) {
  document.title = `${isError ? '❌ Error' : '✅ Success'} - Fantasy Mini League`;
  
  const p = document.createElement('p');
  p.style.cssText = `
    margin: 5px 0; 
    color: ${isError ? '#d32f2f' : '#388e3c'}; 
    font-weight: ${isError ? 'bold' : 'normal'};
  `;
  p.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
  progress.appendChild(p);
  
  // Scroll to show latest message
  progress.scrollTop = progress.scrollHeight;
}

// Global error handlers
window.addEventListener('error', (event) => {
  updateStatus(`JavaScript Error: ${event.message}`, true);
});

window.addEventListener('unhandledrejection', (event) => {
  updateStatus(`Promise Error: ${event.reason}`, true);
});

try {
  updateStatus("Step 1: Starting imports...");
  
  // Import React
  import('./react-imports.js').then(() => {
    updateStatus("Step 2: React imported successfully");
    // This will be our next step
  }).catch((error) => {
    updateStatus(`Step 2 Failed: React import error - ${error.message}`, true);
  });
  
} catch (error) {
  updateStatus(`Step 1 Failed: ${error instanceof Error ? error.message : String(error)}`, true);
}
