import { useState, useEffect } from 'react';
import { useData } from '../DataContext'; 

export default function Queue({ workspaceUid }) {
  const { orders, isInitialLoading: isLoading } = useData();

  const [board, setBoard] = useState({
    overdue: [],
    dueToday: [],
    upcoming: []
  });

  useEffect(() => {
    if (isLoading || !orders) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const categories = { overdue: [], dueToday: [], upcoming: [] };

    orders.forEach(order => {
      if (order.initialStatus !== 'Delivered') {
        if (!order.dueDate) {
          categories.upcoming.push(order);
          return;
        }

        const [y, m, d] = order.dueDate.split('-');
        const due = new Date(y, m - 1, d);
        due.setHours(0, 0, 0, 0);

        if (due < today) {
          categories.overdue.push(order);
        } else if (due.getTime() === today.getTime()) {
          categories.dueToday.push(order);
        } else {
          categories.upcoming.push(order);
        }
      }
    });

    const sortByDate = (a, b) => new Date(a.dueDate || '9999-12-31') - new Date(b.dueDate || '9999-12-31');
    
    categories.overdue.sort(sortByDate);
    categories.dueToday.sort(sortByDate);
    categories.upcoming.sort(sortByDate);

    setBoard(categories);
  }, [orders, isLoading]);

  if (!workspaceUid) return null;

  const JobCard = ({ order, status }) => {
    const tablerColors = {
      overdue: { ribbon: 'border-l-red-500', badge: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400', date: 'text-red-600 dark:text-red-400' },
      dueToday: { ribbon: 'border-l-amber-500', badge: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400', date: 'text-amber-600 dark:text-amber-400' },
      upcoming: { ribbon: 'border-l-blue-500', badge: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400', date: 'text-mutedLight dark:text-mutedDark' },
    }[status];

    const techName = order.techIncharge && order.techIncharge !== 'Unassigned' ? order.techIncharge : 'UNASSIGNED';
    const techInitial = techName !== 'UNASSIGNED' ? techName.charAt(0).toUpperCase() : '?';

    return (
      <div className={`bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm mb-4 flex flex-col relative overflow-hidden transition-all hover:shadow`}>
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${tablerColors.ribbon} border-l-[4px]`}></div>
        
        <div className="p-3.5 sm:p-4 pl-4 sm:pl-5">
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-bold text-base sm:text-lg text-textLight dark:text-textDark m-0 leading-tight">
              {order.rxNumber}
            </h3>
            <span className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${tablerColors.badge}`}>
              {order.units || 1} Unit{order.units > 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="text-xs sm:text-sm font-medium text-mutedLight dark:text-mutedDark mb-3">
            Dr. {order.dentistName}
          </div>

          <div className="bg-pageLight dark:bg-pageDark border border-borderLight dark:border-borderDark rounded p-2 sm:p-3 mb-3">
            <div className="flex justify-between items-center text-xs sm:text-sm mb-1.5">
              <span className="text-mutedLight dark:text-mutedDark">Product:</span>
              <span className="font-semibold text-textLight dark:text-textDark">{order.product}</span>
            </div>
            {order.shade && (
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-mutedLight dark:text-mutedDark">Shade:</span>
                <span className="font-semibold text-textLight dark:text-textDark">{order.shade}</span>
              </div>
            )}
          </div>

          {order.descriptions && (
            <div className="mb-1 text-xs sm:text-sm text-textLight dark:text-textDark leading-relaxed">
              <span className="text-[10px] font-bold text-mutedLight dark:text-mutedDark uppercase tracking-wider block mb-0.5">Description</span>
              {order.descriptions}
            </div>
          )}
        </div>

        <div className="px-3.5 sm:px-4 pl-4 sm:pl-5 py-2.5 sm:py-3 border-t border-borderLight dark:border-borderDark bg-pageLight/30 dark:bg-pageDark/30 flex justify-between items-center mt-auto">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs sm:text-sm shadow-sm border border-primary/20 shrink-0">
              {techInitial}
            </span>
            <div className="flex flex-col leading-none">
               <span className="font-bold text-xs sm:text-sm text-textLight dark:text-textDark uppercase tracking-wide truncate max-w-[100px] sm:max-w-[120px]">{techName}</span>
               <span className="text-[9px] sm:text-[10px] text-mutedLight dark:text-mutedDark uppercase font-medium mt-1">Technician</span>
            </div>
          </div>
          
          <div className={`flex items-center gap-1 sm:gap-1.5 font-bold text-xs sm:text-sm ${tablerColors.date}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="16" rx="2" /><line x1="16" y1="3" x2="16" y2="7" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="4" y1="11" x2="20" y2="11" /></svg>
            {order.dueDate || 'No Date'}
          </div>
        </div>
      </div>
    );
  };

  const Column = ({ title, count, items, status, emptyText }) => {
    const dotColor = status === 'overdue' ? 'bg-red-500' : status === 'dueToday' ? 'bg-amber-500' : 'bg-blue-500';

    return (
      // 🚀 Mobile Fix: Column height restricted to 60vh on phones so it doesn't drag forever. Desktop stays 85vh.
      <div className="flex flex-col h-[60vh] lg:h-[85vh] bg-transparent">
        <div className="px-1 py-3 mb-1 sm:mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${dotColor} shadow-sm`}></span>
            <h3 className="font-bold text-sm sm:text-base text-textLight dark:text-textDark uppercase tracking-wider m-0">
              {title}
            </h3>
          </div>
          <span className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-full shadow-sm">
            {isLoading ? '...' : count}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto px-1 pb-4 custom-scrollbar">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
               <div className="h-48 sm:h-56 bg-surfaceLight dark:bg-surfaceDark rounded-md border border-borderLight dark:border-borderDark"></div>
               <div className="h-48 sm:h-56 bg-surfaceLight dark:bg-surfaceDark rounded-md border border-borderLight dark:border-borderDark"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-28 sm:h-32 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark border-dashed rounded-md text-center p-4">
              <p className="text-xs sm:text-sm font-medium text-mutedLight dark:text-mutedDark">{emptyText}</p>
            </div>
          ) : (
            items.map(order => <JobCard key={order.id} order={order} status={status} />)
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1800px] mx-auto h-full flex flex-col bg-pageLight/30 dark:bg-pageDark/30 rounded-lg p-2">
      <div className="flex items-center justify-between mb-4 sm:mb-6 px-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-textLight dark:text-textDark tracking-tight m-0">Production Queue</h2>
          <p className="text-xs sm:text-sm text-mutedLight dark:text-mutedDark mt-1 mb-0">Tabler UI optimized tracking board.</p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        @media (min-width: 1024px) { .custom-scrollbar::-webkit-scrollbar { width: 6px; } }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.4); border-radius: 4px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(107, 114, 128, 0.7); }
      `}} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
        <Column title="Critical / Overdue" count={board.overdue.length} items={board.overdue} status="overdue" emptyText="No overdue jobs. Great work!" />
        <Column title="Due Today" count={board.dueToday.length} items={board.dueToday} status="dueToday" emptyText="No jobs due today." />
        <Column title="Upcoming Jobs" count={board.upcoming.length} items={board.upcoming} status="upcoming" emptyText="No upcoming jobs scheduled." />
      </div>
    </div>
  );
}