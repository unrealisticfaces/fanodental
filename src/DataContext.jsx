import { createContext, useContext, useState, useEffect } from 'react';
import { database } from './firebase';
import { ref, get, onChildAdded, onChildChanged, onChildRemoved, onValue } from 'firebase/database';

const DataContext = createContext();

export function DataProvider({ children, workspaceUid }) {
  const [orders, setOrders] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [payments, setPayments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [labSettings, setLabSettings] = useState({ name: 'DENTAL LAB PRO', address: '', phone: '', email: '', taxId: '' });
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    if (!workspaceUid) {
      setOrders([]); setTechnicians([]); setPayments([]); setLogs([]); setStaffList([]); setIsInitialLoading(false);
      return;
    }

    let isMounted = true;

    async function initializeCache() {
      setIsInitialLoading(true);
      try {
        const [ordersSnap, techsSnap, paymentsSnap, logsSnap, staffSnap, settingsSnap] = await Promise.all([
          get(ref(database, `users/${workspaceUid}/orders`)),
          get(ref(database, `users/${workspaceUid}/settings/technicians`)),
          get(ref(database, `users/${workspaceUid}/payments`)),
          get(ref(database, `users/${workspaceUid}/logs`)),
          get(ref(database, `users/${workspaceUid}/staff`)),
          get(ref(database, `users/${workspaceUid}/settings/general`))
        ]);

        if (!isMounted) return;

        if (ordersSnap.exists()) {
          const data = ordersSnap.val();
          setOrders(Object.keys(data).map(key => ({ id: key, ...data[key] })).reverse());
        }
        if (techsSnap.exists()) {
          const data = techsSnap.val();
          setTechnicians(Object.keys(data).map(key => ({ id: key, ...data[key] })));
        }
        if (paymentsSnap.exists()) {
          const data = paymentsSnap.val();
          setPayments(Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        }
        if (logsSnap.exists()) {
          const data = logsSnap.val();
          setLogs(Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        }
        if (staffSnap.exists()) {
          const data = staffSnap.val();
          setStaffList(Object.keys(data).map(key => ({ id: key, canCreate: data[key].canCreate ?? true, canEdit: data[key].canEdit ?? true, canDelete: data[key].canDelete ?? false, ...data[key] })));
        }
        if (settingsSnap.exists()) setLabSettings(prev => ({ ...prev, ...settingsSnap.val() }));

      } catch (err) {
        console.error("Cache initialization failed:", err);
      } finally {
        if (isMounted) setIsInitialLoading(false);
      }
    }

    initializeCache();

    // Delta Listeners: transmit only altered items, not whole collections
    const ordersRef = ref(database, `users/${workspaceUid}/orders`);
    let initialOrdersComplete = false;
    get(ordersRef).then(() => { initialOrdersComplete = true; });
    
    const unsubOrderAdd = onChildAdded(ordersRef, (snap) => {
      if (!initialOrdersComplete) return;
      const newOrder = { id: snap.key, ...snap.val() };
      setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
    });
    const unsubOrderChange = onChildChanged(ordersRef, (snap) => {
      const updated = { id: snap.key, ...snap.val() };
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    });
    const unsubOrderRemove = onChildRemoved(ordersRef, (snap) => {
      setOrders(prev => prev.filter(o => o.id !== snap.key));
    });

    // Payments Delta
    const payRef = ref(database, `users/${workspaceUid}/payments`);
    let initialPayComplete = false;
    get(payRef).then(() => { initialPayComplete = true; });
    const unsubPayAdd = onChildAdded(payRef, (snap) => {
      if (!initialPayComplete) return;
      const newPay = { id: snap.key, ...snap.val() };
      setPayments(prev => [newPay, ...prev.filter(p => p.id !== newPay.id)].sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp)));
    });

    // Logs Delta
    const logsRef = ref(database, `users/${workspaceUid}/logs`);
    let initialLogsComplete = false;
    get(logsRef).then(() => { initialLogsComplete = true; });
    const unsubLogAdd = onChildAdded(logsRef, (snap) => {
      if (!initialLogsComplete) return;
      const newLog = { id: snap.key, ...snap.val() };
      setLogs(prev => [newLog, ...prev.filter(l => l.id !== newLog.id)].sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp)));
    });

    // Settings, Techs, and Staff can remain as simple onValue since they are tiny
    const settingsRef = ref(database, `users/${workspaceUid}/settings/general`);
    const unsubSet = onValue(settingsRef, (snap) => { if(snap.exists()) setLabSettings(prev => ({ ...prev, ...snap.val() })); });

    const techsRef = ref(database, `users/${workspaceUid}/settings/technicians`);
    const unsubTechs = onValue(techsRef, (snap) => {
      if(snap.exists()){
        const data = snap.val();
        setTechnicians(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else setTechnicians([]);
    });

    const staffRef = ref(database, `users/${workspaceUid}/staff`);
    const unsubStaff = onValue(staffRef, (snap) => {
      if(snap.exists()){
         const data = snap.val();
         setStaffList(Object.keys(data).map(key => ({ id: key, canCreate: data[key].canCreate ?? true, canEdit: data[key].canEdit ?? true, canDelete: data[key].canDelete ?? false, ...data[key] })));
      } else setStaffList([]);
    });

    return () => {
      isMounted = false;
      unsubOrderAdd(); unsubOrderChange(); unsubOrderRemove();
      unsubPayAdd(); unsubLogAdd();
      unsubSet(); unsubTechs(); unsubStaff();
    };
  }, [workspaceUid]);

  return (
    <DataContext.Provider value={{ orders, technicians, payments, logs, staffList, labSettings, isInitialLoading }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);