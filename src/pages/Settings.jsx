import { useState, useEffect, useRef } from 'react';
import { database, auth, firebaseConfig } from '../firebase';
import { ref, onValue, set, get, push, remove, update } from 'firebase/database';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as signOutSecondary } from 'firebase/auth';
import { useToast } from '../ToastContext';

export default function Settings({ workspaceUid }) {
  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(true);

  const [labSettings, setLabSettings] = useState({
    name: 'Fano Laboratory',
    address: '35-B Urgello St. Cebu City, Cebu City, Philippines',
    phone: '',
    email: '',
    taxId: ''
  });
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  const [technicians, setTechnicians] = useState([]);
  const [newTechName, setNewTechName] = useState('');
  const [newTechPhoto, setNewTechPhoto] = useState('');
  const [isAddingTech, setIsAddingTech] = useState(false);

  const [isEditTechModalOpen, setIsEditTechModalOpen] = useState(false);
  const [editingTech, setEditingTech] = useState(null);

  const [staffList, setStaffList] = useState([]);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [newStaff, setNewStaff] = useState({ 
    name: '', 
    email: '', 
    role: 'Staff', 
    status: 'Active',
    canCreate: true,
    canEdit: true,
    canDelete: false
  });

  const [isEditStaffModalOpen, setIsEditStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const isOwner = auth.currentUser?.uid === workspaceUid;

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!workspaceUid) return;

    const generalRef = ref(database, `users/${workspaceUid}/settings/general`);
    const staffRef = ref(database, `users/${workspaceUid}/staff`);
    const techsRef = ref(database, `users/${workspaceUid}/settings/technicians`);

    const unsubGeneral = onValue(generalRef, (snapshot) => {
      if (snapshot.exists()) {
        setLabSettings(snapshot.val());
      }
    });

    const unsubStaff = onValue(staffRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const parsedStaff = Object.keys(data).map(key => ({
          id: key,
          canCreate: data[key].canCreate ?? true,
          canEdit: data[key].canEdit ?? true,
          canDelete: data[key].canDelete ?? false,
          ...data[key]
        }));
        setStaffList(parsedStaff);
      } else {
        setStaffList([]);
      }
      setIsLoading(false);
    });

    const unsubTechs = onValue(techsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setTechnicians(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setTechnicians([]);
      }
    });

    return () => {
      unsubGeneral();
      unsubStaff();
      unsubTechs();
    };
  }, [workspaceUid]);

  const handleGeneralSubmit = async (e) => {
    e.preventDefault();
    if (!workspaceUid) return;

    setIsSavingGeneral(true);
    try {
      await set(ref(database, `users/${workspaceUid}/settings/general`), labSettings);
      addToast('General configuration saved successfully.', 'success');
    } catch (error) {
      addToast('Failed to save configuration.', 'error');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleAddTechnician = async (e) => {
    e.preventDefault();
    if (!workspaceUid || !newTechName.trim()) return;
    
    if (technicians.some(t => t.name.toLowerCase() === newTechName.trim().toLowerCase())) {
      addToast("Technician already exists.", "error");
      return;
    }

    setIsAddingTech(true);
    try {
      await push(ref(database, `users/${workspaceUid}/settings/technicians`), {
        name: newTechName.trim(),
        photoURL: newTechPhoto.trim(),
        createdAt: new Date().toISOString()
      });
      setNewTechName('');
      setNewTechPhoto('');
      addToast("Technician added to roster.", "success");
    } catch (error) {
      addToast("Failed to add technician.", "error");
    } finally {
      setIsAddingTech(false);
    }
  };

  const handleEditTechSubmit = async (e) => {
    e.preventDefault();
    if (!workspaceUid || !editingTech) return;
    
    try {
      await update(ref(database, `users/${workspaceUid}/settings/technicians/${editingTech.id}`), {
        name: editingTech.name.trim(),
        photoURL: editingTech.photoURL || ''
      });

      if (editingTech.originalName && editingTech.originalName !== editingTech.name.trim()) {
        const ordersSnap = await get(ref(database, `users/${workspaceUid}/orders`));
        if (ordersSnap.exists()) {
          const ordersData = ordersSnap.val();
          const updates = {};
          Object.keys(ordersData).forEach(orderId => {
            if (ordersData[orderId].techIncharge === editingTech.originalName) {
              updates[`users/${workspaceUid}/orders/${orderId}/techIncharge`] = editingTech.name.trim();
            }
          });
          if (Object.keys(updates).length > 0) {
            await update(ref(database), updates);
          }
        }
      }

      setIsEditTechModalOpen(false);
      setEditingTech(null);
      addToast('Technician updated and records synced.', 'success');
    } catch (error) {
      addToast('Failed to update technician.', 'error');
    }
  };

  const handleDeleteTechnician = async (id) => {
    if (!workspaceUid) return;
    if (!window.confirm("Are you sure you want to remove this technician?")) return;
    
    try {
      await remove(ref(database, `users/${workspaceUid}/settings/technicians/${id}`));
      addToast("Technician removed.", "success");
    } catch (error) {
      addToast("Failed to remove technician.", "error");
    }
  };

  const handlePermissionChange = (staffId, field, value) => {
    setStaffList(prev => prev.map(staff => {
      if (staff.id === staffId) {
        return { ...staff, [field]: value };
      }
      return staff;
    }));
  };

  const handleSaveAllPermissions = async () => {
    if (!workspaceUid) return;

    setIsSavingPermissions(true);
    try {
      const updates = {};
      staffList.forEach(staff => {
        updates[`users/${workspaceUid}/staff/${staff.id}/canCreate`] = staff.canCreate;
        updates[`users/${workspaceUid}/staff/${staff.id}/canEdit`] = staff.canEdit;
        updates[`users/${workspaceUid}/staff/${staff.id}/canDelete`] = staff.canDelete;
        updates[`users/${workspaceUid}/staff/${staff.id}/role`] = staff.role;
        updates[`users/${workspaceUid}/staff/${staff.id}/status`] = staff.status;
      });

      await update(ref(database), updates);
      addToast('User permissions saved successfully.', 'success');
    } catch (error) {
      addToast('Failed to save user permissions.', 'error');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!workspaceUid) return;

    try {
      const appName = 'SecondaryAuthApp';
      const secondaryApp = getApps().find(app => app.name === appName) || initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newStaff.email, '123456');
      const staffUid = userCredential.user.uid;

      await signOutSecondary(secondaryAuth);

      await set(ref(database, `users/${workspaceUid}/staff/${staffUid}`), {
        name: newStaff.name,
        email: newStaff.email,
        role: newStaff.role,
        status: newStaff.status,
        canCreate: newStaff.canCreate,
        canEdit: newStaff.canEdit,
        canDelete: newStaff.canDelete,
        mustChangePassword: true,
        adminUid: workspaceUid,
        createdAt: new Date().toISOString()
      });

      await set(ref(database, `accounts/${staffUid}`), {
        adminUid: workspaceUid,
        mustChangePassword: true
      });

      setIsStaffModalOpen(false);
      setNewStaff({ name: '', email: '', role: 'Staff', status: 'Active', canCreate: true, canEdit: true, canDelete: false });
      addToast('Staff member added with default password: 123456', 'success');
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        addToast('This email address is already registered.', 'error');
      } else {
        addToast('Failed to create staff account.', 'error');
      }
    }
  };

  const openEditModal = (staff) => {
    setEditingStaff({ ...staff, originalName: staff.name });
    setIsEditStaffModalOpen(true);
  };

  const handleEditStaffSubmit = async (e) => {
    e.preventDefault();
    if (!workspaceUid || !editingStaff) return;

    try {
      const staffRef = ref(database, `users/${workspaceUid}/staff/${editingStaff.id}`);
      await update(staffRef, {
        name: editingStaff.name.trim(),
        photoURL: editingStaff.photoURL || '',
        role: editingStaff.role,
        status: editingStaff.status
      });

      const updates = {};
      
      const logsSnap = await get(ref(database, `users/${workspaceUid}/logs`));
      if (logsSnap.exists()) {
        const logsData = logsSnap.val();
        Object.keys(logsData).forEach(logId => {
          if (logsData[logId].userEmail === editingStaff.email) {
            updates[`users/${workspaceUid}/logs/${logId}/userName`] = editingStaff.name.trim();
            updates[`users/${workspaceUid}/logs/${logId}/userPhoto`] = editingStaff.photoURL || '';
          }
        });
      }

      if (editingStaff.originalName && editingStaff.originalName !== editingStaff.name.trim()) {
        const paymentsSnap = await get(ref(database, `users/${workspaceUid}/payments`));
        if (paymentsSnap.exists()) {
          const paymentsData = paymentsSnap.val();
          Object.keys(paymentsData).forEach(payId => {
            if (paymentsData[payId].recordedBy === editingStaff.originalName) {
              updates[`users/${workspaceUid}/payments/${payId}/recordedBy`] = editingStaff.name.trim();
            }
          });
        }
      }

      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
      }
      
      setIsEditStaffModalOpen(false);
      setEditingStaff(null);
      addToast('Staff updated and records synced.', 'success');
    } catch (error) {
      addToast('Failed to update staff information.', 'error');
    }
  };

  const handleRemoveStaff = async (staffId) => {
    if (!workspaceUid || !window.confirm("Are you sure you want to remove this user's access?")) return;

    try {
      await remove(ref(database, `users/${workspaceUid}/staff/${staffId}`));
      await remove(ref(database, `accounts/${staffId}`));
      addToast('Staff member removed.', 'success');
    } catch (error) {
      addToast('Failed to remove staff member.', 'error');
    }
  };

  const handleBackup = async () => {
    if (!workspaceUid) return;

    try {
      const snapshot = await get(ref(database, `users/${workspaceUid}`));
      if (!snapshot.exists()) {
        addToast("No data available to backup.", "error");
        return;
      }

      const data = snapshot.val();
      const jsonString = JSON.stringify(data, null, 2);

      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DentalLab_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      addToast('Database backup downloaded successfully!', 'success');
    } catch (error) {
      addToast('Failed to backup database.', 'error');
    }
  };

  const cleanDentistName = (name) => {
    if (!name) return 'Unknown';
    let cleaned = String(name).replace(/^[\.\-\s]+/, '').trim(); 
    cleaned = cleaned.replace(/^(Dr\.|Dr\s+|Dr\b)/i, '').trim(); 
    cleaned = cleaned.replace(/^[\.\-\s]+/, '').trim(); 
    return cleaned.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };

  const cleanProduct = (productStr, descStr) => {
    let p = String(productStr || '').trim().toLowerCase();
    let d = String(descStr || '').trim().toLowerCase();
    
    const searchTarget = p ? p : d;

    if (searchTarget.includes('zirconia coping') || searchTarget.includes('zircon coping')) return 'Zirconia Coping';
    if (searchTarget.includes('zirconia') || searchTarget.includes('zircnia') || searchTarget.includes('circonia') || searchTarget.includes('zircon')) return 'Zirconia';
    if (searchTarget.includes('emax')) return 'Emax';
    if (searchTarget.includes('3d') || searchTarget.includes('printing')) return '3D Printing';
    if (searchTarget.includes('hc')) return 'HC';
    if (searchTarget.includes('pfm')) return 'PFM';
    
    if (p) {
      if (p === 'hc') return 'HC';
      if (p === 'pfm') return 'PFM';
      return p.replace(/\b\w/g, char => char.toUpperCase());
    }
    
    return 'PFM';
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm("Importing a backup will replace your current laboratory records and settings with the uploaded file. Do you want to proceed?")) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        let parsedData = JSON.parse(event.target.result);

        if (typeof parsedData !== 'object' || parsedData === null) {
          throw new Error("Invalid backup file structure.");
        }

        // Automatic Legacy Fano Lab Schema Upgrader & Deduplicator
        if (parsedData.audit_logs || (parsedData.orders && Object.values(parsedData.orders)[0]?.doctor)) {
           if (window.confirm("Legacy Fano Lab database detected! Do you want to automatically upgrade and remove duplicate RX numbers?")) {
              const migratedData = { 
                orders: {}, 
                logs: {}, 
                payments: {}, 
                settings: parsedData.settings || {}, 
                staff: parsedData.staff || {} 
              };
              
              if (parsedData.orders) {
                 const rxTracker = {}; // Tracks RX numbers to prevent duplicates

                 Object.keys(parsedData.orders).forEach(key => {
                     const oldOrder = parsedData.orders[key];
                     const rxNum = (oldOrder.rxNumber || '').trim();
                     const rxKey = rxNum.toLowerCase();

                     // If RX Number already exists, delete the old one and keep this newer one
                     if (rxKey) {
                       if (rxTracker[rxKey]) {
                         delete migratedData.orders[rxTracker[rxKey]];
                       }
                       rxTracker[rxKey] = key;
                     }

                     const totalAmount = parseFloat(oldOrder.totalAmount) || 0;
                     const balanceAmt = parseFloat(oldOrder.balance) || 0;
                     const paidAmt = totalAmount - balanceAmt;
                     
                     let computedPayType = 'Unpaid';
                     if (paidAmt > 0 && paidAmt < totalAmount) computedPayType = 'Partial';
                     if (paidAmt >= totalAmount && totalAmount > 0) computedPayType = 'Fully Paid';
                     
                     let generatedDate = new Date().toISOString();
                     try { if (oldOrder.dateReceived) generatedDate = new Date(oldOrder.dateReceived).toISOString(); } catch(err) {}
                     
                     const standardizedDentistName = cleanDentistName(oldOrder.doctor);
                     const standardizedProduct = cleanProduct(oldOrder.product, oldOrder.description);

                     migratedData.orders[key] = {
                         balance: String(balanceAmt),
                         createdAt: generatedDate,
                         dateReceived: oldOrder.dateReceived || '',
                         deliverBy: oldOrder.deliver || '',
                         dentistName: standardizedDentistName,
                         descriptions: oldOrder.description || '',
                         dueDate: oldOrder.dueDate || '',
                         initialStatus: oldOrder.jobStatus === 'Delivered' ? 'Delivered' : 'In progress',
                         nextDue: oldOrder.nextPaymentDue || '',
                         patientName: oldOrder.patientName || '',
                         payType: computedPayType,
                         payment: String(paidAmt),
                         pickUpBy: oldOrder.pickUp || '',
                         product: standardizedProduct,
                         remarks: oldOrder.remarks || '',
                         rxNumber: rxNum,
                         shade: oldOrder.shadeTech || '',
                         techIncharge: oldOrder.techBuildUp || '',
                         totalPrice: String(totalAmount),
                         units: String(oldOrder.units || '1')
                     };

                     if (paidAmt > 0) {
                        migratedData.payments[`pay_legacy_${key}`] = {
                           amount: paidAmt,
                           dentistName: standardizedDentistName,
                           orderId: key,
                           recordedBy: "Legacy System Import",
                           rxNumber: rxNum,
                           timestamp: generatedDate
                        };
                     }
                 });
              }

              if (parsedData.audit_logs) {
                 Object.keys(parsedData.audit_logs).forEach(key => {
                    const oldLog = parsedData.audit_logs[key];
                    let mappedAction = 'UPDATE';
                    if (oldLog.action && oldLog.action.toLowerCase().includes('created')) mappedAction = 'CREATE';
                    if (oldLog.action && oldLog.action.toLowerCase().includes('deleted')) mappedAction = 'DELETE';
                    
                    let logTime = new Date().toISOString();
                    try { if (oldLog.timestamp) logTime = new Date(oldLog.timestamp).toISOString(); } catch(err) {}

                    migratedData.logs[key] = {
                       action: mappedAction,
                       details: `RX No: ${oldLog.rxNumber} | Summary: ${oldLog.action}`,
                       entity: 'Legacy Order',
                       entityId: '',
                       timestamp: logTime,
                       userEmail: oldLog.user || '',
                       userName: oldLog.user ? oldLog.user.split('@')[0] : 'Legacy User',
                       userPhoto: ''
                    };
                 });
              }
              parsedData = migratedData;
           }
        } else {
           // Modern schema duplicate cleanup
           if (parsedData.orders) {
             const rxTracker = {};
             const cleanedOrders = {};

             Object.keys(parsedData.orders).forEach(key => {
               const order = parsedData.orders[key];
               const rxKey = (order.rxNumber || '').trim().toLowerCase();
               
               // Remove older duplicate if found
               if (rxKey) {
                 if (rxTracker[rxKey]) {
                    delete cleanedOrders[rxTracker[rxKey]];
                 }
                 rxTracker[rxKey] = key;
               }
               
               order.dentistName = cleanDentistName(order.dentistName);
               order.product = cleanProduct(order.product, order.descriptions);
               cleanedOrders[key] = order;
             });
             parsedData.orders = cleanedOrders;
           }
           if (parsedData.payments) {
             Object.keys(parsedData.payments).forEach(key => {
               parsedData.payments[key].dentistName = cleanDentistName(parsedData.payments[key].dentistName);
             });
           }
        }

        await set(ref(database, `users/${workspaceUid}`), parsedData);
        addToast("Database imported and deduplicated successfully!", "success");
      } catch (err) {
        addToast("Failed to import database. Please verify the JSON file.", "error");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      addToast("Error reading file.", "error");
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const handleWipeDatabase = async () => {
    if (!workspaceUid) return;

    const userInput = window.prompt("WARNING: This will permanently delete ALL orders, payments, technicians, and system logs. This cannot be undone.\n\nType 'DELETE' in all caps to confirm:");
    
    if (userInput !== 'DELETE') {
      if (userInput !== null) {
        addToast("Wipe cancelled. You must type 'DELETE' exactly.", "info");
      }
      return;
    }

    try {
      const updates = {
        [`users/${workspaceUid}/orders`]: null,
        [`users/${workspaceUid}/payments`]: null,
        [`users/${workspaceUid}/logs`]: null,
        [`users/${workspaceUid}/settings/technicians`]: null
      };
      
      await update(ref(database), updates);
      addToast('Database wiped successfully. You have a clean slate.', 'success');
    } catch (error) {
      addToast('Failed to wipe database.', 'error');
    }
  };

  const inputClass = "block w-full px-2.5 py-1.5 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm";
  const readOnlyInputClass = "block w-full px-2.5 py-1.5 text-sm bg-gray-50 dark:bg-[#111824] border border-gray-200 dark:border-[#2b3644] rounded text-gray-500 dark:text-gray-400 cursor-not-allowed focus:outline-none shadow-sm font-medium";
  const labelClass = "block text-sm font-medium text-textLight dark:text-textDark mb-1";

  return (
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6">
      
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-textLight dark:text-textDark mb-4 px-3">System Settings</h2>
        
        <button onClick={() => setActiveTab('general')} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-primary/10 text-primary dark:text-blue-400' : 'text-mutedLight dark:text-mutedDark hover:bg-surfaceLight dark:hover:bg-surfaceDark hover:text-textLight dark:hover:text-textDark'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 12l3 -3" /><path d="M12 12l-4 -2" /><path d="M12 12l-2 4" /><path d="M12 12l4 2" /></svg>
          General Setup
        </button>

        <button onClick={() => setActiveTab('technicians')} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'technicians' ? 'bg-primary/10 text-primary dark:text-blue-400' : 'text-mutedLight dark:text-mutedDark hover:bg-surfaceLight dark:hover:bg-surfaceDark hover:text-textLight dark:hover:text-textDark'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg>
          Technician Roster
        </button>

        {isOwner && (
          <button onClick={() => setActiveTab('users')} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-primary/10 text-primary dark:text-blue-400' : 'text-mutedLight dark:text-mutedDark hover:bg-surfaceLight dark:hover:bg-surfaceDark hover:text-textLight dark:hover:text-textDark'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>
            System Users
          </button>
        )}

        <button onClick={() => setActiveTab('database')} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'database' ? 'bg-primary/10 text-primary dark:text-blue-400' : 'text-mutedLight dark:text-mutedDark hover:bg-surfaceLight dark:hover:bg-surfaceDark hover:text-textLight dark:hover:text-textDark'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 14v-3a8 8 0 1 1 16 0v3" /><path d="M18 19c0 1.657 -2.686 3 -6 3s-6 -1.343 -6 -3c0 -3.197 12 -3.197 12 0z" /><path d="M12 14m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /></svg>
          Database Manager
        </button>
      </div>

      <div className="flex-1 min-w-0">
        
        {activeTab === 'general' && (
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm animate-in fade-in overflow-visible flex flex-col">
            <div className="px-5 py-4 border-b border-borderLight dark:border-borderDark">
              <h3 className="text-base font-semibold text-textLight dark:text-textDark">General Configuration</h3>
              <p className="text-sm text-mutedLight dark:text-mutedDark mt-0.5">These details will appear on printed invoices and slips.</p>
            </div>
            <div className="p-5">
              <form onSubmit={handleGeneralSubmit} className="max-w-2xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Laboratory Name</label>
                    <input type="text" value={labSettings.name || ''} onChange={(e) => setLabSettings({...labSettings, name: e.target.value})} className={inputClass} required disabled={!isOwner} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Official Address</label>
                    <textarea value={labSettings.address || ''} onChange={(e) => setLabSettings({...labSettings, address: e.target.value})} className={`${inputClass} h-20 resize-none`} placeholder="Optional" disabled={!isOwner} />
                  </div>
                  <div>
                    <label className={labelClass}>Contact Number</label>
                    <input type="text" value={labSettings.phone || ''} onChange={(e) => setLabSettings({...labSettings, phone: e.target.value})} className={inputClass} placeholder="Optional" disabled={!isOwner} />
                  </div>
                  <div>
                    <label className={labelClass}>Support Email</label>
                    <input type="email" value={labSettings.email || ''} onChange={(e) => setLabSettings({...labSettings, email: e.target.value})} className={inputClass} placeholder="Optional" disabled={!isOwner} />
                  </div>
                  <div>
                    <label className={labelClass}>Tax ID (TIN) <span className="text-mutedLight dark:text-mutedDark font-normal text-xs ml-1">(Optional)</span></label>
                    <input type="text" value={labSettings.taxId || ''} onChange={(e) => setLabSettings({...labSettings, taxId: e.target.value})} className={inputClass} disabled={!isOwner} />
                  </div>
                </div>
                {isOwner && (
                  <div className="pt-4 border-t border-borderLight dark:border-borderDark mt-6 flex justify-end">
                    <button type="submit" disabled={isSavingGeneral} className="px-4 py-2 bg-primary text-white text-sm font-medium rounded hover:bg-primaryHover transition-colors shadow-sm disabled:opacity-50">
                      {isSavingGeneral ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {activeTab === 'technicians' && (
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm flex flex-col overflow-visible animate-in fade-in">
            <div className="px-6 py-4 border-b border-borderLight dark:border-borderDark flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-textLight dark:text-textDark">Technician Roster</h2>
                <p className="text-sm text-mutedLight dark:text-mutedDark mt-1">Manage your team. These names will appear as dropdowns to prevent payroll mismatches.</p>
              </div>
            </div>
            
            <div className="p-6 border-b border-borderLight dark:border-borderDark bg-pageLight/30 dark:bg-pageDark/30">
              <form onSubmit={handleAddTechnician} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input 
                    type="text" 
                    value={newTechName} 
                    onChange={(e) => setNewTechName(e.target.value)} 
                    placeholder="Enter technician full name..." 
                    className={inputClass} 
                    required 
                  />
                </div>
                <div className="flex-1">
                  <input 
                    type="url" 
                    value={newTechPhoto} 
                    onChange={(e) => setNewTechPhoto(e.target.value)} 
                    placeholder="Profile Photo URL (Optional)..." 
                    className={inputClass} 
                  />
                </div>
                <button type="submit" disabled={isAddingTech} className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded hover:bg-primaryHover transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap">
                  {isAddingTech ? 'Adding...' : 'Add Technician'}
                </button>
              </form>
            </div>

            <div className="overflow-visible min-h-[300px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-pageLight/50 dark:bg-pageDark/50 border-b border-borderLight dark:border-borderDark">
                    <th className="px-6 py-3 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Technician Profile</th>
                    <th className="px-6 py-3 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLight dark:border-borderDark">
                  {isLoading ? (
                    <tr><td colSpan="2" className="px-6 py-8 text-center text-mutedLight dark:text-mutedDark text-sm animate-pulse">Loading roster...</td></tr>
                  ) : technicians.length === 0 ? (
                    <tr><td colSpan="2" className="px-6 py-8 text-center text-mutedLight dark:text-mutedDark text-sm">No technicians added yet. Add one above.</td></tr>
                  ) : (
                    technicians.map(tech => (
                      <tr key={tech.id} className="hover:bg-pageLight dark:hover:bg-pageDark transition-colors">
                        <td className="px-6 py-3.5 text-sm font-medium text-textLight dark:text-textDark whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shadow-sm border border-primary/20 overflow-hidden">
                              {tech.photoURL ? (
                                <img src={tech.photoURL} alt={tech.name} className="w-full h-full object-cover" />
                              ) : (
                                tech.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            {tech.name}
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right whitespace-nowrap relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === `tech_${tech.id}` ? null : `tech_${tech.id}`);
                            }}
                            className="inline-flex items-center px-2.5 py-1.5 border border-borderLight dark:border-borderDark rounded text-sm font-medium text-mutedLight dark:text-mutedDark bg-surfaceLight dark:bg-surfaceDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                          >
                            Actions
                            <svg className="ml-1 -mr-0.5 h-4 w-4 text-mutedLight dark:text-mutedDark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          </button>

                          {openDropdownId === `tech_${tech.id}` && (
                            <div className="absolute right-6 top-10 mt-1 w-44 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded shadow-lg z-50 flex flex-col text-left py-1">
                              <button onClick={(e) => { e.stopPropagation(); setEditingTech({ ...tech, originalName: tech.name }); setIsEditTechModalOpen(true); setOpenDropdownId(null); }} className="w-full text-left px-3 py-1.5 text-sm text-textLight dark:text-textDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors font-medium">
                                Update Information
                              </button>
                              <div className="h-px bg-borderLight dark:bg-borderDark w-full my-1"></div>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteTechnician(tech.id); setOpenDropdownId(null); }} className="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                Remove Technician
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
          </div>
        )}
        
        {activeTab === 'users' && isOwner && (
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm flex flex-col overflow-visible animate-in fade-in">
            <div className="px-5 py-4 border-b border-borderLight dark:border-borderDark flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-textLight dark:text-textDark">User Permissions Matrix</h3>
                <p className="text-sm text-mutedLight dark:text-mutedDark mt-0.5">Toggle checkboxes to grant or revoke specific actions, then click save.</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button onClick={handleSaveAllPermissions} disabled={isSavingPermissions || staffList.length === 0} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" /></svg>
                  {isSavingPermissions ? 'Saving...' : 'Save Permissions'}
                </button>
                <button onClick={() => setIsStaffModalOpen(true)} className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded hover:bg-primaryHover transition-colors shadow-sm flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                  Add User
                </button>
              </div>
            </div>
            
            <div className="overflow-visible min-h-[300px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-pageLight/50 dark:bg-pageDark/50 border-b border-borderLight dark:border-borderDark">
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">User</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-center">Create</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-center">Edit / Update</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider text-center">Delete</th>
                    <th className="px-5 py-2.5 text-xs font-semibold text-mutedLight dark:text-mutedDark uppercase tracking-wider">Status</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLight dark:divide-borderDark">
                  {isLoading ? (
                    <tr><td colSpan="6" className="px-5 py-8 text-center text-mutedLight dark:text-mutedDark text-sm">Loading users...</td></tr>
                  ) : staffList.length === 0 ? (
                    <tr><td colSpan="6" className="px-5 py-8 text-center text-mutedLight dark:text-mutedDark text-sm">No users registered yet.</td></tr>
                  ) : (
                    staffList.map(user => (
                      <tr key={user.id} className="hover:bg-pageLight dark:hover:bg-pageDark transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-borderLight dark:border-borderDark">
                              {user.photoURL ? (
                                <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                              ) : (
                                user.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-textLight dark:text-textDark">{user.name}</span>
                              <span className="text-xs text-mutedLight dark:text-mutedDark">{user.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center align-middle whitespace-nowrap">
                          <input type="checkbox" checked={user.canCreate} onChange={(e) => handlePermissionChange(user.id, 'canCreate', e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-[#3a4859] text-primary focus:ring-primary bg-white dark:bg-[#182433] cursor-pointer" />
                        </td>
                        <td className="px-5 py-3 text-center align-middle whitespace-nowrap">
                          <input type="checkbox" checked={user.canEdit} onChange={(e) => handlePermissionChange(user.id, 'canEdit', e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-[#3a4859] text-primary focus:ring-primary bg-white dark:bg-[#182433] cursor-pointer" />
                        </td>
                        <td className="px-5 py-3 text-center align-middle whitespace-nowrap">
                          <input type="checkbox" checked={user.canDelete} onChange={(e) => handlePermissionChange(user.id, 'canDelete', e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-[#3a4859] text-red-600 focus:ring-red-500 bg-white dark:bg-[#182433] cursor-pointer" />
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${user.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span className="text-sm text-mutedLight dark:text-mutedDark">{user.status}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === user.id ? null : user.id);
                            }}
                            className="inline-flex items-center px-2.5 py-1.5 border border-borderLight dark:border-borderDark rounded text-sm font-medium text-mutedLight dark:text-mutedDark bg-surfaceLight dark:bg-surfaceDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                          >
                            Actions
                            <svg className="ml-1 -mr-0.5 h-4 w-4 text-mutedLight dark:text-mutedDark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>

                          {openDropdownId === user.id && (
                            <div className="absolute right-6 top-10 mt-1 w-44 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded shadow-lg z-50 flex flex-col text-left py-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); openEditModal(user); setOpenDropdownId(null); }}
                                className="w-full text-left px-3 py-1.5 text-sm text-textLight dark:text-textDark hover:bg-pageLight dark:hover:bg-pageDark transition-colors"
                              >
                                Update Information
                              </button>
                              <div className="h-px bg-borderLight dark:border-borderDark w-full my-1"></div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveStaff(user.id); setOpenDropdownId(null); }}
                                className="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                Remove Access
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
          </div>
        )}

        {activeTab === 'database' && (
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm animate-in fade-in flex flex-col overflow-visible">
            <div className="px-5 py-4 border-b border-borderLight dark:border-borderDark">
              <h3 className="text-base font-semibold text-textLight dark:text-textDark">Database Manager</h3>
              <p className="text-sm text-mutedLight dark:text-mutedDark mt-0.5">Manage your system backups, imports, and system data resets.</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl">
                
                <div className="p-5 border border-borderLight dark:border-borderDark rounded bg-pageLight/50 dark:bg-pageDark/50 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="text-primary w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 14v-3a8 8 0 1 1 16 0v3" /><path d="M18 19c0 1.657 -2.686 3 -6 3s-6 -1.343 -6 -3c0 -3.197 12 -3.197 12 0z" /><path d="M12 14m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /></svg>
                      <h4 className="text-sm font-semibold text-textLight dark:text-textDark">Export Backup</h4>
                    </div>
                    <p className="text-xs text-mutedLight dark:text-mutedDark mb-4 leading-relaxed">
                      Download a complete JSON copy of all orders, payments, technician profiles, and settings.
                    </p>
                  </div>
                  <button onClick={handleBackup} className="px-4 py-2 border border-borderLight dark:border-borderDark bg-surfaceLight dark:bg-surfaceDark text-textLight dark:text-textDark text-sm font-medium rounded hover:bg-pageLight dark:hover:bg-pageDark transition-colors shadow-sm w-full flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
                    Download JSON
                  </button>
                </div>

                <div className="p-5 border border-borderLight dark:border-borderDark rounded bg-pageLight/50 dark:bg-pageDark/50 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="text-amber-500 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></svg>
                      <h4 className="text-sm font-semibold text-textLight dark:text-textDark">Import Backup</h4>
                    </div>
                    <p className="text-xs text-mutedLight dark:text-mutedDark mb-4 leading-relaxed">
                      Upload an existing JSON backup to restore previous records. This will update your active workspace.
                    </p>
                  </div>
                  <div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept=".json" 
                      className="hidden" 
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={isImporting}
                      className="px-4 py-2 bg-primary text-white text-sm font-medium rounded hover:bg-primaryHover transition-colors shadow-sm w-full flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></svg>
                      {isImporting ? 'Importing...' : 'Select JSON File'}
                    </button>
                  </div>
                </div>

                <div className="p-5 border border-red-200 dark:border-red-900/30 rounded bg-red-50/50 dark:bg-red-900/10 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="text-red-500 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                      <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Wipe Database</h4>
                    </div>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80 mb-4 leading-relaxed">
                      Danger Zone. Permanently delete all orders, payments, technicians, and logs. This action cannot be undone.
                    </p>
                  </div>
                  <button onClick={handleWipeDatabase} className="px-4 py-2 border border-red-200 dark:border-red-800 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors shadow-sm w-full flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                    Delete All Data
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>

      {/* Add Staff Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-xl w-full max-w-sm flex flex-col animate-in fade-in">
            <div className="px-5 py-3.5 border-b border-borderLight dark:border-borderDark flex items-center justify-between">
              <h3 className="text-base font-semibold text-textLight dark:text-textDark">Add New User</h3>
              <button onClick={() => setIsStaffModalOpen(false)} className="text-mutedLight dark:text-mutedDark hover:text-textLight dark:hover:text-textDark">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="p-5">
              <form id="staffForm" onSubmit={handleAddStaff} className="space-y-4">
                <div>
                  <label className={labelClass}>Full Name</label>
                  <input type="text" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input type="email" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Initial Role</label>
                  <select value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})} className={inputClass}>
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </div>
                <div className="p-3 bg-pageLight dark:bg-pageDark border border-borderLight dark:border-borderDark rounded text-xs text-mutedLight dark:text-mutedDark">
                  Initial password is set to <strong>123456</strong>. The user will be required to change it on their first login.
                </div>
              </form>
            </div>
            <div className="px-5 py-3 border-t border-borderLight dark:border-borderDark bg-pageLight/50 dark:bg-pageDark/50 flex justify-end gap-3 rounded-b-md">
              <button type="button" onClick={() => setIsStaffModalOpen(false)} className="px-3 py-1.5 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-sm font-medium rounded hover:bg-pageLight dark:hover:bg-pageDark transition-colors shadow-sm">Cancel</button>
              <button type="submit" form="staffForm" className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded hover:bg-primaryHover transition-colors shadow-sm">Create Account</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {isEditStaffModalOpen && editingStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-xl w-full max-w-sm flex flex-col animate-in fade-in">
            <div className="px-5 py-3.5 border-b border-borderLight dark:border-borderDark flex items-center justify-between">
              <h3 className="text-base font-semibold text-textLight dark:text-textDark">Edit User Information</h3>
              <button onClick={() => setIsEditStaffModalOpen(false)} className="text-mutedLight dark:text-mutedDark hover:text-textLight dark:hover:text-textDark">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="p-5">
              <form id="editStaffForm" onSubmit={handleEditStaffSubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input type="email" value={editingStaff.email} readOnly disabled className={readOnlyInputClass} />
                </div>
                <div>
                  <label className={labelClass}>Full Name</label>
                  <input type="text" value={editingStaff.name} onChange={e => setEditingStaff({...editingStaff, name: e.target.value})} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Profile Photo URL <span className="text-mutedLight dark:text-mutedDark font-normal text-xs ml-1">(Optional)</span></label>
                  <input type="url" value={editingStaff.photoURL || ''} onChange={e => setEditingStaff({...editingStaff, photoURL: e.target.value})} className={inputClass} placeholder="https://example.com/photo.jpg" />
                </div>
                <div>
                  <label className={labelClass}>Role</label>
                  <select value={editingStaff.role} onChange={e => setEditingStaff({...editingStaff, role: e.target.value})} className={inputClass}>
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Account Status</label>
                  <select value={editingStaff.status} onChange={e => setEditingStaff({...editingStaff, status: e.target.value})} className={inputClass}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </form>
            </div>
            <div className="px-5 py-3 border-t border-borderLight dark:border-borderDark bg-pageLight/50 dark:bg-pageDark/50 flex justify-end gap-3 rounded-b-md">
              <button type="button" onClick={() => setIsEditStaffModalOpen(false)} className="px-3 py-1.5 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-sm font-medium rounded hover:bg-pageLight dark:hover:bg-pageDark transition-colors shadow-sm">Cancel</button>
              <button type="submit" form="editStaffForm" className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded hover:bg-primaryHover transition-colors shadow-sm">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Technician Modal */}
      {isEditTechModalOpen && editingTech && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-xl w-full max-w-sm flex flex-col animate-in fade-in">
            <div className="px-5 py-3.5 border-b border-borderLight dark:border-borderDark flex items-center justify-between">
              <h3 className="text-base font-semibold text-textLight dark:text-textDark">Edit Technician</h3>
              <button onClick={() => setIsEditTechModalOpen(false)} className="text-mutedLight dark:text-mutedDark hover:text-textLight dark:hover:text-textDark">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <div className="p-5">
              <form id="editTechForm" onSubmit={handleEditTechSubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>Full Name</label>
                  <input type="text" value={editingTech.name} onChange={e => setEditingTech({...editingTech, name: e.target.value})} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Profile Photo URL <span className="text-mutedLight dark:text-mutedDark font-normal text-xs ml-1">(Optional)</span></label>
                  <input type="url" value={editingTech.photoURL || ''} onChange={e => setEditingTech({...editingTech, photoURL: e.target.value})} className={inputClass} placeholder="https://example.com/photo.jpg" />
                </div>
              </form>
            </div>
            <div className="px-5 py-3 border-t border-borderLight dark:border-borderDark bg-pageLight/50 dark:bg-pageDark/50 flex justify-end gap-3 rounded-b-md">
              <button type="button" onClick={() => setIsEditTechModalOpen(false)} className="px-3 py-1.5 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-sm font-medium rounded hover:bg-pageLight dark:hover:bg-pageDark transition-colors shadow-sm">Cancel</button>
              <button type="submit" form="editTechForm" className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded hover:bg-primaryHover transition-colors shadow-sm">Save Changes</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}