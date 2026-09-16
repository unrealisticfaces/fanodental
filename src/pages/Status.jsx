import { useData } from '../DataContext'; 

export default function Status({ workspaceUid }) {
  const { orders, isInitialLoading: isLoading } = useData();

  const inProgress = orders.filter(o => o.initialStatus === 'In progress');
  const delivered = orders.filter(o => o.initialStatus === 'Delivered');

  if (!workspaceUid) return null;

  const StatusCard = ({ order, isDelivered }) => (
    <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md p-3 sm:p-4 shadow-sm hover:shadow transition-all duration-200 group">
      <div className="flex justify-between items-start mb-2.5 sm:mb-3">
        <div>
          <h4 className="font-semibold text-textLight dark:text-textDark text-sm group-hover:text-primary transition-colors">
            {order.rxNumber}
          </h4>
          <p className="text-[11px] sm:text-xs text-mutedLight dark:text-mutedDark mt-0.5">Dr. {order.dentistName}</p>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${
          isDelivered 
            ? 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400' 
            : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500'
        }`}>
          {order.initialStatus}
        </span>
      </div>
      
      <div className="h-px w-full bg-borderLight dark:bg-borderDark mb-2.5 sm:mb-3"></div>

      <div className="space-y-1.5 sm:space-y-2">
        <div className="flex justify-between items-center text-[11px] sm:text-xs">
          <span className="text-mutedLight dark:text-mutedDark flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Patient
          </span>
          <span className="font-medium text-textLight dark:text-textDark">{order.patientName}</span>
        </div>
        <div className="flex justify-between items-center text-[11px] sm:text-xs">
          <span className="text-mutedLight dark:text-mutedDark flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            Product
          </span>
          <span className="font-medium text-textLight dark:text-textDark">{order.product} ({order.units}x)</span>
        </div>
        <div className="flex justify-between items-center text-[11px] sm:text-xs">
          <span className="text-mutedLight dark:text-mutedDark flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Due Date
          </span>
          <span className="font-medium text-textLight dark:text-textDark">{order.dueDate}</span>
        </div>
      </div>
    </div>
  );

  const SkeletonCard = () => (
    <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md p-4 shadow-sm animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="h-4 w-20 bg-pageLight dark:bg-pageDark rounded mb-2"></div>
          <div className="h-3 w-28 bg-pageLight dark:bg-pageDark rounded"></div>
        </div>
        <div className="h-4 w-16 bg-pageLight dark:bg-pageDark rounded"></div>
      </div>
      <div className="h-px w-full bg-borderLight dark:bg-borderDark mb-3"></div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-pageLight dark:bg-pageDark rounded"></div>
        <div className="h-3 w-5/6 bg-pageLight dark:bg-pageDark rounded"></div>
        <div className="h-3 w-4/5 bg-pageLight dark:bg-pageDark rounded"></div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-textLight dark:text-textDark tracking-tight">Production Board</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 items-start">
        
        <div className="bg-pageLight/50 dark:bg-pageDark/50 rounded-md p-3 sm:p-4 border border-borderLight dark:border-borderDark min-h-[300px] sm:min-h-[500px] flex flex-col">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="font-semibold text-textLight dark:text-textDark text-xs sm:text-sm flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              In Progress
            </h3>
            <span className="bg-surfaceLight dark:bg-surfaceDark text-mutedLight dark:text-mutedDark text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded border border-borderLight dark:border-borderDark shadow-sm">
              {isLoading ? '-' : inProgress.length}
            </span>
          </div>
          
          <div className="space-y-3 flex-1">
            {isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : inProgress.length === 0 ? (
              <div className="flex items-center justify-center h-24 sm:h-32 text-xs sm:text-sm text-mutedLight dark:text-mutedDark border-2 border-dashed border-borderLight dark:border-borderDark rounded-md">
                No active orders
              </div>
            ) : (
              inProgress.map(order => <StatusCard key={order.id} order={order} isDelivered={false} />)
            )}
          </div>
        </div>

        <div className="bg-pageLight/50 dark:bg-pageDark/50 rounded-md p-3 sm:p-4 border border-borderLight dark:border-borderDark min-h-[300px] sm:min-h-[500px] flex flex-col">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="font-semibold text-textLight dark:text-textDark text-xs sm:text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Delivered
            </h3>
            <span className="bg-surfaceLight dark:bg-surfaceDark text-mutedLight dark:text-mutedDark text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded border border-borderLight dark:border-borderDark shadow-sm">
              {isLoading ? '-' : delivered.length}
            </span>
          </div>
          
          <div className="space-y-3 flex-1">
            {isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : delivered.length === 0 ? (
              <div className="flex items-center justify-center h-24 sm:h-32 text-xs sm:text-sm text-mutedLight dark:text-mutedDark border-2 border-dashed border-borderLight dark:border-borderDark rounded-md">
                No delivered orders yet
              </div>
            ) : (
              delivered.map(order => <StatusCard key={order.id} order={order} isDelivered={true} />)
            )}
          </div>
        </div>

      </div>
    </div>
  );
}