'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, addDoc, query, orderBy, serverTimestamp, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tenant, Contract } from '@/types';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import emailjs from '@emailjs/browser';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { getContractExpiryStatus, getExpiryBadgeClass } from '@/lib/utils';

// EmailJS configuration (replace with your actual credentials)
const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'YOUR_PUBLIC_KEY';

const initialContractFields = {
  propertyAddress: '',
  term: '',
  moveInDate: '',
  expiryDate: '',
  rentalPerMonth: 0,
  securityDeposit: 0,
  utilityDeposit: 0,
  accessCardDeposit: 0,
  agreementFee: 0,
  dateOfAgreement: '',
  companySignName: 'ALWAELI MOHAMMED',
  companySignNRIC: '09308729',
  companySignDesignation: 'Managing Director',
};

const storage = getStorage();

export default function ContractsPage() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [fields, setFields] = useState<Omit<Contract, 'id' | 'tenantId' | 'tenantName' | 'contractUrl' | 'createdAt' | 'updatedAt' | 'archived' | 'archivedAt' | 'status'>>({
    ...initialContractFields,
    acknowledged: false
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoading(true);
      try {
        // Fetch tenants
        const tenantsQuery = query(collection(db, 'users'), where('role', '==', 'tenant'));
        const tenantsSnapshot = await getDocs(tenantsQuery);
        const tenantsData = tenantsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Tenant));
        setTenants(tenantsData);

        // Fetch contracts
        const contractsQuery = query(collection(db, 'contracts'), orderBy('createdAt', 'desc'));
        const contractsSnapshot = await getDocs(contractsQuery);
        const contractsData = contractsSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          const tenant = tenantsData.find(t => t.id === data.tenantId);
          return {
            id: docSnap.id,
            ...data,
            tenantName: tenant?.fullName || 'Unknown Tenant',
          } as Contract;
        });
        setContracts(contractsData);

        // Automated expiry notifications
        await sendExpiryReminders(contractsData, tenantsData);

      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error('Failed to load data.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const sendExpiryReminders = async (contractsData: Contract[], tenantsData: Tenant[]) => {
    const expiringContracts = contractsData.filter(c => {
      const { status } = getContractExpiryStatus(c.expiryDate);
      return status === 'expiring_soon' && !c.reminderSent;
    });

    for (const contract of expiringContracts) {
      const tenant = tenantsData.find(t => t.id === contract.tenantId);
      if (!tenant || !tenant.email) continue;
      try {
        const templateParams = {
          to_name: tenant.fullName,
          to_email: tenant.email,
          contract_link: contract.contractUrl,
          expiry_date: new Date(contract.expiryDate).toLocaleDateString(),
          from_name: 'GREEN BRIDGE REALTY SDN. BHD',
        };
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
        await updateDoc(doc(db, 'contracts', contract.id), { reminderSent: true });
      } catch (err) {
        console.error("Failed to send expiry reminder for contract:", contract.id, err);
      }
    }
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isNumber = type === 'number';
    setFields(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value }));
  };
  
  const generateContractPDF = (tenant: Tenant, contractFields: typeof fields) => {
    const doc = new jsPDF();
    // This is a simplified version. The actual text generation should be more robust.
    doc.text(`Tenancy Agreement for ${tenant.fullName}`, 10, 10);
    doc.text(`Property: ${contractFields.propertyAddress}`, 10, 20);
    doc.text(`Rent: RM${contractFields.rentalPerMonth}/month`, 10, 30);
    // ... add all other fields
    return doc;
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) {
      toast.error('Please select a tenant.');
      return;
    }
    setIsSubmitting(true);

    try {
      const pdfDoc = generateContractPDF(selectedTenant, fields);
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];
      
      const fileName = `contract_${selectedTenant.id}_${Date.now()}.pdf`;
      const storageRef = ref(storage, `contracts/${fileName}`);
      await uploadString(storageRef, pdfBase64, 'base64', { contentType: 'application/pdf' });
      const pdfUrl = await getDownloadURL(storageRef);

      const contractData: Omit<Contract, 'id'> = {
        tenantId: selectedTenant.id,
        tenantName: selectedTenant.fullName,
        contractUrl: pdfUrl,
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        archived: false,
        status: 'pending',
      };
      
      let docRefId: string;

      if (selectedContract) {
        const contractRef = doc(db, 'contracts', selectedContract.id);
        await updateDoc(contractRef, { ...contractData, updatedAt: serverTimestamp() });
        docRefId = selectedContract.id;
        setContracts(prev => prev.map(c => c.id === docRefId ? { ...c, ...contractData } : c));
        toast.success('Contract updated successfully!');
      } else {
        const docRef = await addDoc(collection(db, 'contracts'), contractData);
        docRefId = docRef.id;
        setContracts(prev => [{ id: docRefId, ...contractData } as Contract, ...prev]);
        toast.success('Contract created successfully!');
      }

      setView('list');
      resetForm();

    } catch (error) {
      console.error("Error saving contract: ", error);
      toast.error('Failed to save contract.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFields({ ...initialContractFields, acknowledged: false });
    setSelectedTenant(null);
    setSelectedContract(null);
  }

  const handleEditContract = (contract: Contract) => {
    setSelectedContract(contract);
    const tenant = tenants.find(t => t.id === contract.tenantId);
    if (tenant) {
      setSelectedTenant(tenant);
    }
    setFields({
        propertyAddress: contract.propertyAddress,
        term: contract.term,
        moveInDate: contract.moveInDate.toString(),
        expiryDate: contract.expiryDate.toString(),
        rentalPerMonth: contract.rentalPerMonth,
        securityDeposit: contract.securityDeposit,
        utilityDeposit: contract.utilityDeposit,
        accessCardDeposit: contract.accessCardDeposit,
        agreementFee: contract.agreementFee,
        dateOfAgreement: contract.dateOfAgreement.toString(),
        companySignName: contract.companySignName,
        companySignNRIC: contract.companySignNRIC,
        companySignDesignation: contract.companySignDesignation,
        acknowledged: contract.acknowledged,
    });
    setView('edit');
  };

  const handleArchiveContract = async (contract: Contract) => {
    if (!window.confirm("Are you sure you want to archive this contract?")) return;
    try {
        const contractRef = doc(db, 'contracts', contract.id);
        await updateDoc(contractRef, { archived: true, archivedAt: serverTimestamp() });
        setContracts(prev => prev.filter(c => c.id !== contract.id));
        toast.success("Contract archived.");
    } catch (error) {
        console.error("Error archiving contract:", error);
        toast.error("Failed to archive contract.");
    }
  };

  const filteredContracts = useMemo(() => {
    return contracts.filter(c => c.archived === showArchived);
  }, [contracts, showArchived]);

  const renderContractList = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Contracts</h2>
        <button onClick={() => setView('create')} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
          Create New Contract
        </button>
      </div>
       <div className="mb-4">
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="form-checkbox h-5 w-5 text-indigo-600"
          />
          <span className="ml-2 text-gray-700">Show Archived Contracts</span>
        </label>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-4">Loading...</td></tr>
            ) : (
              filteredContracts.map(contract => {
                const expiryStatus = getContractExpiryStatus(contract.expiryDate);
                const badgeClass = getExpiryBadgeClass(expiryStatus.status);
                return (
                  <tr key={contract.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{contract.tenantName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{contract.propertyAddress}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(contract.expiryDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}`}>
                        {expiryStatus.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a href={contract.contractUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900 mr-4">View</a>
                      <button onClick={() => handleEditContract(contract)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                      {!contract.archived && (
                        <button onClick={() => handleArchiveContract(contract)} className="text-red-600 hover:text-red-900">Archive</button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderContractForm = () => (
    <form onSubmit={handleFormSubmit} className="bg-white p-8 rounded-lg shadow-md">
       <h2 className="text-2xl font-bold mb-6">{selectedContract ? 'Edit Contract' : 'Create Contract'}</h2>
      
       <div className="mb-4">
        <label htmlFor="tenant" className="block text-sm font-medium text-gray-700 mb-1">Select Tenant</label>
        <select
          id="tenant"
          value={selectedTenant?.id || ''}
          onChange={(e) => {
            const tenant = tenants.find(t => t.id === e.target.value);
            setSelectedTenant(tenant || null);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        >
          <option value="" disabled>-- Select a tenant --</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
        </select>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
            <label htmlFor="propertyAddress" className="block text-sm font-medium text-gray-700">Property Address</label>
            <input type="text" name="propertyAddress" id="propertyAddress" value={fields.propertyAddress} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
        </div>
        <div>
            <label htmlFor="term" className="block text-sm font-medium text-gray-700">Term (e.g., 1 year)</label>
            <input type="text" name="term" id="term" value={fields.term} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
        </div>
        <div>
            <label htmlFor="moveInDate" className="block text-sm font-medium text-gray-700">Move-in Date</label>
            <input type="date" name="moveInDate" id="moveInDate" value={fields.moveInDate.toString()} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
        </div>
        <div>
            <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700">Expiry Date</label>
            <input type="date" name="expiryDate" id="expiryDate" value={fields.expiryDate.toString()} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
        </div>
        <div>
            <label htmlFor="rentalPerMonth" className="block text-sm font-medium text-gray-700">Monthly Rent (RM)</label>
            <input type="number" name="rentalPerMonth" id="rentalPerMonth" value={fields.rentalPerMonth} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
        </div>
        <div>
            <label htmlFor="securityDeposit" className="block text-sm font-medium text-gray-700">Security Deposit (RM)</label>
            <input type="number" name="securityDeposit" id="securityDeposit" value={fields.securityDeposit} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
        </div>
         <div>
            <label htmlFor="utilityDeposit" className="block text-sm font-medium text-gray-700">Utility Deposit (RM)</label>
            <input type="number" name="utilityDeposit" id="utilityDeposit" value={fields.utilityDeposit} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
        </div>
         <div>
            <label htmlFor="accessCardDeposit" className="block text-sm font-medium text-gray-700">Access Card Deposit (RM)</label>
            <input type="number" name="accessCardDeposit" id="accessCardDeposit" value={fields.accessCardDeposit} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
        </div>
         <div>
            <label htmlFor="agreementFee" className="block text-sm font-medium text-gray-700">Agreement Fee (RM)</label>
            <input type="number" name="agreementFee" id="agreementFee" value={fields.agreementFee} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
        </div>
        <div>
            <label htmlFor="dateOfAgreement" className="block text-sm font-medium text-gray-700">Date of Agreement</label>
            <input type="date" name="dateOfAgreement" id="dateOfAgreement" value={fields.dateOfAgreement.toString()} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
        </div>
      </div>

      <div className="mt-8 flex justify-end gap-4">
        <button type="button" onClick={() => setView('list')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50">
          {isSubmitting ? 'Saving...' : (selectedContract ? 'Update Contract' : 'Create Contract')}
        </button>
      </div>
    </form>
  );

  return (
    <div className="container mx-auto p-4 md:p-8">
      {view === 'list' && renderContractList()}
      {(view === 'create' || view === 'edit') && renderContractForm()}
    </div>
  );
} 