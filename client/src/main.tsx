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
  updateStatus(`JavaScript Error: ${event.message} at ${event.filename}:${event.lineno}`, true);
});

window.addEventListener('unhandledrejection', (event) => {
  updateStatus(`Promise Error: ${event.reason}`, true);
});

// Main loading process
async function loadApp() {
  try {
    updateStatus("Step 1: Starting React imports...");
    
    // Import React and ReactDOM
    const React = await import("react");
    const ReactDOM = await import("react-dom/client");
    
    updateStatus("Step 2: React imported successfully!");
    updateStatus("Step 3: Looking for root element...");
    
    const root = document.getElementById("root");
    if (!root) {
      updateStatus("Step 3 Failed: Root element not found!", true);
      return;
    }
    
    updateStatus("Step 4: Root element found, creating React root...");
    
    const reactRoot = ReactDOM.createRoot(root);
    
    updateStatus("Step 5: Rendering simple React component...");
    
    // Create a simple React element to test if React works
    const testElement = React.createElement('div', {
      style: {
        padding: '20px',
        background: '#e8f5e8',
        border: '2px solid #4caf50',
        margin: '20px',
        fontFamily: 'Arial, sans-serif'
      }
    }, [
      React.createElement('h1', { 
        key: 'title', 
        style: { color: '#2e7d32' } 
      }, '✅ React Working!'),
      React.createElement('p', { 
        key: 'message' 
      }, 'React has successfully mounted. The blank screen issue is resolved!'),
      React.createElement('p', { 
        key: 'next' 
      }, 'Next step: This confirms React works. Now we can load your full App component.')
    ]);
    
    reactRoot.render(testElement);
    
    updateStatus("Step 6: React component rendered successfully!");
    updateStatus("🎉 SUCCESS! React is working on your Railway deployment!");
    
    // Hide the status messages after success
    setTimeout(() => {
      const statusDiv = document.getElementById('status');
      if (statusDiv) {
        statusDiv.style.opacity = '0.3';
        statusDiv.style.transform = 'translateY(-10px)';
        statusDiv.style.transition = 'all 0.5s ease';
      }
    }, 3000);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    updateStatus(`FAILED: ${errorMessage}`, true);
    
    // Show detailed error information
    const errorDetails = document.createElement('div');
    errorDetails.innerHTML = `
      <div style="
        background: #ffebee; 
        border: 2px solid #f44336; 
        padding: 15px; 
        margin: 20px;
        font-family: Arial, sans-serif;
      ">
        <h3 style="color: #d32f2f; margin-top: 0;">❌ Detailed Error Information</h3>
        <p><strong>Error:</strong> ${errorMessage}</p>
        <p><strong>Stack:</strong></p>
        <pre style="background: #f5f5f5; padding: 10px; overflow: auto; font-size: 11px;">
          ${error instanceof Error ? error.stack || 'No stack trace available' : 'No stack trace available'}
        </pre>
      </div>
    `;
    document.body.appendChild(errorDetails);
  }
}

// Start the loading process
updateStatus("Starting app loading process...");
loadApp();
