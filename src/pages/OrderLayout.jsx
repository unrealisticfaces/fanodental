import { useState } from 'react';
import { database } from '../firebase';
import { ref, push, set, runTransaction } from 'firebase/database';
import { useToast } from '../ToastContext';
import { useData } from '../DataContext'; 

export default function OrderLayout({ workspaceUid, userProfile }) {
  const { addToast } = useToast();
  const { technicians, orders } = useData(); 
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    dateReceived: '', dueDate: '', rxNumber: '', dentistName: '', patientName: '',
    product: 'PFM', descriptions: '', units: '', shade: '', techIncharge: '',
    pickUpBy: '', deliverBy: '', initialStatus: 'In progress',
    totalPrice: '', payment: '', balance: '', payType: 'Unpaid', nextDue: '', remarks: ''
  });

  const canCreate = userProfile?.permissions?.canCreate ?? true;

  if (!canCreate) {
    return (
      <div className="max-w-4xl mx-auto mt-8 px-4">
        <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm p-6 sm:p-10 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <h2 className="text-xl font-bold text-textLight dark:text-textDark mb-2">Access Denied</h2>
          <p className="text-mutedLight dark:text-mutedDark max-w-sm">
            Your account does not have permission to create new orders. Please contact your system administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };

    if (name === 'totalPrice' || name === 'payment') {
      const total = parseFloat(name === 'totalPrice' ? value : newFormData.totalPrice) || 0;
      const payment = parseFloat(name === 'payment' ? value : newFormData.payment) || 0;
      
      newFormData.balance = Math.max(0, total - payment).toString();

      if (payment <= 0) {
        newFormData.payType = 'Unpaid';
      } else if (payment >= total && total > 0) {
        newFormData.payType = 'Fully Paid';
      } else {
        newFormData.payType = 'Partial';
      }
    }

    setFormData(newFormData);
  };

  const handleNext = () => {
    let isValid = true;
    
    if (step === 1) {
      isValid = formData.dateReceived && formData.dueDate && formData.rxNumber.trim() && formData.dentistName.trim() && formData.patientName.trim();
      
      if (!isValid) {
        addToast("Please fill in all required fields before continuing.", "error");
        return;
      }

      const rxInput = formData.rxNumber.trim().toLowerCase();
      const isDuplicate = orders.some(order => order.rxNumber?.trim().toLowerCase() === rxInput);

      if (isDuplicate) {
        addToast(`Error: RX No. "${formData.rxNumber.trim()}" already exists in the system.`, "error");
        return;
      }
    } else if (step === 2) {
      isValid = formData.units && formData.shade.trim() && formData.techIncharge.trim();
      if (!isValid) {
        addToast("Please select a Technician and fill required fields.", "error");
        return;
      }
    } else if (step === 3) {
      isValid = formData.pickUpBy.trim() && formData.deliverBy.trim();
      if (!isValid) {
        addToast("Please fill in all required fields before continuing.", "error");
        return;
      }
    }
    
    setStep((s) => Math.min(s + 1, 4));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.totalPrice === '' || formData.payment === '' || !formData.nextDue) {
      addToast("Please fill in all required fields before submitting.", "error");
      return;
    }

    const rxInput = formData.rxNumber.trim().toLowerCase();
    const isDuplicate = orders.some(order => order.rxNumber?.trim().toLowerCase() === rxInput);

    if (isDuplicate) {
      addToast(`Error: RX No. "${formData.rxNumber.trim()}" already exists.`, "error");
      setStep(1);
      return;
    }

    if (!workspaceUid) {
      addToast("Workspace error. Please log in again.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const ordersRef = ref(database, `users/${workspaceUid}/orders`);
      const newOrderRef = push(ordersRef);
      await set(newOrderRef, { ...formData, createdAt: new Date().toISOString() });
      
      const initialPayment = parseFloat(formData.payment) || 0;
      if (initialPayment > 0) {
        await push(ref(database, `users/${workspaceUid}/payments`), {
          orderId: newOrderRef.key,
          rxNumber: formData.rxNumber,
          dentistName: formData.dentistName,
          amount: initialPayment,
          timestamp: new Date().toISOString(),
          recordedBy: userProfile?.name || 'Unknown'
        });
      }

      await runTransaction(ref(database, `users/${workspaceUid}/stats`), (stats) => {
        if (stats) {
          const total = parseFloat(formData.totalPrice) || 0;
          const pay = parseFloat(formData.payment) || 0;
          const safeProd = (formData.product || 'Unknown').replace(/[\.\#\$\/\[\]]/g, '-');
          const dateStr = (formData.dateReceived || new Date().toISOString()).substring(0, 10);

          stats.allTimeGross = (stats.allTimeGross || 0) + total;
          stats.allTimeCollected = (stats.allTimeCollected || 0) + pay;
          
          if (formData.initialStatus === 'In progress') {
            stats.activeJobs = (stats.activeJobs || 0) + 1;
          } else {
            stats.deliveredJobs = (stats.deliveredJobs || 0) + 1;
          }

          if (!stats.productRevenue) stats.productRevenue = {};
          stats.productRevenue[safeProd] = (stats.productRevenue[safeProd] || 0) + total;

          if (!stats.dailyRevenue) stats.dailyRevenue = {};
          if (!stats.dailyRevenue[dateStr]) stats.dailyRevenue[dateStr] = { gross: 0, collected: 0 };
          stats.dailyRevenue[dateStr].gross += total;
          stats.dailyRevenue[dateStr].collected += pay;
        }
        return stats;
      });

      const logsRef = ref(database, `users/${workspaceUid}/logs`);
      await push(logsRef, {
        action: 'CREATE', 
        entity: 'Order', 
        entityId: newOrderRef.key, 
        details: `RX No: ${formData.rxNumber} | Summary: Created order for ${formData.patientName} | Payment: ${formData.payType}`,
        userName: userProfile?.name || 'Unknown',
        userEmail: userProfile?.email || 'Unknown',
        userPhoto: userProfile?.photoURL || '',
        timestamp: new Date().toISOString()
      });

      setStep(1);
      setFormData({
        dateReceived: '', dueDate: '', rxNumber: '', dentistName: '', patientName: '',
        product: 'PFM', descriptions: '', units: '', shade: '', techIncharge: '',
        pickUpBy: '', deliverBy: '', initialStatus: 'In progress',
        totalPrice: '', payment: '', balance: '', payType: 'Unpaid', nextDue: '', remarks: ''
      });
      addToast("Order successfully saved!", "success");
    } catch (error) {
      addToast("Failed to save order.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "block w-full px-3 py-2 text-sm bg-white dark:bg-[#182433] border border-gray-300 dark:border-[#3a4859] rounded text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors shadow-sm";
  const readOnlyInputClass = "block w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#111824] border border-gray-200 dark:border-[#2b3644] rounded text-gray-500 dark:text-gray-400 cursor-not-allowed focus:outline-none shadow-sm font-medium";
  const stepLabels = ['General Information', 'Technical Specs', 'Logistics', 'Billing'];

  const Label = ({ title, required = true }) => (
    <label className="block text-sm font-medium text-textLight dark:text-textDark mb-1.5">
      {title} {required ? <span className="text-red-500">*</span> : <span className="font-normal text-mutedLight dark:text-mutedDark text-xs ml-1">(Optional)</span>}
    </label>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark rounded-md shadow-sm flex flex-col transition-colors duration-200">
        
        <div className="px-4 sm:px-5 py-3.5 border-b border-borderLight dark:border-borderDark">
          <h2 className="text-base font-semibold text-textLight dark:text-textDark">Create New Order</h2>
        </div>

        <div className="px-2 sm:px-5 py-3 border-b border-borderLight dark:border-borderDark bg-pageLight/50 dark:bg-pageDark/50">
          <div className="flex items-center justify-between w-full">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 flex flex-col items-center relative">
                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold z-10 transition-colors duration-200 ${
                  step >= i 
                    ? 'bg-primary text-white shadow-sm' 
                    : 'bg-surfaceLight dark:bg-surfaceDark text-mutedLight dark:text-mutedDark border border-borderLight dark:border-borderDark'
                }`}>
                  {i}
                </div>
                <div className={`mt-1.5 text-[10px] sm:text-xs font-medium hidden sm:block ${
                  step >= i ? 'text-textLight dark:text-textDark' : 'text-mutedLight dark:text-mutedDark'
                }`}>
                  {stepLabels[i-1]}
                </div>
                {i !== 4 && (
                  <div className={`absolute top-3 sm:top-4 left-[50%] w-full h-[2px] -z-0 transition-colors duration-200 ${
                    step > i ? 'bg-primary' : 'bg-borderLight dark:bg-borderDark'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-4 sm:p-5 min-h-[320px]">
            {step === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                <div><Label title="Date Received" /><input type="date" name="dateReceived" value={formData.dateReceived} onChange={handleChange} className={inputClass} /></div>
                <div><Label title="Due Date" /><input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} className={inputClass} /></div>
                <div><Label title="RX No." /><input type="text" name="rxNumber" value={formData.rxNumber} onChange={handleChange} className={inputClass} placeholder="e.g. RX-1002" /></div>
                <div><Label title="Dentist Name" /><input type="text" name="dentistName" value={formData.dentistName} onChange={handleChange} className={inputClass} placeholder="e.g. Smith" /></div>
                <div className="md:col-span-2"><Label title="Patient Name" /><input type="text" name="patientName" value={formData.patientName} onChange={handleChange} className={inputClass} placeholder="e.g. John Doe" /></div>
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                <div>
                  <Label title="Product" />
                  <select name="product" value={formData.product} onChange={handleChange} className={inputClass}>
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
                <div><Label title="Units (pcs)" /><input type="number" name="units" value={formData.units} onChange={handleChange} className={inputClass} placeholder="1" /></div>
                <div><Label title="Shade" /><input type="text" name="shade" value={formData.shade} onChange={handleChange} className={inputClass} placeholder="e.g. A2" /></div>
                <div>
                  <Label title="Tech Incharge" />
                  <select name="techIncharge" value={formData.techIncharge} onChange={handleChange} className={inputClass}>
                    <option value="" disabled>Select Technician...</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2"><Label title="Descriptions" required={false} /><textarea name="descriptions" value={formData.descriptions} onChange={handleChange} className={`h-24 resize-none ${inputClass}`} placeholder="Any special instructions for the lab..." /></div>
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                <div><Label title="Pick Up By" /><input type="text" name="pickUpBy" value={formData.pickUpBy} onChange={handleChange} className={inputClass} placeholder="Courier Name" /></div>
                <div><Label title="Deliver By" /><input type="text" name="deliverBy" value={formData.deliverBy} onChange={handleChange} className={inputClass} placeholder="Courier Name" /></div>
                <div className="md:col-span-2">
                  <Label title="Job Status" />
                  <select name="initialStatus" value={formData.initialStatus} onChange={handleChange} className={inputClass}>
                    <option>In progress</option><option>Delivered</option>
                  </select>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                <div><Label title="Total Price" /><div className="relative"><span className="absolute left-3 top-2 text-mutedLight dark:text-mutedDark font-medium">₱</span><input type="number" name="totalPrice" value={formData.totalPrice} onChange={handleChange} className={`${inputClass} pl-8`} placeholder="0.00" /></div></div>
                <div><Label title="Payment Amount" /><div className="relative"><span className="absolute left-3 top-2 text-mutedLight dark:text-mutedDark font-medium">₱</span><input type="number" name="payment" value={formData.payment} onChange={handleChange} className={`${inputClass} pl-8`} placeholder="0.00" /></div></div>
                <div><Label title="Remaining Balance" required={false} /><div className="relative"><span className="absolute left-3 top-2 text-mutedLight dark:text-mutedDark font-medium">₱</span><input type="number" name="balance" value={formData.balance} readOnly tabIndex={-1} className={`${readOnlyInputClass} pl-8`} /></div></div>
                <div>
                  <Label title="Pay Type" />
                  <select name="payType" value={formData.payType} onChange={handleChange} className={inputClass}>
                    <option value="Unpaid">Unpaid</option><option value="Partial">Partial</option><option value="Fully Paid">Fully Paid</option>
                  </select>
                </div>
                <div><Label title="Next Due Date" /><input type="date" name="nextDue" value={formData.nextDue} onChange={handleChange} className={inputClass} /></div>
                <div><Label title="Remarks" required={false} /><input type="text" name="remarks" value={formData.remarks} onChange={handleChange} className={inputClass} placeholder="Payment notes..." /></div>
              </div>
            )}
          </div>

          <div className="px-4 sm:px-5 py-3.5 bg-pageLight/50 dark:bg-pageDark/50 border-t border-borderLight dark:border-borderDark flex justify-between items-center mt-auto">
            {step > 1 ? (
              <button type="button" onClick={prevStep} className="px-4 py-2 bg-surfaceLight dark:bg-surfaceDark border border-borderLight dark:border-borderDark text-textLight dark:text-textDark text-sm font-medium rounded hover:bg-pageLight dark:hover:bg-pageDark transition-colors shadow-sm disabled:opacity-50">
                Back
              </button>
            ) : <div />}
            
            {step < 4 ? (
              <button type="button" onClick={handleNext} className="px-6 py-2 bg-primary text-white text-sm font-medium rounded hover:bg-primaryHover transition-colors shadow-sm">
                Continue
              </button>
            ) : (
              <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-primary text-white text-sm font-bold tracking-wide rounded hover:bg-primaryHover transition-colors shadow-sm disabled:opacity-50">
                {isSubmitting ? 'Saving...' : 'Submit Order'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}