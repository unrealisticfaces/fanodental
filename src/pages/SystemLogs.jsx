import { useState, useEffect } from 'react';
import { useData } from '../DataContext'; 
import { database } from '../firebase';
import { ref, update } from 'firebase/database';

export default function SystemLogs({ workspaceUid }) {
  const { logs, isInitialLoading: isLoading } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (!workspaceUid || !logs || logs.length === 0) return;

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - thirtyDaysMs;
    const oldLogsUpdates = {};
    let hasOldLogs = false;

    logs.forEach(log => {
      const logKey = log.id || log.key;
      if (!logKey) return;

      let logTimeMs = 0;

      if (typeof log.timestamp === 'number') {
        logTimeMs = log.timestamp;
      } else if (typeof log.timestamp === 'string') {
        logTimeMs = new Date(log.timestamp).getTime();
      }

      if (logTimeMs > 0 && logTimeMs < cutoffTime) {
        oldLogsUpdates[`users/${workspaceUid}/logs/${logKey}`] = null;
        hasOldLogs = true;
      }
    });

    if (hasOldLogs) {
      update(ref(database), oldLogsUpdates).catch((err) => {
        console.error("Failed to prune expired logs:", err);
      });
    }
  }, [logs, workspaceUid]);

  const formatDate = (rawTimestamp) => {
    if (!rawTimestamp) return '-';
    const parsed = new Date(rawTimestamp);
    if (isNaN(parsed.getTime())) return String(rawTimestamp);
    return parsed.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'UPDATE': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const parseDetails = (detailsStr, action) => {
    const data = { rx: '-', summary: '-', payment: '-' };
    if (!detailsStr) return data;

    const rxMatch = detailsStr.match(/RX No:\s*([^|]+)/);
    if (rxMatch) data.rx = rxMatch[1].trim();

    const payMatch = detailsStr.match(/Payment:\s*([^|]+)/);
    if (payMatch) data.payment = payMatch[1].trim();

    const summaryMatch = detailsStr.match(/Summary:\s*([^|]+)/);
    if (summaryMatch) {
      data.summary = summaryMatch[1].trim();
    } else {
      if (action === 'CREATE') data.summary = 'Created new order';
      else if (action === 'DELETE') data.summary = 'Deleted order record';
      else data.summary = 'Updated order details';
    }
    return data;
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const extracted = parseDetails(log.details, log.action);
    return (
      (log.userName || '').toLowerCase().includes(searchLower) ||
      (log.action || '').toLowerCase().includes(searchLower) ||
      (extracted.rx || '').toLowerCase().includes(searchLower) ||
      (extracted.summary || '').toLowerCase().includes(searchLower) ||
      (log.details || '').toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const currentLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!workspaceUid) return null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm flex flex-col transition-colors duration-200">
        
        <div className="px-4 sm:px-6 py-4 border-b border-borderLight dark:border-borderDark flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-textLight dark:text-textDark">System Activity Logs</h2>
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search user, action, RX, or details..."
              className="block w-full px-3 py-1.5 pl-9 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded-md text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2 h-4 w-4 text-gray-400 dark:text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* 🚀 Mobile Fix: Horizontal scrolling wrapper for logs table */}
        <div className="overflow-x-auto min-h-[400px] w-full pb-8">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surfaceLight dark:bg-surfaceDark border-b border-borderLight dark:border-borderDark">
                <th className="px-4 sm:px-6 py-3 text-[10px] sm:text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Timestamp</th>
                <th className="px-4 sm:px-6 py-3 text-[10px] sm:text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Action</th>
                <th className="px-4 sm:px-6 py-3 text-[10px] sm:text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">RX No.</th>
                <th className="px-4 sm:px-6 py-3 text-[10px] sm:text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Details</th>
                <th className="px-4 sm:px-6 py-3 text-[10px] sm:text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">User</th>
                <th className="px-4 sm:px-6 py-3 text-[10px] sm:text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Payment</th>
                <th className="px-4 sm:px-6 py-3 text-[10px] sm:text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">System Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLight dark:divide-borderDark">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 sm:px-6 py-4 sm:py-5"><div className="h-4 bg-gray-200 dark:bg-[#2f333f] rounded w-20 sm:w-24"></div></td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5"><div className="h-4 bg-gray-200 dark:bg-[#2f333f] rounded w-14 sm:w-16"></div></td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5"><div className="h-4 bg-gray-200 dark:bg-[#2f333f] rounded w-16 sm:w-20"></div></td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5"><div className="h-4 bg-gray-200 dark:bg-[#2f333f] rounded w-24 sm:w-32"></div></td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5"><div className="h-4 bg-gray-200 dark:bg-[#2f333f] rounded w-20 sm:w-24"></div></td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5"><div className="h-4 bg-gray-200 dark:bg-[#2f333f] rounded w-14 sm:w-16"></div></td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5 flex justify-end"><div className="h-4 bg-gray-200 dark:bg-[#2f333f] rounded w-16 sm:w-20"></div></td>
                  </tr>
                ))
              ) : currentLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 sm:px-6 py-8 text-center text-mutedLight dark:text-mutedDark text-sm">
                    {searchTerm ? 'No matching logs found.' : 'No system activity recorded yet.'}
                  </td>
                </tr>
              ) : (
                currentLogs.map((log) => {
                  const extracted = parseDetails(log.details, log.action);
                  const displayUser = log.userName || 'Administrator';

                  return (
                    <tr key={log.id || log.key} className="hover:bg-pageLight dark:hover:bg-pageDark transition-colors">
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-mutedLight dark:text-mutedDark whitespace-nowrap align-middle">{formatDate(log.timestamp)}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm whitespace-nowrap align-middle">
                        <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[11px] font-bold tracking-wide ${getActionColor(log.action)}`}>{log.action}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium text-textLight dark:text-textDark whitespace-nowrap align-middle">{extracted.rx !== '-' ? extracted.rx : 'N/A'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-textLight dark:text-textDark align-middle max-w-xs sm:max-w-sm break-words leading-relaxed">{extracted.summary}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-textLight dark:text-textDark whitespace-nowrap align-middle">
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          {log.userPhoto ? (
                            <img src={log.userPhoto} alt={displayUser} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-borderLight dark:border-borderDark" />
                          ) : (
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px] sm:text-[10px]">
                              {displayUser.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium">{displayUser}</span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm whitespace-nowrap align-middle">
                        {extracted.payment !== '-' ? (
                          <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider w-fit ${
                            extracted.payment === 'Fully Paid' || extracted.payment === 'Paid'
                              ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30' 
                              : extracted.payment === 'Partial'
                              ? 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30'
                              : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
                          }`}>
                            {extracted.payment}
                          </span>
                        ) : (
                          <span className="text-mutedLight dark:text-mutedDark">-</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm whitespace-nowrap text-right align-middle">
                        <span className="inline-flex items-center justify-end gap-1 sm:gap-1.5 text-green-600 dark:text-green-400 font-medium">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Success
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {!isLoading && filteredLogs.length > 0 && (
          <div className="px-4 sm:px-6 py-3 border-t border-borderLight dark:border-borderDark flex items-center justify-between text-xs sm:text-sm text-mutedLight dark:text-mutedDark bg-surfaceLight dark:bg-surfaceDark rounded-b-md overflow-x-auto">
            <span className="whitespace-nowrap mr-4">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </button>
              <button className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded bg-primary text-white text-xs sm:text-sm font-medium shadow-sm">{currentPage}</button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-2 py-1 hover:text-textLight dark:hover:text-textDark disabled:opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}