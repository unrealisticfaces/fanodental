import { useState, useEffect } from 'react';
import { useToast } from '../ToastContext';
import { useData } from '../DataContext';

export default function Billing({ workspaceUid }) {
  const { addToast } = useToast();
  // Read stats from DataContext so Total Gross Revenue reflects the all-time 7M
  const { orders, payments: transactions, labSettings, stats, isInitialLoading: isLoading } = useData();
  const [activeTab, setActiveTab] = useState('sales');
  
  const allOrders = orders || [];
  
  const dentists = [...new Set(allOrders.map(o => o.dentistName?.trim()).filter(Boolean))].sort();
  
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceDateFilter, setInvoiceDateFilter] = useState('All');
  const [invoiceCustomDate, setInvoiceCustomDate] = useState('');
  const [invoiceCustomMonth, setInvoiceCustomMonth] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  
  const [customerSearch, setCustomerSearch] = useState('');
  
  const [reportType, setReportType] = useState('summary_pdf');
  const [reportTimeframe, setReportTimeframe] = useState('This Month');
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');

  const [showSOAPreview, setShowSOAPreview] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [soaPrintData, setSoaPrintData] = useState(null);

  const [invoicesPage, setInvoicesPage] = useState(1);
  const [customersPage, setCustomersPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  
  const itemsPerPage = 10;

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => { setInvoicesPage(1); }, [invoiceSearch, invoiceDateFilter, invoiceCustomDate, invoiceCustomMonth, paymentStatusFilter]);
  useEffect(() => { setCustomersPage(1); }, [customerSearch]);

  const filteredInvoices = allOrders.filter(o => {
    const searchLower = invoiceSearch.toLowerCase();
    const matchesSearch = (o.dentistName || '').toLowerCase().includes(searchLower) ||
                          (o.rxNumber || '').toLowerCase().includes(searchLower) ||
                          (o.product || '').toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;

    if (paymentStatusFilter === 'Fully Paid' && o.payType !== 'Fully Paid' && o.payType !== 'Paid') return false;
    if (paymentStatusFilter === 'Partial' && o.payType !== 'Partial') return false;
    if (paymentStatusFilter === 'Unpaid' && o.payType !== 'Unpaid' && o.payType) return false;

    if (invoiceDateFilter === 'All') return true;

    const orderDateObj = new Date(o.dateReceived || o.createdAt);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const orderTime = orderDateObj.getTime();

    if (invoiceDateFilter === 'Today') return orderTime >= startOfToday.getTime();
    if (invoiceDateFilter === 'This Week') {
       const startOfWeek = startOfToday.getTime() - (startOfToday.getDay() * 86400000);
       return orderTime >= startOfWeek;
    }
    if (invoiceDateFilter === 'This Month') {
       const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1).getTime();
       return orderTime >= startOfMonth;
    }
    if (invoiceDateFilter === 'This Year') {
       const startOfYear = new Date(startOfToday.getFullYear(), 0, 1).getTime();
       return orderTime >= startOfYear;
    }
    if (invoiceDateFilter === 'Custom Date' && invoiceCustomDate) {
       return (o.dateReceived || orderDateObj.toISOString().split('T')[0]) === invoiceCustomDate;
    }
    if (invoiceDateFilter === 'Custom Month' && invoiceCustomMonth) {
       return (o.dateReceived || orderDateObj.toISOString().split('T')[0]).substring(0, 7) === invoiceCustomMonth;
    }
    return true;
  });

  const customerStats = dentists.map(dentist => {
    const dentistOrders = allOrders.filter(o => o.dentistName?.trim() === dentist);
    const totalOrders = dentistOrders.length;
    const gross = dentistOrders.reduce((sum, o) => sum + (parseFloat(o.totalPrice) || 0), 0);
    const paid = dentistOrders.reduce((sum, o) => sum + (parseFloat(o.payment) || 0), 0);
    const balance = dentistOrders.reduce((sum, o) => sum + (parseFloat(o.balance) || 0), 0);
    
    const allRxs = dentistOrders.map(o => o.rxNumber).filter(Boolean);

    return { name: dentist, totalOrders, gross, paid, balance, orders: dentistOrders, allRxs };
  });

  const filteredCustomers = customerStats.filter(c => {
    const searchLower = customerSearch.toLowerCase();
    if (c.name.toLowerCase().includes(searchLower)) return true;
    return c.orders.some(o => (o.rxNumber || '').toLowerCase().includes(searchLower));
  });

  const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
  const formatDateTime = (isoStr) => new Date(isoStr).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatShortDate = (isoStr) => new Date(isoStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const handleOpenSOA = (customer) => {
    const activeBillingRecords = customer.orders.filter(o => 
      (o.payType === 'Unpaid' || o.payType === 'Partial') && parseFloat(o.balance) > 0
    );

    if (activeBillingRecords.length === 0) {
      addToast("No outstanding records to print for this dentist.", "error");
      return;
    }

    setSoaPrintData({
      dentistName: customer.name,
      records: activeBillingRecords,
      totalOutstanding: customer.balance
    });
    setShowSOAPreview(true);
  };

  const handleViewDetailsClick = (order) => {
    setSelectedOrder(order);
    setIsViewModalOpen(true);
  };

  const getSOAHTML = () => {
    if (!soaPrintData) return '';

    const rowsHtml = soaPrintData.records.map(order => `
      <tr>
        <td style="border-bottom: 1px solid #e6e8eb; padding: 12px 8px; color: #111;">${order.dateReceived}</td>
        <td style="border-bottom: 1px solid #e6e8eb; padding: 12px 8px; color: #111;"><strong>${order.rxNumber}</strong></td>
        <td style="border-bottom: 1px solid #e6e8eb; padding: 12px 8px; color: #111;">${order.patientName}</td>
        <td style="border-bottom: 1px solid #e6e8eb; padding: 12px 8px; color: #111;">${order.product}</td>
        <td style="border-bottom: 1px solid #e6e8eb; padding: 12px 8px; color: #111; text-align: right;">₱ ${parseFloat(order.totalPrice || 0).toFixed(2)}</td>
        <td style="border-bottom: 1px solid #e6e8eb; padding: 12px 8px; color: #111; text-align: right;">₱ ${parseFloat(order.payment || 0).toFixed(2)}</td>
        <td style="border-bottom: 1px solid #e6e8eb; padding: 12px 8px; color: #111; text-align: right; font-weight: 600;">₱ ${parseFloat(order.balance || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Statement of Account - Dr. ${soaPrintData.dentistName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; line-height: 1.6; font-size: 13px; margin: 0; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 1px solid #e6e8eb; padding-bottom: 24px; }
            .header h1 { margin: 0; font-size: 22px; color: #111; letter-spacing: -0.5px; }
            .header p { margin: 4px 0 0 0; color: #667382; font-size: 12px; }
            .title-section { text-align: center; margin-bottom: 30px; }
            .title-section h2 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; color: #111; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
            th { border-bottom: 2px solid #111; text-align: left; padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #444; letter-spacing: 0.5px; }
            .total-section { float: right; width: 300px; border-top: 2px solid #111; padding-top: 12px; }
            .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; color: #111; }
            .footer { clear: both; padding-top: 60px; text-align: center; font-size: 12px; color: #666; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${labSettings.name || 'Fano Laboratory'}</h1>
            ${labSettings.address ? `<p>${labSettings.address}</p>` : ''}
            ${labSettings.phone || labSettings.email ? `<p>${labSettings.phone ? labSettings.phone : ''} ${labSettings.phone && labSettings.email ? ' | ' : ''} ${labSettings.email ? labSettings.email : ''}</p>` : ''}
          </div>
          <div class="title-section"><h2>Statement of Account</h2></div>
          <div class="info-row">
            <div><strong>Billed To:</strong><br/>Dr. ${soaPrintData.dentistName}</div>
            <div style="text-align: right;"><strong>Statement Date:</strong><br/>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
          <table>
            <thead><tr><th>Date</th><th>RX No.</th><th>Patient Name</th><th>Product</th><th style="text-align: right;">Gross Amount</th><th style="text-align: right;">Paid</th><th style="text-align: right;">Balance Due</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="total-section">
            <div class="total-row"><span>Total Balance Due:</span><span>₱ ${soaPrintData.totalOutstanding.toFixed(2)}</span></div>
          </div>
          <div class="footer">
            <p>Please make all checks payable to <strong>${labSettings.name || 'Fano Laboratory'}</strong>.</p>
            <p>If you have any questions concerning this statement, contact us.</p>
            <p>Thank you for your business!</p>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrintHidden = () => {
    const htmlContent = getSOAHTML();
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(htmlContent); doc.close();
    iframe.onload = () => {
      iframe.contentWindow.focus(); iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
      setShowSOAPreview(false);
    };
  };

  const handleGenerateReport = () => {
    if (allOrders.length === 0) return addToast("No records available to generate report.", "error");

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const filteredReportOrders = allOrders.filter(o => {
      const orderDateObj = new Date(o.dateReceived || o.createdAt);
      const orderTime = orderDateObj.getTime();

      if (reportTimeframe === 'All Time') return true;
      if (reportTimeframe === 'Today') return orderTime >= startOfToday.getTime();
      if (reportTimeframe === 'This Week') return orderTime >= (startOfToday.getTime() - (startOfToday.getDay() * 86400000));
      if (reportTimeframe === 'This Month') return orderTime >= new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1).getTime();
      if (reportTimeframe === 'This Year') return orderTime >= new Date(startOfToday.getFullYear(), 0, 1).getTime();
      
      if (reportTimeframe === 'Custom Date Range') {
        const fromTime = reportDateFrom ? new Date(reportDateFrom).getTime() : 0;
        const toTime = reportDateTo ? new Date(reportDateTo).getTime() + 86400000 : Infinity;
        return orderTime >= fromTime && orderTime <= toTime;
      }
      return true;
    });

    if (filteredReportOrders.length === 0) {
      addToast(`No data found for timeframe: ${reportTimeframe}`, "error");
      return;
    }

    const totalGross = filteredReportOrders.reduce((sum, o) => sum + (parseFloat(o.totalPrice) || 0), 0);
    const totalCollected = filteredReportOrders.reduce((sum, o) => sum + (parseFloat(o.payment) || 0), 0);
    const totalPending = filteredReportOrders.reduce((sum, o) => sum + (parseFloat(o.balance) || 0), 0);
    const totalOrders = filteredReportOrders.length;

    const productStats = {};
    filteredReportOrders.forEach(o => {
      const prod = o.product || 'Unknown';
      if (!productStats[prod]) {
        productStats[prod] = { qty: 0, revenue: 0 };
      }
      productStats[prod].qty += (parseInt(o.units) || 0);
      productStats[prod].revenue += (parseFloat(o.totalPrice) || 0);
    });

    const sortedProducts = Object.keys(productStats)
      .map(p => ({ name: p, ...productStats[p] }))
      .sort((a, b) => b.revenue - a.revenue);

    if (reportType === 'summary_csv') {
      const csvContent = [
        ['Report Period', reportTimeframe],
        ['Generated On', new Date().toLocaleDateString()],
        ['Total Orders Processed', totalOrders],
        ['Total Gross Billed', totalGross],
        ['Total Collected (Earnings)', totalCollected],
        ['Total Pending (Unpaid)', totalPending],
        [],
        ['Revenue Breakdown by Product'],
        ['Product Description', 'Units Produced (pcs)', 'Gross Revenue'],
        ...sortedProducts.map(p => [p.name, p.qty, p.revenue])
      ].map(e => e.join(',')).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Financial_Summary_${reportTimeframe.replace(/\s+/g, '_')}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
      addToast('Summary CSV Downloaded!', 'success');
      return;
    }

    if (reportType === 'summary_pdf') {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Financial Report - ${reportTimeframe}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
              body { font-family: 'Inter', sans-serif; padding: 40px; color: #111; line-height: 1.5; font-size: 13px; max-width: 800px; margin: 0 auto; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #111; padding-bottom: 20px; }
              .header-left h1 { margin: 0 0 5px 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: -0.5px; }
              .header-left p { margin: 2px 0; color: #555; }
              .header-right { text-align: right; }
              .header-right h2 { margin: 0 0 5px 0; font-size: 16px; color: #111; text-transform: uppercase; letter-spacing: 1px; }
              .header-right p { margin: 2px 0; color: #555; font-weight: 500; }
              
              .report-info { display: flex; justify-content: space-between; margin-bottom: 40px; }
              .info-block span { display: block; font-size: 10px; text-transform: uppercase; color: #555; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px; }
              .info-block strong { font-size: 14px; color: #111; }

              .summary-grid { display: flex; justify-content: space-between; margin: 30px 0 40px 0; border-top: 2px solid #111; border-bottom: 2px solid #111; padding: 20px 0; }
              .summary-item { text-align: left; }
              .summary-label { font-size: 11px; text-transform: uppercase; color: #555; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 8px; display: block; }
              .summary-value { font-size: 24px; font-weight: 700; color: #111; margin: 0; }
              
              .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #111; padding-bottom: 8px; margin-bottom: 16px; color: #111; margin-top: 40px; }
              
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              th { text-align: left; padding: 10px 8px; font-size: 11px; text-transform: uppercase; color: #111; border-bottom: 2px solid #111; }
              td { padding: 10px 8px; border-bottom: 1px solid #ccc; font-size: 13px; color: #111; }
              tr.total-row td { border-top: 2px solid #111; border-bottom: none; font-weight: 700; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .font-bold { font-weight: 700; }
              .font-medium { font-weight: 500; }

              .signatures { display: flex; justify-content: space-between; margin-top: 80px; clear: both; }
              .sig-line { width: 250px; border-top: 1px solid #111; padding-top: 8px; text-align: center; }
              .sig-line span { display: block; font-size: 11px; text-transform: uppercase; color: #555; font-weight: 600; }
              
              .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #111; font-size: 10px; color: #555; }
              @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="header-left">
                <h1>${labSettings.name || 'Fano Laboratory'}</h1>
                ${labSettings.address ? `<p>${labSettings.address}</p>` : ''}
                ${labSettings.phone || labSettings.email ? `<p>${labSettings.phone ? labSettings.phone : ''} ${labSettings.phone && labSettings.email ? ' | ' : ''} ${labSettings.email ? labSettings.email : ''}</p>` : ''}
                ${labSettings.taxId ? `<p>TIN: ${labSettings.taxId}</p>` : ''}
              </div>
              <div class="header-right">
                <h2>Financial Report</h2>
                <p>Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p>Time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            <div class="report-info">
              <div class="info-block">
                <span>Report Period</span>
                <strong>${reportTimeframe}</strong>
              </div>
              ${reportTimeframe === 'Custom Date Range' ? `
              <div class="info-block">
                <span>Date Range</span>
                <strong>${reportDateFrom} to ${reportDateTo}</strong>
              </div>` : ''}
              <div class="info-block text-right">
                <span>Generated By</span>
                <strong>System Administrator</strong>
              </div>
            </div>

            <div class="summary-grid">
              <div class="summary-item">
                <span class="summary-label">Jobs Processed</span>
                <p class="summary-value">${totalOrders}</p>
              </div>
              <div class="summary-item">
                <span class="summary-label">Total Gross</span>
                <p class="summary-value">₱ ${totalGross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
              <div class="summary-item">
                <span class="summary-label">Total Collected</span>
                <p class="summary-value">₱ ${totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
              <div class="summary-item">
                <span class="summary-label">Outstanding Balance</span>
                <p class="summary-value">₱ ${totalPending.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
            </div>

            <div class="section-title">Revenue Breakdown by Product</div>
            <table>
              <thead>
                <tr>
                  <th>Product Description</th>
                  <th class="text-center">Units Produced (pcs)</th>
                  <th class="text-right">Gross Revenue Generated</th>
                </tr>
              </thead>
              <tbody>
                ${sortedProducts.map(p => `
                  <tr>
                    <td class="font-medium">${p.name}</td>
                    <td class="text-center">${p.qty}</td>
                    <td class="text-right font-medium">₱ ${p.revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="signatures">
              <div class="sig-line">
                <span>Prepared By</span>
              </div>
              <div class="sig-line">
                <span>Approved By</span>
              </div>
            </div>

            <div class="footer">
              This is a computer-generated document. No signature is strictly required for internal validity.<br>
              Securely generated via DentalLab Pro System.
            </div>
          </body>
        </html>
      `;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow.document;
      doc.open(); doc.write(htmlContent); doc.close();
      iframe.onload = () => {
        iframe.contentWindow.focus(); iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      };
      return;
    }
  };

  const totalInvoicesPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const currentInvoices = filteredInvoices.slice((invoicesPage - 1) * itemsPerPage, invoicesPage * itemsPerPage);

  const totalCustomersPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const currentCustomers = filteredCustomers.slice((customersPage - 1) * itemsPerPage, customersPage * itemsPerPage);

  const StatCard = ({ title, value, colorClass }) => (
    <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm p-4 flex flex-col transition-colors duration-200">
      <span className="text-[11px] font-semibold tracking-wider text-mutedLight dark:text-mutedDark uppercase mb-2">{title}</span>
      <div className={`text-2xl font-bold tracking-tight flex items-center min-h-[32px] ${colorClass}`}>
        {isLoading ? <div className="h-6 w-24 bg-pageLight dark:bg-pageDark rounded animate-pulse"></div> : value}
      </div>
    </div>
  );

  const inputClass = "block w-full px-3 py-2 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded-md text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm";
  const labelClass = "block text-sm font-medium text-textLight dark:text-textDark mb-1.5";

  if (!workspaceUid) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm p-2 flex gap-1 overflow-x-auto">
        <button onClick={() => setActiveTab('sales')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'sales' ? 'bg-primary/10 text-primary dark:text-blue-400' : 'text-mutedLight dark:text-mutedDark hover:text-textLight dark:hover:text-textDark hover:bg-pageLight dark:hover:bg-pageDark'}`}>
          Sales
        </button>
        <button onClick={() => setActiveTab('customers')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'customers' ? 'bg-primary/10 text-primary dark:text-blue-400' : 'text-mutedLight dark:text-mutedDark hover:text-textLight dark:hover:text-textDark hover:bg-pageLight dark:hover:bg-pageDark'}`}>
          Statement of Account
        </button>
        <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'reports' ? 'bg-primary/10 text-primary dark:text-blue-400' : 'text-mutedLight dark:text-mutedDark hover:text-textLight dark:hover:text-textDark hover:bg-pageLight dark:hover:bg-pageDark'}`}>
          Reports
        </button>
      </div>

      {activeTab === 'sales' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Reads directly from Bank Ledger (stats) so it matches the Dashboard's 7M */}
            <StatCard title="Total Gross Revenue" value={formatCurrency(stats?.allTimeGross || 0)} colorClass="text-blue-600 dark:text-blue-400" />
            <StatCard title="Total Billed" value={formatCurrency(filteredInvoices.reduce((sum, o) => sum + (parseFloat(o.totalPrice) || 0), 0))} colorClass="text-textLight dark:text-textDark" />
            <StatCard title="Total Paid" value={formatCurrency(filteredInvoices.reduce((sum, o) => sum + (parseFloat(o.payment) || 0), 0))} colorClass="text-green-600 dark:text-green-400" />
            <StatCard title="Remaining Balance" value={formatCurrency(filteredInvoices.reduce((sum, o) => sum + (parseFloat(o.balance) || 0), 0))} colorClass="text-red-600 dark:text-red-400" />
            <StatCard title="Unpaid Orders" value={filteredInvoices.filter(o => o.payType !== 'Fully Paid').length} colorClass="text-amber-600 dark:text-amber-400" />
          </div>

          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm overflow-visible flex flex-col transition-colors duration-200">
            <div className="px-5 py-4 border-b border-borderLight dark:border-borderDark flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-textLight dark:text-textDark whitespace-nowrap">Sales Records</h3>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)} className={`${inputClass} sm:w-36`}>
                  <option value="All">All Statuses</option>
                  <option value="Fully Paid">Fully Paid</option>
                  <option value="Partial">Partial</option>
                  <option value="Unpaid">Unpaid</option>
                </select>

                <select value={invoiceDateFilter} onChange={(e) => setInvoiceDateFilter(e.target.value)} className={`${inputClass} sm:w-36`}>
                  <option value="All">All Time</option>
                  <option value="Today">Today</option>
                  <option value="This Week">This Week</option>
                  <option value="This Month">This Month</option>
                  <option value="This Year">This Year</option>
                  <option value="Custom Date">Specific Date</option>
                  <option value="Custom Month">Specific Month</option>
                </select>
                
                {invoiceDateFilter === 'Custom Date' && (
                  <input type="date" value={invoiceCustomDate} onChange={(e) => setInvoiceCustomDate(e.target.value)} className={`${inputClass} sm:w-40`} />
                )}
                
                {invoiceDateFilter === 'Custom Month' && (
                  <input type="month" value={invoiceCustomMonth} onChange={(e) => setInvoiceCustomMonth(e.target.value)} className={`${inputClass} sm:w-40`} />
                )}

                <div className="relative w-full sm:w-56">
                  <input type="text" value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)} placeholder="Search records..." className={`${inputClass} pl-9`} />
                  <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                </div>
              </div>
            </div>
            <div className="overflow-visible min-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-pageLight/50 dark:bg-pageDark/50 border-b border-borderLight dark:border-borderDark">
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Date</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">RX No.</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Dentist</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">Invoice Amount</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">Collected</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">Balance</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-center">Status</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLight dark:divide-borderDark">
                  {currentInvoices.length === 0 ? (
                    <tr><td colSpan="8" className="px-5 py-6 text-center text-mutedLight dark:text-mutedDark text-sm">No invoice records found.</td></tr>
                  ) : (
                    currentInvoices.map(order => (
                      <tr key={order.id} className="hover:bg-pageLight dark:hover:bg-pageDark transition-colors">
                        <td className="px-5 py-3 text-sm text-mutedLight dark:text-mutedDark whitespace-nowrap">{order.dateReceived || formatShortDate(order.createdAt)}</td>
                        <td className="px-5 py-3 text-sm text-textLight dark:text-textDark whitespace-nowrap font-medium">{order.rxNumber}</td>
                        <td className="px-5 py-3 text-sm text-textLight dark:text-textDark whitespace-nowrap">{order.dentistName}</td>
                        <td className="px-5 py-3 text-sm text-right text-mutedLight dark:text-mutedDark whitespace-nowrap">{formatCurrency(order.totalPrice || 0)}</td>
                        <td className="px-5 py-3 text-sm text-right text-green-600 dark:text-green-400 font-medium whitespace-nowrap">{formatCurrency(order.payment || 0)}</td>
                        <td className="px-5 py-3 text-sm text-right text-red-600 dark:text-red-400 font-bold whitespace-nowrap">{formatCurrency(order.balance || 0)}</td>
                        <td className="px-5 py-3 text-sm text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider w-fit ${
                            order.payType === 'Fully Paid' || order.payType === 'Paid' ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' : order.payType === 'Partial' ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30' : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
                          }`}>{order.payType || 'Unpaid'}</span>
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === order.id ? null : order.id);
                            }}
                            className="inline-flex items-center px-2.5 py-1.5 border border-borderLight dark:border-borderDark rounded text-sm font-medium text-mutedLight dark:text-mutedDark bg-surfaceLight dark:bg-surfaceDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                          >
                            Actions
                            <svg className="ml-1 -mr-0.5 h-4 w-4 text-mutedLight dark:text-mutedDark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          </button>

                          {openDropdownId === order.id && (
                            <div className="absolute right-6 top-10 mt-1 w-44 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded shadow-lg z-50 flex flex-col text-left py-1">
                              <button onClick={(e) => { e.stopPropagation(); handleViewDetailsClick(order); setOpenDropdownId(null); }} className="w-full text-left px-3 py-1.5 text-sm text-textLight dark:text-textDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors font-medium">
                                View Order Details
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedHistoryOrder(order); setOpenDropdownId(null); }} className="w-full text-left px-3 py-1.5 text-sm text-textLight dark:text-textDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors">
                                View Payment History
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!isLoading && filteredInvoices.length > 0 && (
              <div className="px-5 py-3 border-t border-borderLight dark:border-borderDark flex items-center justify-between text-sm text-mutedLight dark:text-mutedDark bg-surfaceLight dark:bg-surfaceDark rounded-b-md">
                <span>Showing {(invoicesPage - 1) * itemsPerPage + 1} to {Math.min(invoicesPage * itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length} entries</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setInvoicesPage(p => Math.max(1, p - 1))} disabled={invoicesPage === 1} className="px-2 py-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center rounded bg-primary text-white text-sm font-medium shadow-sm">{invoicesPage}</button>
                  <button onClick={() => setInvoicesPage(p => Math.min(totalInvoicesPages, p + 1))} disabled={invoicesPage === totalInvoicesPages || totalInvoicesPages === 0} className="px-2 py-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="animate-in fade-in space-y-6">
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm overflow-visible flex flex-col transition-colors duration-200">
            <div className="px-5 py-4 border-b border-borderLight dark:border-borderDark flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-textLight dark:text-textDark">Customer Statements</h3>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search dentist or RX..."
                  className="block w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="overflow-visible min-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-pageLight/50 dark:bg-pageDark/50 border-b border-borderLight dark:border-borderDark">
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Dentist Name</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-center">Total Orders</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">Total Gross</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">Total Paid</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">Outstanding Balance</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLight dark:border-borderDark">
                  {currentCustomers.length === 0 ? (
                    <tr><td colSpan="6" className="px-5 py-6 text-center text-mutedLight dark:text-mutedDark text-sm">No customers found.</td></tr>
                  ) : (
                    currentCustomers.map(customer => (
                      <tr key={customer.name} className="hover:bg-pageLight dark:hover:bg-pageDark transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="text-sm text-textLight dark:text-textDark font-medium">{customer.name}</div>
                          {customer.allRxs && customer.allRxs.length > 0 && (
                            <div className="text-[11px] text-mutedLight dark:text-mutedDark mt-1 max-w-[250px] truncate" title={customer.allRxs.join(', ')}>
                              <span className="font-semibold">RX:</span> {customer.allRxs.join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-mutedLight dark:text-mutedDark text-center whitespace-nowrap align-top">{customer.totalOrders}</td>
                        <td className="px-5 py-3 text-sm text-textLight dark:text-textDark text-right whitespace-nowrap align-top">{formatCurrency(customer.gross)}</td>
                        <td className="px-5 py-3 text-sm text-green-600 dark:text-green-400 font-medium text-right whitespace-nowrap align-top">{formatCurrency(customer.paid)}</td>
                        <td className="px-5 py-3 text-sm text-red-600 dark:text-red-400 font-bold text-right whitespace-nowrap align-top">{formatCurrency(customer.balance)}</td>
                        <td className="px-5 py-3 text-right whitespace-nowrap align-top relative">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setOpenDropdownId(openDropdownId === customer.name ? null : customer.name);
                             }}
                             disabled={customer.balance <= 0} 
                             className="inline-flex items-center px-2.5 py-1.5 border border-borderLight dark:border-borderDark rounded text-sm font-medium text-mutedLight dark:text-mutedDark bg-surfaceLight dark:bg-surfaceDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors focus:outline-none focus:ring-1 focus:ring-primary shadow-sm disabled:opacity-50"
                           >
                             Actions
                             <svg className="ml-1 -mr-0.5 h-4 w-4 text-mutedLight dark:text-mutedDark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                           </button>

                           {openDropdownId === customer.name && (
                             <div className="absolute right-6 top-10 mt-1 w-32 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded shadow-lg z-50 flex flex-col text-left py-1">
                               <button onClick={(e) => { e.stopPropagation(); handleOpenSOA(customer); setOpenDropdownId(null); }} className="w-full text-left px-3 py-1.5 text-sm text-textLight dark:text-textDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors font-medium">
                                 Print SOA
                               </button>
                             </div>
                           )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!isLoading && filteredCustomers.length > 0 && (
              <div className="px-5 py-3 border-t border-borderLight dark:border-borderDark flex items-center justify-between text-sm text-mutedLight dark:text-mutedDark bg-surfaceLight dark:bg-surfaceDark rounded-b-md">
                <span>Showing {(customersPage - 1) * itemsPerPage + 1} to {Math.min(customersPage * itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length} entries</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCustomersPage(p => Math.max(1, p - 1))} disabled={customersPage === 1} className="px-2 py-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center rounded bg-primary text-white text-sm font-medium shadow-sm">{customersPage}</button>
                  <button onClick={() => setCustomersPage(p => Math.min(totalCustomersPages, p + 1))} disabled={customersPage === totalCustomersPages || totalCustomersPages === 0} className="px-2 py-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="animate-in fade-in space-y-6">
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm overflow-visible p-8 max-w-3xl mx-auto mt-8 flex flex-col transition-colors duration-200">
            <div className="flex items-center gap-4 mb-8 pb-5 border-b border-borderLight dark:border-borderDark">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 15h6" /><path d="M9 11h6" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-textLight dark:text-textDark tracking-tight">Reports Center</h3>
                <p className="text-sm text-mutedLight dark:text-mutedDark mt-1">Generate beautifully formatted summaries of your earnings, collections, and pending balances instantly.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Select Report Format</label>
                  <select value={reportType} onChange={(e) => setReportType(e.target.value)} className={inputClass}>
                    <option value="summary_pdf">Printable Summary Report (PDF)</option>
                    <option value="summary_csv">Raw Summary Data (CSV)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Select Timeframe</label>
                  <select value={reportTimeframe} onChange={(e) => setReportTimeframe(e.target.value)} className={inputClass}>
                    <option value="All Time">All Time</option>
                    <option value="Today">Today</option>
                    <option value="This Week">This Week</option>
                    <option value="This Month">This Month</option>
                    <option value="This Year">This Year</option>
                    <option value="Custom Date Range">Custom Date Range</option>
                  </select>
                </div>
              </div>

              {reportTimeframe === 'Custom Date Range' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-pageLight/50 dark:bg-pageDark/50 rounded border border-borderLight dark:border-borderDark animate-in fade-in">
                  <div>
                    <label className={labelClass}>From Date <span className="text-mutedLight dark:text-mutedDark font-normal text-xs ml-1">(Optional)</span></label>
                    <input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>To Date <span className="text-mutedLight dark:text-mutedDark font-normal text-xs ml-1">(Optional)</span></label>
                    <input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} className={inputClass} />
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-borderLight dark:border-borderDark mt-4">
                <button onClick={handleGenerateReport} className="w-full px-4 py-3 bg-primary text-white text-sm font-bold tracking-wide rounded-md hover:bg-primaryHover transition-colors shadow-sm flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
                  {reportType === 'summary_pdf' ? 'Generate Printable PDF Report' : 'Download CSV Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isViewModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-in fade-in">
            <div className="px-6 py-4 border-b border-borderLight dark:border-borderDark flex items-center justify-between bg-pageLight/30 dark:bg-pageDark/30">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-bold text-textLight dark:text-textDark">RX: {selectedOrder.rxNumber}</h3>
                <span className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider ${
                  selectedOrder.initialStatus === 'Delivered' ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' : 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30'
                }`}>{selectedOrder.initialStatus}</span>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="text-mutedLight dark:text-mutedDark hover:text-textLight dark:hover:text-textDark">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 flex-1 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <h4 className="text-[11px] font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider border-b border-borderLight dark:border-borderDark pb-1 mb-3">General Information</h4>
                  <div className="space-y-3">
                    <div><span className="text-xs text-mutedLight dark:text-mutedDark block">Patient Name</span><p className="font-medium text-sm text-textLight dark:text-textDark">{selectedOrder.patientName || '-'}</p></div>
                    <div><span className="text-xs text-mutedLight dark:text-mutedDark block">Dentist Name</span><p className="font-medium text-sm text-textLight dark:text-textDark">{selectedOrder.dentistName || '-'}</p></div>
                    <div><span className="text-xs text-mutedLight dark:text-mutedDark block">Date Received</span><p className="font-medium text-sm text-textLight dark:text-textDark">{selectedOrder.dateReceived || '-'}</p></div>
                    <div><span className="text-xs text-mutedLight dark:text-mutedDark block">Due Date</span><p className="font-medium text-sm text-textLight dark:text-textDark">{selectedOrder.dueDate || '-'}</p></div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider border-b border-borderLight dark:border-borderDark pb-1 mb-3">Technical Specifications</h4>
                  <div className="space-y-3">
                    <div><span className="text-xs text-mutedLight dark:text-mutedDark block">Product</span><p className="font-medium text-sm text-textLight dark:text-textDark">{selectedOrder.product || '-'}</p></div>
                    <div><span className="text-xs text-mutedLight dark:text-mutedDark block">Shade</span><p className="font-medium text-sm text-textLight dark:text-textDark">{selectedOrder.shade || '-'}</p></div>
                    <div><span className="text-xs text-mutedLight dark:text-mutedDark block">Units (pcs)</span><p className="font-medium text-sm text-textLight dark:text-textDark">{selectedOrder.units || '-'}</p></div>
                    <div><span className="text-xs text-mutedLight dark:text-mutedDark block">Technician</span><p className="font-medium text-sm text-textLight dark:text-textDark">{selectedOrder.techIncharge || 'Unassigned'}</p></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <h4 className="text-[11px] font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider border-b border-borderLight dark:border-borderDark pb-1 mb-3">Financial Details</h4>
                  <div className="bg-pageLight dark:bg-pageDark rounded-md p-4 space-y-2 border border-borderLight dark:border-borderDark">
                    <div className="flex justify-between items-center"><span className="text-xs text-mutedLight dark:text-mutedDark">Total Price</span><span className="font-medium text-sm text-textLight dark:text-textDark">{formatCurrency(selectedOrder.totalPrice || 0)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-xs text-mutedLight dark:text-mutedDark">Amount Paid</span><span className="font-medium text-sm text-green-600 dark:text-green-400">{formatCurrency(selectedOrder.payment || 0)}</span></div>
                    <div className="flex justify-between items-center pt-2 border-t border-borderLight dark:border-borderDark"><span className="text-xs font-semibold text-textLight dark:text-textDark">Remaining Balance</span><span className="font-bold text-sm text-red-600 dark:text-red-400">{formatCurrency(selectedOrder.balance || 0)}</span></div>
                    <div className="pt-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-block ${selectedOrder.payType === 'Fully Paid' || selectedOrder.payType === 'Paid' ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' : selectedOrder.payType === 'Partial' ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30' : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'}`}>{selectedOrder.payType || 'Unpaid'}</span></div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider border-b border-borderLight dark:border-borderDark pb-1 mb-3">Logistics & Notes</h4>
                  <div className="space-y-3">
                    <div><span className="text-xs text-mutedLight dark:text-mutedDark block">Pick up By</span><p className="font-medium text-sm text-textLight dark:text-textDark">{selectedOrder.pickUpBy || '-'}</p></div>
                    <div><span className="text-xs text-mutedLight dark:text-mutedDark block">Deliver By</span><p className="font-medium text-sm text-textLight dark:text-textDark">{selectedOrder.deliverBy || '-'}</p></div>
                    <div><span className="text-xs text-mutedLight dark:text-mutedDark block">Instructions / Remarks</span><p className="font-medium text-sm text-textLight dark:text-textDark">{selectedOrder.descriptions || selectedOrder.remarks || 'None'}</p></div>
                  </div>
                </div>
              </div>

            </div>
            <div className="px-6 py-4 border-t border-borderLight dark:border-borderDark bg-pageLight/50 dark:bg-pageDark/50 flex justify-end rounded-b-md">
              <button onClick={() => setIsViewModalOpen(false)} className="px-4 py-2 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-sm font-medium rounded hover:bg-pageLight dark:hover:bg-pageDark transition-colors shadow-sm">Close Details</button>
            </div>
          </div>
        </div>
      )}

      {selectedHistoryOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-xl w-full max-w-2xl flex flex-col animate-in fade-in max-h-[90vh]">
            <div className="px-5 py-3.5 border-b border-borderLight dark:border-borderDark flex items-center justify-between">
              <h3 className="text-base font-semibold text-textLight dark:text-textDark">Payment History: {selectedHistoryOrder.rxNumber}</h3>
              <button onClick={() => setSelectedHistoryOrder(null)} className="text-mutedLight dark:text-mutedDark hover:text-textLight dark:hover:text-textDark">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="mb-4 grid grid-cols-2 gap-4 bg-pageLight dark:bg-pageDark p-4 rounded border border-borderLight dark:border-borderDark">
                <div>
                  <span className="block text-[11px] text-mutedLight dark:text-mutedDark uppercase font-semibold">Total Invoice</span>
                  <span className="block text-lg font-bold text-textLight dark:text-textDark">{formatCurrency(selectedHistoryOrder.totalPrice)}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-mutedLight dark:text-mutedDark uppercase font-semibold">Current Balance</span>
                  <span className="block text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(selectedHistoryOrder.balance)}</span>
                </div>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-borderLight dark:border-borderDark">
                    <th className="py-2 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Date & Time</th>
                    <th className="py-2 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Recorded By</th>
                    <th className="py-2 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLight dark:divide-borderDark">
                  {transactions.filter(p => p.orderId === selectedHistoryOrder.id).length === 0 ? (
                    <tr><td colSpan="3" className="py-4 text-center text-mutedLight dark:text-mutedDark text-sm">No payment records found.</td></tr>
                  ) : (
                    transactions.filter(p => p.orderId === selectedHistoryOrder.id).map(payment => (
                      <tr key={payment.id}>
                        <td className="py-3 text-sm text-textLight dark:text-textDark">{formatDateTime(payment.timestamp)}</td>
                        <td className="py-3 text-sm text-mutedLight dark:text-mutedDark">{payment.recordedBy}</td>
                        <td className="py-3 text-sm text-right font-bold text-green-600 dark:text-green-400">{formatCurrency(payment.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-borderLight dark:border-borderDark bg-pageLight/50 dark:bg-pageDark/50 flex justify-end rounded-b-md">
              <button onClick={() => setSelectedHistoryOrder(null)} className="px-3 py-1.5 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-sm font-medium rounded hover:bg-pageLight dark:hover:bg-pageDark transition-colors shadow-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {showSOAPreview && soaPrintData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 15h6" /><path d="M9 11h6" /></svg>
                Document Preview
              </h3>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowSOAPreview(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors shadow-sm">Close</button>
                <button onClick={handlePrintHidden} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded hover:bg-primaryHover transition-colors shadow-sm flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" /><path d="M17 9v-4a2 2 0 0 0 -2 -2h-6a2 2 0 0 0 -2 2v4" /><path d="M7 13m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 -2h-6a2 2 0 0 1 -2 -2z" /></svg>
                  Print Document
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-8 bg-gray-100/50">
              <div className="bg-white border border-gray-200 shadow-sm p-10 max-w-[800px] mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
                
                <div className="text-center mb-10 border-b border-gray-200 pb-6">
                  <h1 className="m-0 text-2xl text-gray-900 tracking-tight font-bold">{labSettings.name || 'Fano Laboratory'}</h1>
                  {labSettings.address && <p className="mt-1 mb-0 text-gray-600 text-sm">{labSettings.address}</p>}
                  {(labSettings.phone || labSettings.email) && <p className="mt-0.5 mb-0 text-gray-600 text-sm">{labSettings.phone} {labSettings.phone && labSettings.email ? ' | ' : ''} {labSettings.email}</p>}
                </div>

                <div className="text-center mb-8">
                  <h2 className="m-0 text-lg uppercase tracking-wider text-gray-900 font-bold">Statement of Account</h2>
                </div>

                <div className="flex justify-between mb-8 text-sm text-gray-800">
                  <div>
                    <strong className="block mb-1 text-gray-500 uppercase text-xs tracking-wider">Billed To:</strong>
                    Dr. {soaPrintData.dentistName}
                  </div>
                  <div className="text-right">
                    <strong className="block mb-1 text-gray-500 uppercase text-xs tracking-wider">Statement Date:</strong>
                    {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>

                <table className="w-full border-collapse mb-8 text-sm">
                  <thead>
                    <tr>
                      <th className="border-b-2 border-gray-900 text-left py-2.5 px-2 text-xs uppercase text-gray-600 tracking-wider">Date</th>
                      <th className="border-b-2 border-gray-900 text-left py-2.5 px-2 text-xs uppercase text-gray-600 tracking-wider">RX No.</th>
                      <th className="border-b-2 border-gray-900 text-left py-2.5 px-2 text-xs uppercase text-gray-600 tracking-wider">Patient Name</th>
                      <th className="border-b-2 border-gray-900 text-left py-2.5 px-2 text-xs uppercase text-gray-600 tracking-wider">Product</th>
                      <th className="border-b-2 border-gray-900 text-right py-2.5 px-2 text-xs uppercase text-gray-600 tracking-wider">Gross Amount</th>
                      <th className="border-b-2 border-gray-900 text-right py-2.5 px-2 text-xs uppercase text-gray-600 tracking-wider">Paid</th>
                      <th className="border-b-2 border-gray-900 text-right py-2.5 px-2 text-xs uppercase text-gray-900 font-bold tracking-wider">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soaPrintData.records.map((order, idx) => (
                      <tr key={idx}>
                        <td className="border-b border-gray-200 py-3 px-2 text-gray-800">{order.dateReceived}</td>
                        <td className="border-b border-gray-200 py-3 px-2 text-gray-900 font-semibold">{order.rxNumber}</td>
                        <td className="border-b border-gray-200 py-3 px-2 text-gray-800">{order.patientName}</td>
                        <td className="border-b border-gray-200 py-3 px-2 text-gray-800">{order.product}</td>
                        <td className="border-b border-gray-200 py-3 px-2 text-gray-800 text-right">₱ {parseFloat(order.totalPrice || 0).toFixed(2)}</td>
                        <td className="border-b border-gray-200 py-3 px-2 text-gray-800 text-right">₱ {parseFloat(order.payment || 0).toFixed(2)}</td>
                        <td className="border-b border-gray-200 py-3 px-2 text-gray-900 font-bold text-right">₱ {parseFloat(order.balance || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end pt-4 border-t-2 border-gray-900">
                  <div className="w-[300px] flex justify-between text-base font-bold text-gray-900">
                    <span>Total Balance Due:</span>
                    <span>₱ {soaPrintData.totalOutstanding.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-16 text-center text-xs text-gray-500 space-y-1">
                  <p>Please make all checks payable to <strong>{labSettings.name || 'Fano Laboratory'}</strong>.</p>
                  <p>If you have any questions concerning this statement, contact us.</p>
                  <p>Thank you for your business!</p>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}