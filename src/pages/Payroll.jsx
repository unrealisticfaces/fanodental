import { useState, useEffect } from 'react';
import { useData } from '../DataContext'; 

export default function Payroll({ workspaceUid }) {
  const { orders, technicians: technicianRoster, isInitialLoading: isLoading } = useData();
  const [technicians, setTechnicians] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [commissionRate, setCommissionRate] = useState(25);
  
  const [selectedTech, setSelectedTech] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    setMonthFilter(`${yyyy}-${mm}`);
  }, []);

  useEffect(() => {
    const deliveredOrders = orders.filter(o => o.initialStatus === 'Delivered');
    const filteredOrders = deliveredOrders.filter(o => {
      if (!monthFilter) return true;
      const orderDateStr = o.dateReceived || o.createdAt.split('T')[0];
      return orderDateStr.substring(0, 7) === monthFilter;
    });

    const techMap = {};

    filteredOrders.forEach(o => {
      const techName = o.techIncharge?.trim() || 'Unassigned';
      if (!techMap[techName]) {
        const rosterMatch = technicianRoster.find(t => t.name.toLowerCase() === techName.toLowerCase());
        const isOfficial = !!rosterMatch;
        
        techMap[techName] = {
          name: techName,
          photoURL: rosterMatch?.photoURL || '',
          isLegacy: !isOfficial && techName !== 'Unassigned',
          jobsCompleted: 0,
          unitsCompleted: 0,
          grossGenerated: 0,
          orders: []
        };
      }
      techMap[techName].jobsCompleted += 1;
      techMap[techName].unitsCompleted += (parseInt(o.units) || 0);
      techMap[techName].grossGenerated += (parseFloat(o.totalPrice) || 0);
      techMap[techName].orders.push(o);
    });

    const techArray = Object.values(techMap).sort((a, b) => b.grossGenerated - a.grossGenerated);
    setTechnicians(techArray);
    setCurrentPage(1);
  }, [orders, monthFilter, technicianRoster]);

  const filteredTechnicians = technicians.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const totalPages = Math.ceil(filteredTechnicians.length / itemsPerPage);
  const currentTechnicians = filteredTechnicians.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

  const inputClass = "block w-full px-3 py-2 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded-md text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm";

  if (!workspaceUid) return null;

  // UNDER MAINTENANCE UI
  return (
    <div className="max-w-4xl mx-auto mt-12 animate-in fade-in">
      <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm p-12 text-center flex flex-col items-center justify-center">
        <div className="w-20 h-20 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-full flex items-center justify-center mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-textLight dark:text-textDark mb-3">Payroll Under Maintenance</h2>
        <p className="text-mutedLight dark:text-mutedDark max-w-md mx-auto leading-relaxed">
          This module is temporarily disabled for upgrades and adjustments. All your records are safely stored, and the new payroll system will be available soon.
        </p>
      </div>
    </div>
  );

  /*
  // ORIGINAL PAYROLL CODE (SAFELY COMMENTED OUT)
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm p-4 flex flex-col transition-colors duration-200">
          <span className="text-[11px] font-semibold tracking-wider text-mutedLight dark:text-mutedDark uppercase mb-2">Total Units Produced (pcs)</span>
          <div className="text-2xl font-bold tracking-tight text-textLight dark:text-textDark flex items-center min-h-[32px]">
            {isLoading ? <div className="h-6 w-24 bg-pageLight dark:bg-pageDark rounded animate-pulse"></div> : filteredTechnicians.reduce((sum, t) => sum + t.unitsCompleted, 0)}
          </div>
        </div>
        <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm p-4 flex flex-col transition-colors duration-200">
          <span className="text-[11px] font-semibold tracking-wider text-mutedLight dark:text-mutedDark uppercase mb-2">Gross Value Generated</span>
          <div className="text-2xl font-bold tracking-tight text-textLight dark:text-textDark flex items-center min-h-[32px]">
            {isLoading ? <div className="h-6 w-24 bg-pageLight dark:bg-pageDark rounded animate-pulse"></div> : formatCurrency(filteredTechnicians.reduce((sum, t) => sum + t.grossGenerated, 0))}
          </div>
        </div>
        <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm p-4 flex flex-col transition-colors duration-200 border-l-4 border-l-green-500">
          <span className="text-[11px] font-semibold tracking-wider text-green-600 dark:text-green-500 uppercase mb-2">Total Est. Commissions</span>
          <div className="text-2xl font-bold tracking-tight text-green-600 dark:text-green-400 flex items-center min-h-[32px]">
            {isLoading ? <div className="h-6 w-24 bg-pageLight dark:bg-pageDark rounded animate-pulse"></div> : formatCurrency(filteredTechnicians.reduce((sum, t) => sum + (t.grossGenerated * ((parseFloat(commissionRate) || 0) / 100)), 0))}
          </div>
        </div>
      </div>

      <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm flex flex-col overflow-visible transition-colors duration-200">
        <div className="px-5 py-4 border-b border-borderLight dark:border-borderDark flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-textLight dark:text-textDark whitespace-nowrap">Technician Payroll</h3>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-2 text-sm text-textLight dark:text-textDark w-full sm:w-auto">
              <span className="whitespace-nowrap font-medium">Rate:</span>
              <div className="relative w-24">
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  value={commissionRate} 
                  onChange={(e) => setCommissionRate(e.target.value)} 
                  placeholder="25"
                  className="block w-full pl-3 pr-7 py-2 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded-md text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm"
                />
                <span className="absolute right-3 top-2 text-mutedLight dark:text-mutedDark">%</span>
              </div>
            </div>

            <input 
              type="month" 
              value={monthFilter} 
              onChange={(e) => setMonthFilter(e.target.value)} 
              className={`${inputClass} sm:w-40`} 
            />

            <div className="relative w-full sm:w-56">
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Search technician..." 
                className={`${inputClass} pl-9`} 
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
            </div>
          </div>
        </div>

        <div className="overflow-visible min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-pageLight/50 dark:bg-pageDark/50 border-b border-borderLight dark:border-borderDark">
                <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Technician Profile</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-center">Jobs Completed</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-center">Total Units (pcs)</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">Gross Value</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">Est. Commission</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLight dark:border-borderDark">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse bg-surfaceLight dark:bg-surfaceDark">
                    <td className="px-5 py-4"><div className="h-4 bg-pageLight dark:bg-pageDark rounded w-32"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-pageLight dark:bg-pageDark rounded w-16 mx-auto"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-pageLight dark:bg-pageDark rounded w-16 mx-auto"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-pageLight dark:bg-pageDark rounded w-24 ml-auto"></div></td>
                    <td className="px-5 py-4"><div className="h-4 bg-pageLight dark:bg-pageDark rounded w-24 ml-auto"></div></td>
                    <td className="px-5 py-4 flex justify-end"><div className="h-6 bg-pageLight dark:bg-pageDark rounded w-20"></div></td>
                  </tr>
                ))
              ) : currentTechnicians.length === 0 ? (
                <tr><td colSpan="6" className="px-5 py-6 text-center text-mutedLight dark:text-mutedDark text-sm">No payroll data found for this period.</td></tr>
              ) : (
                currentTechnicians.map(tech => (
                  <tr key={tech.name} className="hover:bg-pageLight dark:hover:bg-pageDark transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-textLight dark:text-textDark whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shadow-sm border border-primary/20 overflow-hidden shrink-0">
                          {tech.photoURL ? (
                            <img src={tech.photoURL} alt={tech.name} className="w-full h-full object-cover" />
                          ) : (
                            tech.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span>{tech.name}</span>
                          {tech.isLegacy && <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">Legacy Data</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-mutedLight dark:text-mutedDark text-center whitespace-nowrap">{tech.jobsCompleted}</td>
                    <td className="px-5 py-3.5 text-sm text-mutedLight dark:text-mutedDark text-center whitespace-nowrap">{tech.unitsCompleted}</td>
                    <td className="px-5 py-3.5 text-sm text-textLight dark:text-textDark text-right whitespace-nowrap">{formatCurrency(tech.grossGenerated)}</td>
                    <td className="px-5 py-3.5 text-sm text-green-600 dark:text-green-400 font-bold text-right whitespace-nowrap">{formatCurrency(tech.grossGenerated * ((parseFloat(commissionRate) || 0) / 100))}</td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === tech.name ? null : tech.name);
                        }}
                        className="inline-flex items-center px-2.5 py-1.5 border border-borderLight dark:border-borderDark rounded text-sm font-medium text-mutedLight dark:text-mutedDark bg-surfaceLight dark:bg-surfaceDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                      >
                        Actions
                        <svg className="ml-1 -mr-0.5 h-4 w-4 text-mutedLight dark:text-mutedDark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                      </button>

                      {openDropdownId === tech.name && (
                        <div className="absolute right-6 top-10 mt-1 w-32 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded shadow-lg z-50 flex flex-col text-left py-1">
                          <button onClick={(e) => { e.stopPropagation(); setSelectedTech(tech); setOpenDropdownId(null); }} className="w-full text-left px-3 py-1.5 text-sm text-textLight dark:text-textDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors">
                            View Jobs
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
        
        {!isLoading && filteredTechnicians.length > 0 && (
          <div className="px-5 py-3 border-t border-borderLight dark:border-borderDark flex items-center justify-between text-sm text-mutedLight dark:text-mutedDark bg-surfaceLight dark:bg-surfaceDark rounded-b-md">
            <span>Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTechnicians.length)} of {filteredTechnicians.length} entries</span>
            
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2 py-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50 text-xs font-medium">First</button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-2 py-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
              </button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className="px-2 py-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50 text-xs font-medium">Last</button>
            </div>
          </div>
        )}
      </div>

      {selectedTech && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-xl w-full max-w-4xl flex flex-col animate-in fade-in max-h-[90vh]">
            <div className="px-5 py-4 border-b border-borderLight dark:border-borderDark flex items-center justify-between bg-pageLight/30 dark:bg-pageDark/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shadow-sm border border-primary/20 overflow-hidden shrink-0">
                  {selectedTech.photoURL ? (
                    <img src={selectedTech.photoURL} alt={selectedTech.name} className="w-full h-full object-cover" />
                  ) : (
                    selectedTech.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-textLight dark:text-textDark flex items-center gap-2">
                    {selectedTech.name}
                    {selectedTech.isLegacy && <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Legacy</span>}
                  </h3>
                  <p className="text-xs text-mutedLight dark:text-mutedDark uppercase tracking-wider mt-0.5">Completed Jobs</p>
                </div>
              </div>
              <button onClick={() => setSelectedTech(null)} className="text-mutedLight dark:text-mutedDark hover:text-textLight dark:hover:text-textDark">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-pageLight dark:bg-pageDark p-4 rounded border border-borderLight dark:border-borderDark">
                <div>
                  <span className="block text-[10px] text-mutedLight dark:text-mutedDark uppercase font-semibold">Total Jobs</span>
                  <span className="block text-base font-bold text-textLight dark:text-textDark">{selectedTech.jobsCompleted}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-mutedLight dark:text-mutedDark uppercase font-semibold">Total Units (pcs)</span>
                  <span className="block text-base font-bold text-textLight dark:text-textDark">{selectedTech.unitsCompleted}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-mutedLight dark:text-mutedDark uppercase font-semibold">Total Gross</span>
                  <span className="block text-base font-bold text-textLight dark:text-textDark">{formatCurrency(selectedTech.grossGenerated)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-mutedLight dark:text-mutedDark uppercase font-semibold">Est. Commission ({commissionRate}%)</span>
                  <span className="block text-base font-bold text-green-600 dark:text-green-400">{formatCurrency(selectedTech.grossGenerated * ((parseFloat(commissionRate) || 0) / 100))}</span>
                </div>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-borderLight dark:border-borderDark">
                    <th className="py-2 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Date</th>
                    <th className="py-2 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">RX No.</th>
                    <th className="py-2 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Product</th>
                    <th className="py-2 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-center">Units (pcs)</th>
                    <th className="py-2 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">Gross Price</th>
                    <th className="py-2 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLight dark:divide-borderDark">
                  {selectedTech.orders.map(order => (
                    <tr key={order.id}>
                      <td className="py-3 text-sm text-textLight dark:text-textDark">{order.dateReceived || order.createdAt.split('T')[0]}</td>
                      <td className="py-3 text-sm text-textLight dark:text-textDark font-medium">{order.rxNumber}</td>
                      <td className="py-3 text-sm text-mutedLight dark:text-mutedDark">{order.product}</td>
                      <td className="py-3 text-sm text-mutedLight dark:text-mutedDark text-center">{order.units || 0}</td>
                      <td className="py-3 text-sm text-right text-mutedLight dark:text-mutedDark">{formatCurrency(order.totalPrice || 0)}</td>
                      <td className="py-3 text-sm text-right font-bold text-green-600 dark:text-green-400">{formatCurrency((parseFloat(order.totalPrice) || 0) * ((parseFloat(commissionRate) || 0) / 100))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-borderLight dark:border-borderDark bg-pageLight/50 dark:bg-pageDark/50 flex justify-end rounded-b-md">
              <button onClick={() => setSelectedTech(null)} className="px-3 py-1.5 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-sm font-medium rounded hover:bg-pageLight dark:hover:bg-pageDark transition-colors shadow-sm">Close Window</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
  */
}