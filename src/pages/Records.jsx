import { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, get, remove, update, push, runTransaction } from 'firebase/database';
import { useToast } from '../ToastContext';
import { useData } from '../DataContext';

export default function Records({ workspaceUid, userProfile }) {
  const { addToast } = useToast();
  const { orders, technicians, labSettings, isInitialLoading: isLoading } = useData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(''); 
  const [productFilter, setProductFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [orderToDelete, setOrderToDelete] = useState(null);

  // 🚀 NEW: Deep Server Search State
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const [deepSearchResults, setDeepSearchResults] = useState(null);

  const canEdit = userProfile?.permissions?.canEdit ?? true;
  const canDelete = userProfile?.permissions?.canDelete ?? false;

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, productFilter, paymentFilter, deepSearchResults]);

  // 🚀 NEW: Direct Server Search Logic
  const handleDeepSearch = async () => {
    if (!workspaceUid || !searchTerm.trim()) return;
    
    setIsDeepSearching(true);
    addToast("Scanning entire database history...", "info");
    
    try {
      const snap = await get(ref(database, `users/${workspaceUid}/orders`));
      if (snap.exists()) {
        const allData = snap.val();
        const searchLower = searchTerm.toLowerCase();
        
        const results = Object.keys(allData)
          .map(key => ({ id: key, ...allData[key] }))
          .filter(o => 
             (o.rxNumber || '').toLowerCase().includes(searchLower) ||
             (o.patientName || '').toLowerCase().includes(searchLower) ||
             (o.dentistName || '').toLowerCase().includes(searchLower)
          ).reverse();
          
        setDeepSearchResults(results);
        
        if (results.length > 0) {
           addToast(`Deep search found ${results.length} historical records.`, "success");
        } else {
           addToast("No records found in the entire database.", "error");
        }
      } else {
        setDeepSearchResults([]);
      }
    } catch (error) {
      addToast("Failed to search server.", "error");
    } finally {
      setIsDeepSearching(false);
    }
  };

  const clearDeepSearch = () => {
    setDeepSearchResults(null);
    setSearchTerm('');
  };

  const confirmDelete = async () => {
    if (!workspaceUid || !orderToDelete) return;
    
    try {
      const orderId = orderToDelete.id;
      
      const deletedTotal = parseFloat(orderToDelete.totalPrice) || 0;
      const deletedPayment = parseFloat(orderToDelete.payment) || 0;
      const safeProd = (orderToDelete.product || 'Unknown').replace(/[\.\#\$\/\[\]]/g, '-');
      const dateStr = (orderToDelete.dateReceived || orderToDelete.createdAt || new Date().toISOString()).substring(0, 10);
      const deletedStatus = orderToDelete.initialStatus;

      await remove(ref(database, `users/${workspaceUid}/orders/${orderId}`));
      
      await runTransaction(ref(database, `users/${workspaceUid}/stats`), (stats) => {
        if (stats) {
          stats.allTimeGross = Math.max(0, (stats.allTimeGross || 0) - deletedTotal);
          stats.allTimeCollected = Math.max(0, (stats.allTimeCollected || 0) - deletedPayment);
          
          if (deletedStatus === 'In progress') {
            stats.activeJobs = Math.max(0, (stats.activeJobs || 0) - 1);
          } else if (deletedStatus === 'Delivered') {
            stats.deliveredJobs = Math.max(0, (stats.deliveredJobs || 0) - 1);
          }

          if (stats.productRevenue && stats.productRevenue[safeProd]) {
            stats.productRevenue[safeProd] = Math.max(0, stats.productRevenue[safeProd] - deletedTotal);
          }

          if (stats.dailyRevenue && stats.dailyRevenue[dateStr]) {
            stats.dailyRevenue[dateStr].gross = Math.max(0, stats.dailyRevenue[dateStr].gross - deletedTotal);
            stats.dailyRevenue[dateStr].collected = Math.max(0, stats.dailyRevenue[dateStr].collected - deletedPayment);
          }
        }
        return stats;
      });

      const logsRef = ref(database, `users/${workspaceUid}/logs`);
      await push(logsRef, {
        action: 'DELETE',
        entity: 'Order',
        entityId: orderId,
        details: `RX No: ${orderToDelete?.rxNumber || 'Unknown'} | Summary: Deleted order for ${orderToDelete?.patientName || 'Unknown'} | Payment: ${orderToDelete?.payType || 'Unknown'}`,
        userName: userProfile?.name || 'Unknown',
        userEmail: userProfile?.email || 'Unknown',
        userPhoto: userProfile?.photoURL || '',
        timestamp: new Date().toISOString()
      });
      
      addToast("Order deleted successfully.", "success");
      if (deepSearchResults) setDeepSearchResults(prev => prev.filter(o => o.id !== orderId));
    } catch (error) {
      addToast("Failed to delete order.", "error");
    } finally {
      setOrderToDelete(null);
    }
  };

  const handleViewDetailsClick = (order) => {
    setSelectedOrder(order);
    setIsViewModalOpen(true);
  };

  const handleEditInfoClick = (order) => {
    setEditingOrder({ ...order });
    setIsInfoModalOpen(true);
  };

  const handleEditPaymentClick = (order) => {
    setEditingOrder({ ...order });
    setNewPaymentAmount('');
    setIsPaymentModalOpen(true);
  };

  const handleInfoChange = (e) => {
    const { name, value } = e.target;
    let newEditingOrder = { ...editingOrder, [name]: value };

    if (name === 'totalPrice') {
      const total = parseFloat(value) || 0;
      const payment = parseFloat(newEditingOrder.payment) || 0;
      newEditingOrder.balance = Math.max(0, total - payment).toString();

      if (payment <= 0) {
        newEditingOrder.payType = 'Unpaid';
      } else if (payment >= total && total > 0) {
        newEditingOrder.payType = 'Fully Paid';
      } else {
        newEditingOrder.payType = 'Partial';
      }
    }

    setEditingOrder(newEditingOrder);
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setEditingOrder({ ...editingOrder, [name]: value });
  };

  const handleInfoUpdate = async (e) => {
    e.preventDefault();
    if (!workspaceUid) return;

    try {
      const orderId = editingOrder.id;
      const updateData = { ...editingOrder };
      delete updateData.id;

      // Ensure we have the original data even if deep searching
      const sourceList = deepSearchResults || orders;
      const originalOrder = sourceList.find(o => o.id === orderId);
      
      let changes = [];
      if (originalOrder) {
        if (originalOrder.patientName !== updateData.patientName) changes.push(`Name to ${updateData.patientName}`);
        if (originalOrder.dentistName !== updateData.dentistName) changes.push(`Dentist to ${updateData.dentistName}`);
        if (originalOrder.product !== updateData.product) changes.push(`Product to ${updateData.product}`);
        if (originalOrder.techIncharge !== updateData.techIncharge) changes.push(`Tech to ${updateData.techIncharge}`);
        if (originalOrder.units !== updateData.units) changes.push(`Units to ${updateData.units}`);
        if (originalOrder.dueDate !== updateData.dueDate) changes.push(`Due Date to ${updateData.dueDate}`);
        if (originalOrder.totalPrice !== updateData.totalPrice) changes.push(`Price to ₱${updateData.totalPrice}`);
      }
      
      const summaryText = changes.length > 0 ? `Updated ${changes.join(', ')}` : 'Updated general information';

      await update(ref(database, `users/${workspaceUid}/orders/${orderId}`), updateData);
      
      if (originalOrder) {
        await runTransaction(ref(database, `users/${workspaceUid}/stats`), (stats) => {
          if (stats) {
            const oldTotal = parseFloat(originalOrder.totalPrice) || 0;
            const newTotal = parseFloat(updateData.totalPrice) || 0;
            const diffTotal = newTotal - oldTotal;

            const oldProd = (originalOrder.product || 'Unknown').replace(/[\.\#\$\/\[\]]/g, '-');
            const newProd = (updateData.product || 'Unknown').replace(/[\.\#\$\/\[\]]/g, '-');

            const oldDate = (originalOrder.dateReceived || originalOrder.createdAt || new Date().toISOString()).substring(0, 10);
            const newDate = (updateData.dateReceived || updateData.createdAt || new Date().toISOString()).substring(0, 10);

            stats.allTimeGross = (stats.allTimeGross || 0) + diffTotal;

            if (!stats.productRevenue) stats.productRevenue = {};
            if (oldProd === newProd) {
                stats.productRevenue[oldProd] = (stats.productRevenue[oldProd] || 0) + diffTotal;
            } else {
                stats.productRevenue[oldProd] = Math.max(0, (stats.productRevenue[oldProd] || 0) - oldTotal);
                stats.productRevenue[newProd] = (stats.productRevenue[newProd] || 0) + newTotal;
            }

            if (!stats.dailyRevenue) stats.dailyRevenue = {};
            if (oldDate === newDate) {
                if (!stats.dailyRevenue[oldDate]) stats.dailyRevenue[oldDate] = { gross: 0, collected: 0 };
                stats.dailyRevenue[oldDate].gross += diffTotal;
            } else {
                if (stats.dailyRevenue[oldDate]) {
                    stats.dailyRevenue[oldDate].gross = Math.max(0, stats.dailyRevenue[oldDate].gross - oldTotal);
                }
                if (!stats.dailyRevenue[newDate]) stats.dailyRevenue[newDate] = { gross: 0, collected: 0 };
                stats.dailyRevenue[newDate].gross += newTotal;
                
                const pay = parseFloat(originalOrder.payment) || 0;
                if (stats.dailyRevenue[oldDate]) {
                    stats.dailyRevenue[oldDate].collected = Math.max(0, stats.dailyRevenue[oldDate].collected - pay);
                }
                stats.dailyRevenue[newDate].collected += pay;
            }
          }
          return stats;
        });
      }

      const logsRef = ref(database, `users/${workspaceUid}/logs`);
      await push(logsRef, {
        action: 'UPDATE',
        entity: 'Order Info',
        entityId: orderId,
        details: `RX No: ${updateData.rxNumber} | Summary: ${summaryText} | Payment: ${updateData.payType}`,
        userName: userProfile?.name || 'Unknown',
        userEmail: userProfile?.email || 'Unknown',
        userPhoto: userProfile?.photoURL || '',
        timestamp: new Date().toISOString()
      });

      setIsInfoModalOpen(false);
      setEditingOrder(null);
      addToast("Order information updated.", "success");
      
      // Update local deep search cache if active
      if (deepSearchResults) {
        setDeepSearchResults(prev => prev.map(o => o.id === orderId ? { ...updateData, id: orderId } : o));
      }
    } catch (error) {
      addToast("Failed to update information.", "error");
    }
  };

  const handlePaymentUpdate = async (e) => {
    e.preventDefault();
    if (!workspaceUid) return;

    try {
      const orderId = editingOrder.id;
      
      const total = parseFloat(editingOrder.totalPrice) || 0;
      const currentPayment = parseFloat(editingOrder.payment) || 0;
      const addedPayment = parseFloat(newPaymentAmount) || 0;
      
      const updatedPayment = currentPayment + addedPayment;
      const updatedBalance = Math.max(0, total - updatedPayment);
      
      let newPayType = 'Unpaid';
      if (updatedPayment > 0 && updatedPayment < total) newPayType = 'Partial';
      if (updatedPayment >= total && total > 0) newPayType = 'Fully Paid';

      const updateData = { 
        ...editingOrder, 
        payment: updatedPayment.toString(),
        balance: updatedBalance.toString(),
        payType: newPayType,
        lastPaymentDate: addedPayment > 0 ? new Date().toISOString() : (editingOrder.lastPaymentDate || null)
      };
      delete updateData.id;

      if (addedPayment > 0) {
        await push(ref(database, `users/${workspaceUid}/payments`), {
          orderId: orderId,
          rxNumber: updateData.rxNumber,
          dentistName: updateData.dentistName,
          amount: addedPayment,
          timestamp: new Date().toISOString(),
          recordedBy: userProfile?.name || 'Unknown'
        });
      }

      let summaryParts = [];
      if (addedPayment > 0) {
        summaryParts.push(`Added payment of ₱${addedPayment.toLocaleString()}`);
      }
      if (summaryParts.length === 0) {
        summaryParts.push('Updated payment details');
      }
      const summaryText = summaryParts.join(' and ');

      await update(ref(database, `users/${workspaceUid}/orders/${orderId}`), updateData);
      
      await runTransaction(ref(database, `users/${workspaceUid}/stats`), (stats) => {
        if (stats) {
          if (addedPayment > 0) {
            stats.allTimeCollected = (stats.allTimeCollected || 0) + addedPayment;

            const dateStr = (editingOrder.dateReceived || editingOrder.createdAt || new Date().toISOString()).substring(0, 10);
            if (!stats.dailyRevenue) stats.dailyRevenue = {};
            if (!stats.dailyRevenue[dateStr]) stats.dailyRevenue[dateStr] = { gross: 0, collected: 0 };
            stats.dailyRevenue[dateStr].collected += addedPayment;
          }

          if (editingOrder.initialStatus !== updateData.initialStatus) {
            if (updateData.initialStatus === 'Delivered') {
                stats.deliveredJobs = (stats.deliveredJobs || 0) + 1;
                stats.activeJobs = Math.max(0, (stats.activeJobs || 0) - 1);
            } else if (updateData.initialStatus === 'In progress') {
                stats.activeJobs = (stats.activeJobs || 0) + 1;
                stats.deliveredJobs = Math.max(0, (stats.deliveredJobs || 0) - 1);
            }
          }
        }
        return stats;
      });

      const logsRef = ref(database, `users/${workspaceUid}/logs`);
      await push(logsRef, {
        action: 'UPDATE',
        entity: 'Order Payment',
        entityId: orderId,
        details: `RX No: ${updateData.rxNumber} | Summary: ${summaryText} | Payment: ${newPayType}`,
        userName: userProfile?.name || 'Unknown',
        userEmail: userProfile?.email || 'Unknown',
        userPhoto: userProfile?.photoURL || '',
        timestamp: new Date().toISOString()
      });

      setIsPaymentModalOpen(false);
      setEditingOrder(null);
      setNewPaymentAmount('');
      addToast("Payment and status updated.", "success");
      
      if (deepSearchResults) {
        setDeepSearchResults(prev => prev.map(o => o.id === orderId ? { ...updateData, id: orderId } : o));
      }
    } catch (error) {
      addToast("Failed to update payment.", "error");
    }
  };

  // 🚀 Switch between local 1000 orders or the Deep Search results
  const searchSource = deepSearchResults || orders;

  const filteredOrders = searchSource.filter(order => {
    // If we are deep searching, the results are already filtered. 
    // We only apply the debounced search to local data.
    if (!deepSearchResults) {
      const searchLower = debouncedSearch.toLowerCase();
      const matchesSearch = (order.rxNumber || '').toLowerCase().includes(searchLower) ||
                            (order.patientName || '').toLowerCase().includes(searchLower) ||
                            (order.dentistName || '').toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    
    const matchesProduct = productFilter === 'All' || order.product === productFilter;
    const matchesPayment = paymentFilter === 'All' || order.payType === paymentFilter;
    
    return matchesProduct && matchesPayment;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const currentOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

  const inputClass = "block w-full px-2.5 py-1.5 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm";
  const readOnlyInputClass = "block w-full px-2.5 py-1.5 text-sm bg-gray-50 dark:bg-[#111824] border border-gray-200 dark:border-[#2b3644] rounded text-gray-500 dark:text-gray-400 cursor-not-allowed focus:outline-none shadow-sm font-medium";
  const labelClass = "block text-sm font-medium text-textLight dark:text-textDark mb-1";

  const Label = ({ title, required = true }) => (
    <label className={labelClass}>
      {title} {required ? <span className="text-red-500">*</span> : <span className="font-normal text-mutedLight dark:text-mutedDark text-xs ml-1">(Optional)</span>}
    </label>
  );

  if (!workspaceUid) return null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm flex flex-col overflow-visible transition-colors duration-200">
        
        <div className="px-5 py-4 border-b border-borderLight dark:border-borderDark flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-textLight dark:text-textDark whitespace-nowrap">
            Laboratory Records
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto items-center">
            
            <div className="flex items-center gap-2 text-sm text-mutedLight dark:text-mutedDark">
              <span>Show</span>
              <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="w-24 px-2.5 py-1.5 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm">
                <option value="All">All</option>
                <option value="PFM">PFM</option>
                <option value="Zirconia">Zirconia</option>
                <option value="Zirconia Coping">Zirconia Coping</option>
                <option value="Emax">Emax</option>
                <option value="HC">HC</option>
                <option value="3D Printing">3D Printing</option>
                <option value="Temporary Crown">Temporary Crown</option>
                <option value="Flexible Denture">Flexible Denture</option>
                <option value="Valplast Denture">Valplast Denture</option>
                <option value="Ordinary Denture">Ordinary Denture</option>
                <option value="Clear/Essex Retainer">Clear/Essex Retainer</option>
              </select>
              <span>entries</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-mutedLight dark:text-mutedDark sm:ml-4">
              <span>Status:</span>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="w-32 px-2.5 py-1.5 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm">
                <option value="All">All</option><option value="Unpaid">Unpaid</option><option value="Partial">Partial</option><option value="Fully Paid">Paid</option>
              </select>
            </div>
            
            {/* 🚀 NEW: Deep Search Bar Interface */}
            <div className="flex items-center gap-2 text-sm text-mutedLight dark:text-mutedDark sm:ml-4">
              <span>Search:</span>
              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <input 
                    type="text" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    disabled={deepSearchResults !== null}
                    placeholder="RX, Name, Dentist..." 
                    className={`block w-full px-3 py-1.5 pl-8 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm ${deepSearchResults ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 top-2 h-4 w-4 text-gray-400 dark:text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                </div>
                
                {searchTerm.trim() !== '' && !deepSearchResults && (
                  <button onClick={handleDeepSearch} disabled={isDeepSearching} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded shadow-sm hover:bg-indigo-700 transition-colors whitespace-nowrap disabled:opacity-50">
                    {isDeepSearching ? 'Searching...' : 'Deep Search Server'}
                  </button>
                )}
                
                {deepSearchResults && (
                  <button onClick={clearDeepSearch} className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400 text-xs font-bold rounded shadow-sm hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors whitespace-nowrap">
                    Clear Search
                  </button>
                )}
              </div>
            </div>
            
          </div>
        </div>

        {deepSearchResults && (
          <div className="px-5 py-2.5 bg-indigo-50 border-b border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800/30 flex items-center justify-between text-sm text-indigo-700 dark:text-indigo-300">
            <span><strong>Deep Search Mode Active.</strong> Showing historical server results for "{searchTerm}".</span>
          </div>
        )}

        <div className="overflow-visible min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surfaceLight dark:bg-surfaceDark border-b border-borderLight dark:border-borderDark">
                <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">RX No.</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Product</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-center">Units</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Dentist</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Technician</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Payment Status</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Job Status</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLight dark:divide-borderDark">
              {isLoading && !isDeepSearching ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse bg-surfaceLight dark:bg-surfaceDark">
                    <td className="px-5 py-4"><div className="h-4 bg-pageLight dark:bg-pageDark rounded w-16"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-pageLight dark:bg-pageDark rounded w-24"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-pageLight dark:bg-pageDark rounded w-10 mx-auto"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-pageLight dark:bg-pageDark rounded w-32"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-pageLight dark:bg-pageDark rounded w-24"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-pageLight dark:bg-pageDark rounded w-16"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-pageLight dark:bg-pageDark rounded w-16"></div></td>
                    <td className="px-5 py-4 flex justify-end"><div className="h-6 bg-pageLight dark:bg-pageDark rounded w-20"></div></td>
                  </tr>
                ))
              ) : currentOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-5 py-8 text-center text-mutedLight dark:text-mutedDark text-sm">
                    {isDeepSearching ? 'Searching database...' : 'No orders found.'}
                  </td>
                </tr>
              ) : (
                currentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-pageLight dark:hover:bg-pageDark transition-colors">
                    <td className="px-5 py-3 text-sm text-mutedLight dark:text-mutedDark whitespace-nowrap">{order.rxNumber}</td>
                    <td className="px-5 py-3 text-sm text-textLight dark:text-textDark whitespace-nowrap font-medium">{order.product}</td>
                    <td className="px-5 py-3 text-sm text-mutedLight dark:text-mutedDark whitespace-nowrap text-center">{order.units || '-'}</td>
                    <td className="px-5 py-3 text-sm text-textLight dark:text-textDark whitespace-nowrap">{order.dentistName}</td>
                    <td className="px-5 py-3 text-sm text-textLight dark:text-textDark whitespace-nowrap">{order.techIncharge || 'Unassigned'}</td>
                    <td className="px-5 py-3 text-sm whitespace-nowrap align-middle">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider w-fit ${
                        order.payType === 'Fully Paid' ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' : order.payType === 'Partial' ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30' : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
                      }`}>{order.payType || 'Unpaid'}</span>
                    </td>
                    <td className="px-5 py-3 text-sm whitespace-nowrap align-middle">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider w-fit ${
                        order.initialStatus === 'Delivered' ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' : 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30'
                      }`}>{order.initialStatus}</span>
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
                            View Details
                          </button>
                          <div className="h-px bg-borderLight dark:bg-borderDark w-full my-1"></div>
                          {canEdit && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleEditInfoClick(order); setOpenDropdownId(null); }} className="w-full text-left px-3 py-1.5 text-sm text-textLight dark:text-textDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors">
                                Update Information
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleEditPaymentClick(order); setOpenDropdownId(null); }} className="w-full text-left px-3 py-1.5 text-sm text-textLight dark:text-textDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors">
                                Update Payment
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <>
                              <div className="h-px bg-borderLight dark:bg-borderDark w-full my-1"></div>
                              <button onClick={(e) => { e.stopPropagation(); setOrderToDelete(order); setOpenDropdownId(null); }} className="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!isLoading && filteredOrders.length > 0 && (
          <div className="px-5 py-3 border-t border-borderLight dark:border-borderDark flex items-center justify-between text-sm text-mutedLight dark:text-mutedDark bg-surfaceLight dark:bg-surfaceDark rounded-b-md">
            <span>Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} entries</span>
            
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded bg-primary text-white text-sm font-medium shadow-sm">{currentPage}</button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-2 py-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

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

      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-xl w-full max-w-sm p-5 flex flex-col animate-in fade-in">
            <h3 className="text-base font-semibold text-textLight dark:text-textDark mb-2">Delete Order</h3>
            <p className="text-sm text-mutedLight dark:text-mutedDark mb-5">
              Are you sure you want to delete order <strong>{orderToDelete.rxNumber}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setOrderToDelete(null)} className="px-3 py-1.5 bg-pageLight dark:bg-pageDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-sm font-medium rounded hover:bg-surfaceLight dark:hover:bg-surfaceDark transition-colors shadow-sm">Cancel</button>
              <button onClick={confirmDelete} className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors shadow-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {isInfoModalOpen && editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in fade-in">
            <div className="px-5 py-3.5 border-b border-borderLight dark:border-borderDark flex items-center justify-between">
              <h3 className="text-base font-semibold text-textLight dark:text-textDark">Update Information: {editingOrder.rxNumber}</h3>
              <button onClick={() => setIsInfoModalOpen(false)} className="text-mutedLight dark:text-mutedDark hover:text-textLight dark:hover:text-textDark">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5 flex-1">
              <form id="infoForm" onSubmit={handleInfoUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><Label title="Patient Name" /><input type="text" name="patientName" value={editingOrder.patientName} onChange={handleInfoChange} className={inputClass} required /></div>
                <div><Label title="Dentist Name" /><input type="text" name="dentistName" value={editingOrder.dentistName} onChange={handleInfoChange} className={inputClass} required /></div>
                <div>
                  <Label title="Product" />
                  <select name="product" value={editingOrder.product} onChange={handleInfoChange} className={inputClass} required>
                    <option value="PFM">PFM</option>
                    <option value="Zirconia">Zirconia</option>
                    <option value="Zirconia Coping">Zirconia Coping</option>
                    <option value="Emax">Emax</option>
                    <option value="HC">HC</option>
                    <option value="3D Printing">3D Printing</option>
                    <option value="Temporary Crown">Temporary Crown</option>
                    <option value="Flexible Denture">Flexible Denture</option>
                    <option value="Valplast Denture">Valplast Denture</option>
                    <option value="Ordinary Denture">Ordinary Denture</option>
                    <option value="Clear/Essex Retainer">Clear/Essex Retainer</option>
                  </select>
                </div>
                <div>
                  <Label title="Tech Incharge" />
                  <select name="techIncharge" value={editingOrder.techIncharge || ''} onChange={handleInfoChange} className={inputClass} required>
                    <option value="">Unassigned</option>
                    {technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                    {editingOrder.techIncharge && !technicians.some(t => t.name === editingOrder.techIncharge) && (
                      <option value={editingOrder.techIncharge}>{editingOrder.techIncharge} (Legacy)</option>
                    )}
                  </select>
                </div>
                <div><Label title="Units (pcs)" /><input type="number" name="units" value={editingOrder.units} onChange={handleInfoChange} className={inputClass} required /></div>
                <div><Label title="Due Date" /><input type="date" name="dueDate" value={editingOrder.dueDate} onChange={handleInfoChange} className={inputClass} required /></div>
                <div><Label title="Total Price" /><input type="number" name="totalPrice" value={editingOrder.totalPrice} onChange={handleInfoChange} className={inputClass} required /></div>
              </form>
            </div>
            <div className="px-5 py-3 border-t border-borderLight dark:border-borderDark bg-pageLight/50 dark:bg-pageDark/50 flex justify-end gap-3 rounded-b-md">
              <button type="button" onClick={() => setIsInfoModalOpen(false)} className="px-3 py-1.5 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-sm font-medium rounded hover:bg-pageLight dark:hover:bg-pageDark transition-colors shadow-sm">Cancel</button>
              <button type="submit" form="infoForm" className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded hover:bg-primaryHover transition-colors shadow-sm">Save Information</button>
            </div>
          </div>
        </div>
      )}

      {isPaymentModalOpen && editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-xl w-full max-w-md flex flex-col max-h-[90vh] animate-in fade-in">
            <div className="px-5 py-3.5 border-b border-borderLight dark:border-borderDark flex items-center justify-between">
              <h3 className="text-base font-semibold text-textLight dark:text-textDark">Update Payment: {editingOrder.rxNumber}</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-mutedLight dark:text-mutedDark hover:text-textLight dark:hover:text-textDark">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-5 flex-1">
              <div className="bg-pageLight dark:bg-pageDark border border-borderLight dark:border-borderDark rounded p-4 mb-5 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-mutedLight dark:text-mutedDark">Total Price</span>
                  <span className="font-semibold text-textLight dark:text-textDark">₱ {parseFloat(editingOrder.totalPrice || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-mutedLight dark:text-mutedDark">Previous Payment</span>
                  <span className="font-semibold text-textLight dark:text-textDark">₱ {parseFloat(editingOrder.payment || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-borderLight dark:border-borderDark mt-2">
                  <span className="text-mutedLight dark:text-mutedDark font-medium">Remaining Balance</span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    ₱ {Math.max(0, (parseFloat(editingOrder.totalPrice || 0) - parseFloat(editingOrder.payment || 0)) - (parseFloat(newPaymentAmount || 0))).toLocaleString()}
                  </span>
                </div>
              </div>
              <form id="paymentForm" onSubmit={handlePaymentUpdate} className="space-y-4">
                <div>
                  <Label title="New Payment Amount" required={false} />
                  <div className="relative">
                    <span className="absolute left-3 top-1.5 text-mutedLight dark:text-mutedDark font-medium">₱</span>
                    <input type="number" min="0" step="any" value={newPaymentAmount} onChange={(e) => setNewPaymentAmount(e.target.value)} className={`${inputClass} pl-7`} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <Label title="Job Status" />
                  <select name="initialStatus" value={editingOrder.initialStatus} onChange={handlePaymentChange} className={inputClass} required>
                    <option value="In progress">In progress</option><option value="Delivered">Delivered</option>
                  </select>
                </div>
              </form>
            </div>
            <div className="px-5 py-3 border-t border-borderLight dark:border-borderDark bg-pageLight/50 dark:bg-pageDark/50 flex justify-end gap-3 rounded-b-md">
              <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-3 py-1.5 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-sm font-medium rounded hover:bg-pageLight dark:hover:bg-pageDark transition-colors shadow-sm">Cancel</button>
              <button type="submit" form="paymentForm" className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded hover:bg-primaryHover transition-colors shadow-sm">Update Details</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}