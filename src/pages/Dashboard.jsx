import { useState, useEffect } from 'react';
import { useData } from '../DataContext';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard({ workspaceUid }) {
  // 🚀 Brought in stats from Context
  const { orders, stats, isInitialLoading: isLoading } = useData();

  const [overdueOrders, setOverdueOrders] = useState([]);
  const [dueTodayOrders, setDueTodayOrders] = useState([]);
  const [dueTomorrowOrders, setDueTomorrowOrders] = useState([]);
  
  const [overduePage, setOverduePage] = useState(1);
  const [dueTodayPage, setDueTodayPage] = useState(1);
  const [dueTomorrowPage, setDueTomorrowPage] = useState(1);

  useEffect(() => {
    if (isLoading || !orders) return;

    const overdueJobs = [];
    const dueTodayJobs = [];
    const dueTomorrowJobs = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    orders.forEach(order => {
      if (order.initialStatus === 'In progress' && order.dueDate) {
        const [y, m, d] = order.dueDate.split('-');
        const due = new Date(y, m - 1, d);
        due.setHours(0, 0, 0, 0);

        if (due < today) {
           overdueJobs.push(order);
        } else if (due.getTime() === today.getTime()) {
           dueTodayJobs.push(order);
        } else if (due.getTime() === tomorrow.getTime()) {
           dueTomorrowJobs.push(order);
        }
      }
    });

    overdueJobs.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    dueTodayJobs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    dueTomorrowJobs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    setOverdueOrders(overdueJobs);
    setDueTodayOrders(dueTodayJobs);
    setDueTomorrowOrders(dueTomorrowJobs);
  }, [orders, isLoading]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
  };

  // 🚀 Instantly grab all-time totals from the Ledger
  const gross = stats?.allTimeGross || 0;
  const collected = stats?.allTimeCollected || 0;
  const outstanding = Math.max(0, gross - collected);
  
  // Calculate specific overdue money quickly from the active overdue array
  const overdueMoney = overdueOrders.reduce((sum, order) => {
     const bal = Math.max(0, (parseFloat(order.totalPrice)||0) - (parseFloat(order.payment)||0));
     return sum + bal;
  }, 0);
  
  const active = stats?.activeJobs || 0;
  const delivered = stats?.deliveredJobs || 0;

  const TABLER_BLUE_SHADES = ['#206bc4', '#4299e1', '#74c0fc', '#a5d8ff', '#e9ecef'];

  const pieData = [
    { name: 'Collected', value: collected, color: TABLER_BLUE_SHADES[0] },    
    { name: 'Outstanding', value: outstanding, color: TABLER_BLUE_SHADES[1] }, 
    { name: 'Overdue', value: overdueMoney, color: TABLER_BLUE_SHADES[2] }         
  ].filter(d => d.value > 0);

  const productStats = stats?.productRevenue || {};
  const sortedProducts = Object.keys(productStats)
    .map(key => ({ name: key, value: productStats[key] }))
    .sort((a, b) => b.value - a.value);

  let productPieData = sortedProducts.slice(0, 4);
  const othersValue = sortedProducts.slice(4).reduce((sum, item) => sum + item.value, 0);
  if (othersValue > 0) productPieData.push({ name: 'Other', value: othersValue });

  productPieData = productPieData.map((item, index) => ({
    ...item, color: TABLER_BLUE_SHADES[index % TABLER_BLUE_SHADES.length]
  })).filter(d => d.value > 0);

  const dailyStats = stats?.dailyRevenue || {};
  const chartData = Object.keys(dailyStats)
    .sort((a, b) => new Date(a) - new Date(b))
    .slice(-14)
    .map(date => {
      const d = new Date(date);
      return {
        name: d.toLocaleString('en-GB', { day: 'numeric', month: 'short' }),
        gross: dailyStats[date].gross || 0,
        collected: dailyStats[date].collected || 0
      };
    });

  const TablerTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 px-3.5 py-3 rounded-lg shadow-xl text-sm min-w-[180px] pointer-events-none relative z-[100]">
          <p className="text-white font-semibold mb-2.5 pb-2 border-b border-gray-700">{label}</p>
          {payload.map((p, idx) => (
            <div key={idx} className="flex justify-between items-center gap-4 mb-1.5 last:mb-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.stroke || p.color }}></span>
                <span className="text-gray-300">{p.name}:</span>
              </div>
              <span className="font-bold text-white">{formatCurrency(p.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const fill = payload[0].payload?.color || payload[0].fill;
      const name = payload[0].payload?.name || payload[0].name;
      const value = payload[0].value;
      
      return (
        <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-xl text-sm min-w-[150px] pointer-events-none relative z-[100]">
           <div className="flex items-center gap-2 mb-2">
             <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: fill }}></span>
             <span className="text-gray-300 font-medium">{name}</span>
           </div>
           <span className="font-bold text-white block text-lg">{formatCurrency(value)}</span>
        </div>
      );
    }
    return null;
  };

  const StatCard = ({ title, value, icon, colorClass }) => (
    <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm p-4 flex flex-col transition-colors duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold tracking-wider text-mutedLight dark:text-mutedDark uppercase whitespace-nowrap overflow-hidden text-ellipsis mr-2">{title}</span>
        <div className={`p-1.5 rounded-md shrink-0 ${colorClass}`}>
          {icon}
        </div>
      </div>
      <div className="text-xl font-bold text-textLight dark:text-textDark tracking-tight flex items-center min-h-[28px] truncate">
        {isLoading ? <div className="h-6 w-20 bg-pageLight dark:bg-pageDark rounded animate-pulse"></div> : value}
      </div>
    </div>
  );

  const JobTable = ({ title, data, page, setPage, accentClass }) => {
    const itemsPerPage = 5;
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const currentData = data.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    return (
      <div className={`bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm flex flex-col overflow-hidden border-t-[3px] ${accentClass}`}>
        <div className="px-4 py-3 border-b border-borderLight dark:border-borderDark flex items-center justify-between">
          <h3 className="text-sm font-semibold text-textLight dark:text-textDark">{title}</h3>
          <span className="text-xs font-medium bg-pageLight dark:bg-pageDark px-2 py-0.5 rounded text-mutedLight dark:text-mutedDark">{data.length} Jobs</span>
        </div>
        <div className="overflow-x-auto flex-1 min-h-[250px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-pageLight/50 dark:bg-pageDark/50 border-b border-borderLight dark:border-borderDark">
                <th className="px-4 py-2.5 text-[10px] font-bold text-mutedLight dark:text-mutedDark uppercase tracking-wider">RX No.</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Dentist</th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Product</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLight dark:divide-borderDark">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-3.5 bg-pageLight dark:bg-pageDark rounded w-12"></div></td>
                    <td className="px-4 py-3"><div className="h-3.5 bg-pageLight dark:bg-pageDark rounded w-20"></div></td>
                    <td className="px-4 py-3"><div className="h-3.5 bg-pageLight dark:bg-pageDark rounded w-16"></div></td>
                  </tr>
                ))
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-4 py-8 text-center text-mutedLight dark:text-mutedDark text-xs">No pending jobs.</td>
                </tr>
              ) : (
                currentData.map(order => (
                  <tr key={order.id} className="hover:bg-pageLight dark:hover:bg-pageDark transition-colors">
                    <td className="px-4 py-3 text-xs text-textLight dark:text-textDark font-medium whitespace-nowrap">{order.rxNumber}</td>
                    <td className="px-4 py-3 text-xs text-mutedLight dark:text-mutedDark whitespace-nowrap truncate max-w-[120px]">{order.dentistName}</td>
                    <td className="px-4 py-3 text-xs text-mutedLight dark:text-mutedDark whitespace-nowrap truncate max-w-[100px]">{order.product}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && data.length > 0 && (
          <div className="px-4 py-2.5 border-t border-borderLight dark:border-borderDark flex items-center justify-between bg-surfaceLight dark:bg-surfaceDark mt-auto">
             <span className="text-[10px] font-medium text-mutedLight dark:text-mutedDark">
               {((page - 1) * itemsPerPage) + 1}-{Math.min(page * itemsPerPage, data.length)} of {data.length}
             </span>
             <div className="flex items-center gap-1">
               <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50 text-mutedLight dark:text-mutedDark transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
               </button>
               <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="p-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50 text-mutedLight dark:text-mutedDark transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
               </button>
             </div>
          </div>
        )}
      </div>
    );
  };

  if (!workspaceUid) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-textLight dark:text-textDark">Dashboard Overview</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard 
          title="Gross Revenue" 
          value={formatCurrency(gross)} 
          colorClass="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-500"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" /><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M14 11h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2.5" /><path d="M12 17v1m0 -8v1" /></svg>}
        />
        <StatCard 
          title="Collected" 
          value={formatCurrency(collected)} 
          colorClass="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-500"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 9m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z" /><path d="M14 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 9v-2a2 2 0 0 0 -2 -2h-10a2 2 0 0 0 -2 2v6a2 2 0 0 0 2 2h2" /></svg>}
        />
        <StatCard 
          title="Outstanding" 
          value={formatCurrency(outstanding)} 
          colorClass="bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-500"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12" /><path d="M20 12v4h-4a2 2 0 0 1 0 -4h4" /></svg>}
        />
        <StatCard 
          title="Overdue" 
          value={formatCurrency(overdueMoney)} 
          colorClass="bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-500"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>}
        />
        <StatCard 
          title="Active Jobs" 
          value={active} 
          colorClass="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-500"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 7m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2" /><path d="M12 12l0 .01" /><path d="M3 13a20 20 0 0 0 18 0" /></svg>}
        />
        <StatCard 
          title="Jobs Delivered" 
          value={delivered} 
          colorClass="bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-500"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5" /><path d="M3 9l4 0" /></svg>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        <div className="lg:col-span-2 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm flex flex-col overflow-visible">
          <div className="px-5 py-4 border-b border-borderLight dark:border-borderDark flex items-center justify-between">
            <h3 className="text-base font-semibold text-textLight dark:text-textDark">Daily Revenue Overview</h3>
          </div>
          <div className="p-5 h-[340px]">
            {isLoading ? (
              <div className="w-full h-full animate-pulse bg-pageLight dark:bg-pageDark rounded border border-borderLight dark:border-borderDark"></div>
            ) : chartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-mutedLight dark:text-mutedDark">
                No revenue data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} minTickGap={20} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(value) => `₱${(value/1000)}k`} dx={-10} />
                  <Tooltip content={<TablerTooltip />} cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '3 3' }} />
                  <Area type="monotone" name="Gross" dataKey="gross" stroke="#206bc4" strokeWidth={2} fillOpacity={0.16} fill="#206bc4" activeDot={{ r: 5, fill: "#206bc4", stroke: "#fff", strokeWidth: 2 }} />
                  <Area type="monotone" name="Collected" dataKey="collected" stroke="#74c0fc" strokeWidth={2} fillOpacity={0.16} fill="#74c0fc" activeDot={{ r: 5, fill: "#74c0fc", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm flex flex-col overflow-visible">
          <div className="px-5 py-4 border-b border-borderLight dark:border-borderDark">
            <h3 className="text-base font-semibold text-textLight dark:text-textDark">Revenue Distribution</h3>
          </div>
          <div className="p-5 flex-1 flex flex-col">
            {isLoading ? (
              <div className="w-full h-full animate-pulse bg-pageLight dark:bg-pageDark rounded border border-borderLight dark:border-borderDark min-h-[250px]"></div>
            ) : pieData.length === 0 ? (
              <div className="w-full flex-1 flex items-center justify-center text-sm text-mutedLight dark:text-mutedDark min-h-[250px]">
                No distributions available
              </div>
            ) : (
              <>
                <div className="relative h-[220px] w-full flex items-center justify-center mt-2 mb-4">
                  <div className="w-full h-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<PieTooltip />} cursor={{ fill: 'transparent' }} />
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                          style={{ outline: 'none' }}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="mt-auto flex flex-wrap justify-center gap-x-4 gap-y-2 pb-1">
                  {pieData.map((entry, index) => (
                     <div key={index} className="flex items-center gap-1.5 text-xs">
                       <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
                       <span className="text-mutedLight dark:text-mutedDark">{entry.name}</span>
                     </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm flex flex-col overflow-visible">
          <div className="px-5 py-4 border-b border-borderLight dark:border-borderDark">
            <h3 className="text-base font-semibold text-textLight dark:text-textDark">Top Products</h3>
          </div>
          <div className="p-5 flex-1 flex flex-col">
            {isLoading ? (
              <div className="w-full h-full animate-pulse bg-pageLight dark:bg-pageDark rounded border border-borderLight dark:border-borderDark min-h-[250px]"></div>
            ) : productPieData.length === 0 ? (
              <div className="w-full flex-1 flex items-center justify-center text-sm text-mutedLight dark:text-mutedDark min-h-[250px]">
                No product data available
              </div>
            ) : (
              <>
                <div className="relative h-[220px] w-full flex items-center justify-center mt-2 mb-4">
                  <div className="w-full h-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<PieTooltip />} cursor={{ fill: 'transparent' }} />
                        <Pie
                          data={productPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                          style={{ outline: 'none' }}
                        >
                          {productPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="mt-auto flex flex-wrap justify-center gap-x-4 gap-y-2 pb-1">
                  {productPieData.map((entry, index) => (
                     <div key={index} className="flex items-center gap-1.5 text-xs">
                       <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
                       <span className="text-mutedLight dark:text-mutedDark">{entry.name}</span>
                     </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
         <JobTable title="Overdue" data={overdueOrders} page={overduePage} setPage={setOverduePage} accentClass="border-t-red-500 dark:border-t-red-500" />
         <JobTable title="Due Today" data={dueTodayOrders} page={dueTodayPage} setPage={setDueTodayPage} accentClass="border-t-amber-500 dark:border-t-amber-500" />
         <JobTable title="Due Tomorrow" data={dueTomorrowOrders} page={dueTomorrowPage} setPage={setDueTomorrowPage} accentClass="border-t-blue-500 dark:border-t-blue-500" />
      </div>

    </div>
  );
}