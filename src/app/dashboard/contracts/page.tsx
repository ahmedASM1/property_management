'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { collection, getDocs, addDoc, query, orderBy, serverTimestamp, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tenant, Contract, Building, Unit } from '@/types';
import toast from 'react-hot-toast';
import emailjs from '@emailjs/browser';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { getContractExpiryStatus, getExpiryBadgeClass } from '@/lib/utils';
import { generateComprehensiveContractPDF, ContractFields, generateAgreementText } from '@/utils/contractGenerator';

// EmailJS configuration (replace with your actual credentials)
const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'YOUR_PUBLIC_KEY';

const initialContractFields = {
  propertyAddress: '',
  unitNumber: '',
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
  companyAddress: 'Kuala Lumpur, Malaysia',
  companyPhone: '+60 3-1234 5678',
  companyEmail: 'info@greenbridge-my.com',
};

export default function ContractsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantOverrides, setTenantOverrides] = useState<{ fullName?: string; idNumber?: string; phoneNumber?: string; email?: string }>({});
  const [fields, setFields] = useState<Omit<Contract, 'id' | 'tenantId' | 'tenantName' | 'contractUrl' | 'createdAt' | 'updatedAt' | 'archived' | 'archivedAt' | 'status'>>({
    ...initialContractFields,
    acknowledged: false
  });
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [editHandled, setEditHandled] = useState(false);
  
  // Check for edit query parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get('edit');
      if (editId && contracts.length > 0) {
        const contractToEdit = contracts.find(c => c.id === editId);
        if (contractToEdit) {
          handleEditContract(contractToEdit as Contract & { buildingId?: string; unitId?: string });
        }
      }
    }
  }, [contracts]);

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

        await sendExpiryReminders(contractsData, tenantsData);

        // Fetch buildings and units for dropdowns
        const buildingsQuery = query(collection(db, 'buildings'), orderBy('name'));
        const buildingsSnap = await getDocs(buildingsQuery);
        const buildingsData = buildingsSnap.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
          } as Building;
        });
        setBuildings(buildingsData);

        const unitsQuery = query(collection(db, 'units'), orderBy('fullUnitNumber'));
        const unitsSnap = await getDocs(unitsQuery);
        const unitsData = unitsSnap.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
          } as Unit;
        });
        setUnits(unitsData);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error('Failed to load data: ' + (error as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  // Helper function to safely convert dates
  const convertDateToString = useMemo(() => {
    return (dateValue: unknown): string => {
      if (!dateValue) return '';
      if (typeof dateValue === 'object' && dateValue !== null && 'toDate' in dateValue) {
        return (dateValue as { toDate: () => Date }).toDate().toISOString().split('T')[0];
      }
      if (typeof dateValue === 'string') {
        return dateValue.split('T')[0];
      }
      try {
        return new Date(dateValue as string | number | Date).toISOString().split('T')[0];
      } catch {
        return '';
      }
    };
  }, []);

  // Handle edit query parameter from contract detail page
  useEffect(() => {
    if (!searchParams || editHandled) return;
    const editId = searchParams.get('edit');
    if (editId && !editHandled && contracts.length > 0 && tenants.length > 0) {
      const contractToEdit = contracts.find(c => c.id === editId);
      if (contractToEdit) {
        try {
          setEditHandled(true);
          setSelectedContract(contractToEdit);
          const tenant = tenants.find(t => t.id === contractToEdit.tenantId);
          if (tenant) {
            setSelectedTenant(tenant);
          }
          const bid = (contractToEdit as { buildingId?: string }).buildingId || '';
          const uid = (contractToEdit as { unitId?: string }).unitId || '';
          setSelectedBuildingId(bid);
          setSelectedUnitId(uid);
          
          // Safely convert dates
          const moveInDateStr = convertDateToString(contractToEdit.moveInDate);
          const expiryDateStr = convertDateToString(contractToEdit.expiryDate);
          const dateOfAgreementStr = convertDateToString(contractToEdit.dateOfAgreement);
          
          const calculatedTerm = moveInDateStr && expiryDateStr 
            ? calculateTermDuration(moveInDateStr, expiryDateStr)
            : '';
          
          setFields({
            propertyAddress: contractToEdit.propertyAddress || '',
            unitNumber: contractToEdit.unitNumber || '',
            term: calculatedTerm || contractToEdit.term || '',
            moveInDate: moveInDateStr,
            expiryDate: expiryDateStr,
            rentalPerMonth: Number(contractToEdit.rentalPerMonth) || 0,
            securityDeposit: Number(contractToEdit.securityDeposit) || 0,
            utilityDeposit: Number(contractToEdit.utilityDeposit) || 0,
            accessCardDeposit: Number(contractToEdit.accessCardDeposit) || 0,
            agreementFee: Number(contractToEdit.agreementFee) || 0,
            dateOfAgreement: dateOfAgreementStr,
            companySignName: contractToEdit.companySignName || 'ALWAELI MOHAMMED',
            companySignNRIC: contractToEdit.companySignNRIC || '09308729',
            companySignDesignation: contractToEdit.companySignDesignation || 'Managing Director',
            companyAddress: contractToEdit.companyAddress || 'Kuala Lumpur, Malaysia',
            companyPhone: contractToEdit.companyPhone || '+60 3-1234 5678',
            companyEmail: contractToEdit.companyEmail || 'info@greenbridge-my.com',
            acknowledged: contractToEdit.acknowledged || false,
          });
          setView('edit');
        } catch (error) {
          console.error('Error loading contract for edit:', error);
          toast.error('Failed to load contract for editing');
          setEditHandled(true); // Mark as handled to prevent retry loops
        }
      } else if (editId) {
        // Contract not found, mark as handled to prevent retry
        setEditHandled(true);
      }
    }
  }, [searchParams, contracts, tenants, editHandled, convertDateToString]);

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

  // Function to calculate term duration from move-in and expiry dates
  const calculateTermDuration = (moveInDate: string, expiryDate: string): string => {
    if (!moveInDate || !expiryDate) return '';
    
    try {
      const start = new Date(moveInDate);
      const end = new Date(expiryDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        return '';
      }
      
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      const days = diffDays % 30;
      
      const parts: string[] = [];
      if (years > 0) {
        parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
      }
      if (months > 0) {
        parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
      }
      if (days > 0 && years === 0) {
        // Only show days if less than a month
        parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
      }
      
      return parts.length > 0 ? parts.join(' ') : '';
    } catch {
      return '';
    }
  };

  // Auto-calculate term when move-in date or expiry date changes
  useEffect(() => {
    if (fields.moveInDate && fields.expiryDate) {
      const moveInStr = fields.moveInDate.toString();
      const expiryStr = fields.expiryDate.toString();
      const calculatedTerm = calculateTermDuration(moveInStr, expiryStr);
      setFields(prev => ({ ...prev, term: calculatedTerm }));
    } else {
      // Clear term if dates are not both filled
      setFields(prev => ({ ...prev, term: '' }));
    }
  }, [fields.moveInDate, fields.expiryDate]);

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isNumber = type === 'number';
    setFields(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value }));
  };

  const handleTenantOverrideChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTenantOverrides(prev => ({ ...prev, [name]: value }));
  };
  
  const contractTotal = useMemo(() => {
    return (fields.rentalPerMonth || 0) + (fields.securityDeposit || 0) + (fields.utilityDeposit || 0) + (fields.accessCardDeposit || 0) + (fields.agreementFee || 0);
  }, [fields]);

  const getContractTenant = (): Tenant | null => {
    if (!selectedTenant) return null;
    return {
      ...selectedTenant,
      fullName: tenantOverrides.fullName || selectedTenant.fullName,
      idNumber: tenantOverrides.idNumber || selectedTenant.idNumber,
      phoneNumber: tenantOverrides.phoneNumber || selectedTenant.phoneNumber,
      email: tenantOverrides.email || selectedTenant.email,
    } as Tenant;
  };

  const generateContractPDF = async (tenant: Tenant, contractFields: typeof fields) => {
    return await generateComprehensiveContractPDF(tenant, contractFields as ContractFields);
  }

  const handleGeneratePreview = () => {
    const t = getContractTenant();
    if (!t) {
      toast.error('Please select a tenant.');
      return;
    }
    const html = generateAgreementText(t, fields as unknown as ContractFields);
    setPreviewHtml(html);
    toast.success('Contract preview generated');
  };

  const handleDownloadPdf = async () => {
    const t = getContractTenant();
    if (!t) {
      toast.error('Please select a tenant.');
      return;
    }
    try {
      const pdfDoc = await generateContractPDF(t, fields);
      const fileName = `tenancy_agreement_${t.fullName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      pdfDoc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) {
      toast.error('Please select a tenant.');
      return;
    }
    setIsSubmitting(true);

    try {
      const t = getContractTenant() as Tenant;
      const pdfDoc = await generateContractPDF(t, fields);
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];
      
      const fileName = `contract_${selectedTenant.id}_${Date.now()}.pdf`;
      const storageRef = ref(storage, `contracts/${fileName}`);
      await uploadString(storageRef, pdfBase64, 'base64', { contentType: 'application/pdf' });
      const pdfUrl = await getDownloadURL(storageRef);

      const contractData: Omit<Contract, 'id'> & { buildingId?: string; unitId?: string } = {
        tenantId: selectedTenant.id,
        tenantName: t.fullName,
        contractUrl: pdfUrl,
        ...fields,
        ...(selectedBuildingId && { buildingId: selectedBuildingId }),
        ...(selectedUnitId && { unitId: selectedUnitId }),
        agreementText: previewHtml || generateAgreementText(t, fields as unknown as ContractFields),
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
        // Update tenant with building/unit so it appears on profile and My residency
        const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
        const selectedUnit = units.find(u => u.id === selectedUnitId);
        if (selectedTenant?.id && (selectedBuilding || selectedUnit)) {
          await updateDoc(doc(db, 'users', selectedTenant.id), {
            ...(selectedBuildingId && { buildingId: selectedBuildingId }),
            ...(selectedBuilding && { buildingName: selectedBuilding.name }),
            ...(selectedUnitId && { unitId: selectedUnitId }),
            ...((selectedUnit?.fullUnitNumber || fields.unitNumber) && { unitNumber: selectedUnit?.fullUnitNumber || fields.unitNumber }),
            updatedAt: serverTimestamp(),
          });
        }
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
    setSelectedBuildingId('');
    setSelectedUnitId('');
  }

  const handleEditContract = (contract: Contract & { buildingId?: string; unitId?: string }) => {
    try {
      setSelectedContract(contract);
      const tenant = tenants.find(t => t.id === contract.tenantId);
      if (tenant) {
        setSelectedTenant(tenant);
      }
      const bid = (contract as { buildingId?: string }).buildingId || '';
      const uid = (contract as { unitId?: string }).unitId || '';
      setSelectedBuildingId(bid);
      setSelectedUnitId(uid);
      
      // Safely convert dates
      const moveInDateStr = convertDateToString(contract.moveInDate);
      const expiryDateStr = convertDateToString(contract.expiryDate);
      const dateOfAgreementStr = convertDateToString(contract.dateOfAgreement);
      
      const calculatedTerm = moveInDateStr && expiryDateStr 
        ? calculateTermDuration(moveInDateStr, expiryDateStr)
        : '';
      
      setFields({
        propertyAddress: contract.propertyAddress || '',
        unitNumber: contract.unitNumber || '',
        term: calculatedTerm || contract.term || '',
        moveInDate: moveInDateStr,
        expiryDate: expiryDateStr,
        rentalPerMonth: Number(contract.rentalPerMonth) || 0,
        securityDeposit: Number(contract.securityDeposit) || 0,
        utilityDeposit: Number(contract.utilityDeposit) || 0,
        accessCardDeposit: Number(contract.accessCardDeposit) || 0,
        agreementFee: Number(contract.agreementFee) || 0,
        dateOfAgreement: dateOfAgreementStr,
        companySignName: contract.companySignName || 'ALWAELI MOHAMMED',
        companySignNRIC: contract.companySignNRIC || '09308729',
        companySignDesignation: contract.companySignDesignation || 'Managing Director',
        companyAddress: contract.companyAddress || 'Kuala Lumpur, Malaysia',
        companyPhone: contract.companyPhone || '+60 3-1234 5678',
        companyEmail: contract.companyEmail || 'info@greenbridge-my.com',
        acknowledged: contract.acknowledged || false,
      });
      setView('edit');
    } catch (error) {
      console.error('Error editing contract:', error);
      toast.error('Failed to load contract for editing');
    }
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
    <div className="w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Contracts</h2>
        <button onClick={() => setView('create')} className="bg-indigo-600 text-white px-3 py-2 sm:px-4 rounded-md hover:bg-indigo-700 text-sm sm:text-base flex-shrink-0 w-full sm:w-auto">
          Create New Contract
        </button>
      </div>
       <div className="mb-4">
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="form-checkbox h-4 w-4 sm:h-5 sm:w-5 text-indigo-600"
          />
          <span className="ml-2 text-sm sm:text-base text-gray-700">Show Archived Contracts</span>
        </label>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-x-auto -mx-1 sm:mx-0">
        <table className="min-w-[600px] sm:min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-4 text-sm">Loading...</td></tr>
            ) : (
              filteredContracts.map(contract => {
                const expiryStatus = getContractExpiryStatus(contract.expiryDate);
                const badgeClass = getExpiryBadgeClass(expiryStatus.status);
                return (
                  <tr key={contract.id}>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm whitespace-nowrap">{contract.tenantName}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm whitespace-nowrap max-w-[120px] sm:max-w-none truncate" title={contract.propertyAddress}>{contract.propertyAddress}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm whitespace-nowrap">{new Date(contract.expiryDate).toLocaleDateString()}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}`}>
                        {expiryStatus.label}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                      <span className="flex flex-wrap justify-end gap-1 sm:gap-2">
                        <Link href={`/dashboard/contracts/${contract.id}`} className="text-indigo-600 hover:text-indigo-900">View</Link>
                        <a href={contract.contractUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">PDF</a>
                        <button onClick={() => handleEditContract(contract)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                        {!contract.archived && (
                          <button onClick={() => handleArchiveContract(contract)} className="text-red-600 hover:text-red-900">Archive</button>
                        )}
                      </span>
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
    <form onSubmit={handleFormSubmit} className="bg-white p-4 sm:p-6 md:p-8 rounded-lg shadow-md w-full min-w-0">
       <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">{selectedContract ? 'Edit Contract' : 'Create Contract'}</h2>
      
       <div className="mb-4">
        <label htmlFor="tenant" className="block text-sm font-medium text-gray-700 mb-1">Select Tenant</label>
        <select
          id="tenant"
          value={selectedTenant?.id || ''}
          onChange={(e) => {
            const tenant = tenants.find(t => t.id === e.target.value);
            setSelectedTenant(tenant || null);
            setTenantOverrides({});
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        >
          <option value="" disabled>-- Select a tenant --</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
        </select>
      </div>

      {/* Tenant Overrides */}
      {selectedTenant && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">Tenant Name</label>
            <input type="text" name="fullName" id="fullName" value={tenantOverrides.fullName ?? selectedTenant.fullName} onChange={handleTenantOverrideChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <div>
            <label htmlFor="idNumber" className="block text-sm font-medium text-gray-700">Passport / NRIC Number</label>
            <input type="text" name="idNumber" id="idNumber" value={tenantOverrides.idNumber ?? selectedTenant.idNumber ?? ''} onChange={handleTenantOverrideChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">Phone Number</label>
            <input type="text" name="phoneNumber" id="phoneNumber" value={tenantOverrides.phoneNumber ?? selectedTenant.phoneNumber ?? ''} onChange={handleTenantOverrideChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" name="email" id="email" value={tenantOverrides.email ?? selectedTenant.email} onChange={handleTenantOverrideChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
        </div>
      )}

      {/* Building & Unit: select from list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label htmlFor="building" className="block text-sm font-medium text-gray-700">Building</label>
          <select
            id="building"
            value={selectedBuildingId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedBuildingId(id);
              setSelectedUnitId('');
              const b = buildings.find(x => x.id === id);
              if (b) setFields(prev => ({ ...prev, propertyAddress: b.address }));
            }}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          >
            <option value="">-- Select a building (optional) --</option>
            {buildings.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="unit" className="block text-sm font-medium text-gray-700">Unit</label>
          <select
            id="unit"
            value={selectedUnitId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedUnitId(id);
              const u = units.find(x => x.id === id);
              if (u) {
                setFields(prev => ({
                  ...prev,
                  unitNumber: u.fullUnitNumber,
                  ...(u.monthlyRent != null && u.monthlyRent > 0 ? { rentalPerMonth: u.monthlyRent } : {}),
                }));
              }
            }}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          >
            <option value="">-- Select a unit (optional) --</option>
            {(selectedBuildingId ? units.filter(u => u.buildingId === selectedBuildingId) : units).map(u => (
              <option key={u.id} value={u.id}>{u.fullUnitNumber} {u.buildingName ? `(${u.buildingName})` : ''}</option>
            ))}
          </select>
          {!selectedUnitId && (
            <input type="text" name="unitNumber" id="unitNumberManual" value={fields.unitNumber} onChange={handleFieldChange} className="mt-2 block w-full rounded-md border-gray-300 shadow-sm" placeholder="Or enter unit number manually" />
          )}
        </div>
      </div>
      {!selectedBuildingId && (
        <div className="mb-6">
          <label htmlFor="propertyAddress" className="block text-sm font-medium text-gray-700">Property address (if not selected above)</label>
          <input type="text" name="propertyAddress" id="propertyAddress" value={fields.propertyAddress} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
            <label htmlFor="term" className="block text-sm font-medium text-gray-700">
              Term Duration <span className="text-xs text-gray-500 font-normal">(auto-calculated)</span>
            </label>
            <input 
              type="text" 
              name="term" 
              id="term" 
              value={fields.term || ''} 
              readOnly
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 cursor-not-allowed text-gray-700" 
              placeholder={fields.moveInDate && fields.expiryDate ? "Calculating..." : "Enter move-in and expiry dates to calculate"}
              required 
            />
            <p className="mt-1 text-xs text-gray-500">Automatically calculated from move-in and expiry dates</p>
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
            <label className="block text-sm font-medium text-gray-700">Total Payable (RM)</label>
            <input type="text" value={contractTotal} readOnly className="mt-1 block w-full rounded-md border-gray-200 bg-gray-50 shadow-sm" />
        </div>
        <div>
            <label htmlFor="dateOfAgreement" className="block text-sm font-medium text-gray-700">Date of Agreement</label>
            <input type="date" name="dateOfAgreement" id="dateOfAgreement" value={fields.dateOfAgreement.toString()} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
        </div>
      </div>

      {/* Company Information Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="companyAddress" className="block text-sm font-medium text-gray-700">Company Address</label>
            <input type="text" name="companyAddress" id="companyAddress" value={fields.companyAddress} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <div>
            <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700">Company Phone</label>
            <input type="text" name="companyPhone" id="companyPhone" value={fields.companyPhone} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <div>
            <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700">Company Email</label>
            <input type="email" name="companyEmail" id="companyEmail" value={fields.companyEmail} onChange={handleFieldChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <button type="button" onClick={handleGeneratePreview} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">Generate Contract</button>
        <button type="button" onClick={handleDownloadPdf} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Download PDF</button>
        <div className="flex justify-end">
          <button type="button" onClick={() => setView('list')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 mr-2">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50">
            {isSubmitting ? 'Saving...' : (selectedContract ? 'Save Changes' : 'Save Contract')}
          </button>
        </div>
      </div>

      {/* Preview */}
      {previewHtml && (
        <div className="mt-8 border rounded-md p-6 bg-white">
          <h3 className="text-lg font-semibold mb-4">Preview</h3>
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}
    </form>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 px-0 sm:px-2 md:px-4 lg:p-8">
      {view === 'list' && renderContractList()}
      {(view === 'create' || view === 'edit') && renderContractForm()}
    </div>
  );
} 