// Detect if running in Electron
export const isElectron = (): boolean => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    return !!(window.process && window.process.type === 'renderer');
  }
  return false;
};

// Print bill function - Simplified version
export const printBill = async (billData: any): Promise<{ success: boolean; error?: string }> => {
  const htmlContent = generateBillHTML(billData);
  
  // Always use window.print() method - works in both web and electron
  try {
    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    // Write content to iframe
    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();
      
      // Print from iframe
      iframe.contentWindow?.print();
      
      // Remove iframe after print dialog closes
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
      
      return { success: true };
    } else {
      return { success: false, error: 'Cannot create iframe' };
    }
  } catch (error: any) {
    console.error('Print error:', error);
    return { success: false, error: error.message };
  }
};

// Alternative: Simple window print
export const printBillSimple = async (billData: any): Promise<void> => {
  const htmlContent = generateBillHTML(billData);
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  } else {
    // If popup blocked, use iframe method
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.write(htmlContent);
      iframeDoc.close();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }
  }
};

// Generate bill HTML (same as before)
const generateBillHTML = (data: any): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Bill - Jinnah Dental Clinic</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          padding: 20px;
          background: #fff;
        }
        .bill-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
        }
        .header {
          text-align: center;
          padding: 20px;
          border-bottom: 2px solid #1e3a5f;
          margin-bottom: 20px;
        }
        .clinic-name {
          font-size: 24px;
          font-weight: bold;
          color: #1e3a5f;
        }
        .info-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 8px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: left;
        }
        th {
          background: #1e3a5f;
          color: white;
        }
        .total-section {
          text-align: right;
          margin-top: 20px;
          padding: 15px;
          border-top: 2px solid #1e3a5f;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
        }
        @media print {
          body {
            padding: 0;
            margin: 0;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="bill-container">
        <div class="header">
          <div class="clinic-name">Jinnah Dental Clinic</div>
          <p>Your Smile, Our Priority</p>
          <p>123 Main Street, City | Phone: +92 123 4567890</p>
        </div>
        
        <div class="info-section">
          <div>
            <strong>Bill No:</strong> ${data.billNumber || 'N/A'}<br/>
            <strong>Date:</strong> ${new Date(data.date).toLocaleDateString()}
          </div>
          <div>
            <strong>Patient Name:</strong> ${data.patientName || 'N/A'}<br/>
            <strong>Patient ID:</strong> ${data.patientId || 'N/A'}
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.items?.map((item: any) => `
              <tr>
                <td>${item.description || ''}</td>
                <td>${item.quantity || 0}</td>
                <td>Rs. ${(item.price || 0).toFixed(2)}</td>
                <td>Rs. ${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
              </tr>
            `).join('') || '<tr><td colspan="4">No items</td></tr>'}
          </tbody>
        </table>
        
        <div class="total-section">
          <p><strong>Subtotal:</strong> Rs. ${(data.subtotal || 0).toFixed(2)}</p>
          <p><strong>Discount:</strong> Rs. ${(data.discount || 0).toFixed(2)}</p>
          <p><strong>Total Amount:</strong> Rs. ${(data.total || 0).toFixed(2)}</p>
          <p><strong>Paid Amount:</strong> Rs. ${(data.paid || 0).toFixed(2)}</p>
          <p><strong>Pending:</strong> Rs. ${(data.pending || 0).toFixed(2)}</p>
        </div>
        
        <div class="footer">
          <p>Thank you for visiting!</p>
          <p>Powered by Saynz Technologies</p>
          <p>Contact Us: 0347-1887181</p>
          <p>** This is a computer generated bill **</p>
        </div>
      </div>
    </body>
    </html>
  `;
};