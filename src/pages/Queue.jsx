import { useState, useEffect } from 'react';
import { useData } from '../DataContext';

export default function Queue({ workspaceUid }) {
  const { orders, isInitialLoading: isLoading } = useData();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Updates the clock every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (!workspaceUid) return null;

  // 1. Filter out delivered items
  const activeOrders = orders.filter(o => o.initialStatus !== 'Delivered');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 2. Bucket them into columns
  const todayList = [];
  const tomorrowList = [];
  const upcomingList = [];

  activeOrders.forEach(order => {
    if (!order.dueDate) {
      upcomingList.push({ order, diffDays: 999 });
      return;
    }
    
    const [year, month, day] = order.dueDate.split('-');
    const due = new Date(year, month - 1, day);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      todayList.push({ order, diffDays });
    } else if (diffDays === 1) {
      tomorrowList.push({ order, diffDays });
    } else {
      upcomingList.push({ order, diffDays });
    }
  });

  // 3. Sort each column by due date & creation time
  const sortLogic = (a, b) => {
    if (a.diffDays !== b.diffDays) return a.diffDays - b.diffDays;
    return new Date(a.order.createdAt) - new Date(b.order.createdAt);
  };

  todayList.sort(sortLogic);
  tomorrowList.sort(sortLogic);
  upcomingList.sort(sortLogic);

  const timeString = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateString = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Authentic Tabler-style Card
  const TablerCard = ({ item, statusColor }) => {
    const { order, diffDays } = item;
    
    return (
      <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md p-4 mb-3 shadow-sm relative transition-colors group">
        
        {diffDays < 0 && (
           <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-bl-md rounded-tr-md animate-pulse tracking-widest">
             Overdue
           </div>
        )}

        <div className="flex justify-between items-start mb-2 mt-1">
          <div className="text-xl font-bold text-textLight dark:text-textDark tracking-tight">
            {order.rxNumber}
          </div>
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-pageLight dark:bg-[#111824] text-mutedLight dark:text-mutedDark border border-borderLight dark:border-borderDark">
            {order.techIncharge || 'Unassigned'}
          </span>
        </div>

        <div className="mb-3">
          <div className={`text-base font-semibold ${statusColor}`}>
            {order.units}x {order.product}
          </div>
          {order.descriptions && (
            <div className="text-sm text-mutedLight dark:text-mutedDark mt-1 leading-snug">
              {order.descriptions}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-borderLight dark:border-borderDark mt-1">
          <div className="text-sm font-semibold text-textLight dark:text-textDark truncate pr-2">
            Dr. {order.dentistName}
          </div>
          <div className="text-xs text-mutedLight dark:text-mutedDark shrink-0 font-medium">
            Shade: <span className="text-textLight dark:text-textDark font-semibold">{order.shade || 'N/A'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in pb-10">
      
      {/* Header Panel (Tabler Page Header Style) */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-textLight dark:text-textDark tracking-tight">
            Production Board
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-sm text-mutedLight dark:text-mutedDark font-medium">Live database sync active</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tracking-tight text-textLight dark:text-textDark leading-none">{timeString}</div>
          <div className="text-sm font-medium text-mutedLight dark:text-mutedDark mt-1">{dateString}</div>
        </div>
      </div>

      {/* Grid Layout (items-start prevents columns from stretching equally if one is longer) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* COLUMN 1: TODAY (Urgent - Red Top Border) */}
        <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm border-t-[3px] border-t-red-500 flex flex-col">
          <div className="px-4 py-3 border-b border-borderLight dark:border-borderDark flex justify-between items-center bg-gray-50/50 dark:bg-transparent">
            <h3 className="text-sm font-semibold text-textLight dark:text-textDark uppercase tracking-wider">Due Today</h3>
            <span className="bg-pageLight dark:bg-[#111824] text-textLight dark:text-textDark text-xs font-bold px-2 py-0.5 rounded border border-borderLight dark:border-borderDark">{todayList.length}</span>
          </div>
          <div className="p-4 bg-pageLight dark:bg-pageDark rounded-b-md">
            {isLoading ? (
               <div className="text-center py-8 text-mutedLight dark:text-mutedDark text-sm animate-pulse">Loading data...</div>
            ) : todayList.length === 0 ? (
               <div className="py-12 text-center text-mutedLight dark:text-mutedDark text-sm border-2 border-dashed border-borderLight dark:border-borderDark rounded-md">No jobs due today</div>
            ) : (
               todayList.map(item => <TablerCard key={item.order.id} item={item} statusColor="text-red-600 dark:text-red-400" />)
            )}
          </div>
        </div>

        {/* COLUMN 2: TOMORROW (Warning - Yellow Top Border) */}
        <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm border-t-[3px] border-t-amber-500 flex flex-col">
          <div className="px-4 py-3 border-b border-borderLight dark:border-borderDark flex justify-between items-center bg-gray-50/50 dark:bg-transparent">
            <h3 className="text-sm font-semibold text-textLight dark:text-textDark uppercase tracking-wider">Due Tomorrow</h3>
            <span className="bg-pageLight dark:bg-[#111824] text-textLight dark:text-textDark text-xs font-bold px-2 py-0.5 rounded border border-borderLight dark:border-borderDark">{tomorrowList.length}</span>
          </div>
          <div className="p-4 bg-pageLight dark:bg-pageDark rounded-b-md">
            {isLoading ? (
               <div className="text-center py-8 text-mutedLight dark:text-mutedDark text-sm animate-pulse">Loading data...</div>
            ) : tomorrowList.length === 0 ? (
               <div className="py-12 text-center text-mutedLight dark:text-mutedDark text-sm border-2 border-dashed border-borderLight dark:border-borderDark rounded-md">No jobs due tomorrow</div>
            ) : (
               tomorrowList.map(item => <TablerCard key={item.order.id} item={item} statusColor="text-amber-600 dark:text-amber-500" />)
            )}
          </div>
        </div>

        {/* COLUMN 3: UPCOMING (Info - Blue Top Border) */}
        <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm border-t-[3px] border-t-blue-500 flex flex-col">
          <div className="px-4 py-3 border-b border-borderLight dark:border-borderDark flex justify-between items-center bg-gray-50/50 dark:bg-transparent">
            <h3 className="text-sm font-semibold text-textLight dark:text-textDark uppercase tracking-wider">Upcoming</h3>
            <span className="bg-pageLight dark:bg-[#111824] text-textLight dark:text-textDark text-xs font-bold px-2 py-0.5 rounded border border-borderLight dark:border-borderDark">{upcomingList.length}</span>
          </div>
          <div className="p-4 bg-pageLight dark:bg-pageDark rounded-b-md">
            {isLoading ? (
               <div className="text-center py-8 text-mutedLight dark:text-mutedDark text-sm animate-pulse">Loading data...</div>
            ) : upcomingList.length === 0 ? (
               <div className="py-12 text-center text-mutedLight dark:text-mutedDark text-sm border-2 border-dashed border-borderLight dark:border-borderDark rounded-md">No upcoming jobs</div>
            ) : (
               upcomingList.map(item => <TablerCard key={item.order.id} item={item} statusColor="text-blue-600 dark:text-blue-400" />)
            )}
          </div>
        </div>

      </div>
    </div>
  );
}