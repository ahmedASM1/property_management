'use client';
import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, orderBy, serverTimestamp, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tenant } from '@/types';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import emailjs from '@emailjs/browser';
import { getStorage, ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { getContractExpiryStatus, getExpiryBadgeClass } from '@/lib/utils';
import { Toaster } from "react-hot-toast";
import { AuthProvider } from '@/contexts/AuthContext';
import NavBar from '@/components/NavBar';
import { usePathname } from "next/navigation";

// EmailJS configuration
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';

const initialContractFields = {
  propertyAddress: '',
  term: '',
  moveInDate: '',
  expiryDate: '',
  rentalPerMonth: '',
  securityDeposit: '',
  utilityDeposit: '',
  accessCardDeposit: '',
  agreementFee: '',
  dateOfAgreement: '',
  companySignName: 'ALWAELI MOHAMMED',
  companySignNRIC: '09308729',
  companySignDesignation: 'Managing Director',
};

const storage = getStorage();

interface Contract {
  id: string;
  tenantId: string;
  tenantName: string;
  contractUrl: string;
  propertyAddress: string;
  term: string;
  moveInDate: string;
  expiryDate: string;
  rentalPerMonth: string;
  securityDeposit: string;
  utilityDeposit: string;
  accessCardDeposit: string;
  agreementFee: string;
  dateOfAgreement: string;
  companySignName: string;
  companySignNRIC: string;
  companySignDesignation: string;
  createdAt: any;
  updatedAt: any;
  archived: boolean;
  archivedAt: any;
  previousContractId?: string;
  renewed?: boolean;
  reminderSent?: boolean;
}

export default ContractsPage;

export function ContractsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [fields, setFields] = useState(initialContractFields);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const { user } = useAuth ? useAuth() : { user: null };
  const [pushingToTenant, setPushingToTenant] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [renewingContractId, setRenewingContractId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedContracts, setArchivedContracts] = useState<Contract[]>([]);
  const [tenantIdImage, setTenantIdImage] = useState<File | null>(null);
  const [tenantIdImageUrl, setTenantIdImageUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch tenants
        const tenantsSnapshot = await getDocs(collection(db, 'users'));
        const tenantsData = tenantsSnapshot.docs
          .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((t: any) => t.role === 'tenant') as Tenant[];
        setTenants(tenantsData);

        // Fetch contracts
        const contractsSnapshot = await getDocs(
          query(collection(db, 'contracts'), orderBy('createdAt', 'desc'))
        );
        const contractsData = await Promise.all(
          contractsSnapshot.docs.map(async (doc) => {
            const data = doc.data();
            const tenant = tenantsData.find(t => t.id === data.tenantId);
            return {
              id: doc.id,
              ...data,
              tenantName: tenant?.fullName || 'Unknown Tenant',
            } as Contract;
          })
        );
        setArchivedContracts(contractsData.filter(c => c.archived));
        setContracts(contractsData.filter(c => !c.archived));

        // Automated expiry notifications
        const expiringContracts = contractsData.filter(c => {
          const expiryStatus = getContractExpiryStatus(c.expiryDate);
          return expiryStatus.status === 'expiring_soon' && !c.reminderSent;
        });
        for (const contract of expiringContracts) {
          const tenant = tenantsData.find(t => t.id === contract.tenantId);
          if (!tenant) continue;
          try {
            const templateParams = {
              to_name: tenant.fullName,
              to_email: tenant.email,
              contract_link: contract.contractUrl,
              expiry_date: new Date(contract.expiryDate).toLocaleDateString(),
              from_name: 'GREEN BRIDGE REALTY SDN. BHD',
            };
            await emailjs.send(
              EMAILJS_SERVICE_ID,
              EMAILJS_TEMPLATE_ID,
              templateParams,
              EMAILJS_PUBLIC_KEY
            );
            await updateDoc(doc(db, 'contracts', contract.id), { reminderSent: true });
          } catch (err) {
            // Optionally log error
          }
        }
      } catch (error) {
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleTenantSelect = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFields({
      ...initialContractFields,
      rentalPerMonth: tenant.rentAmount ? String(tenant.rentAmount) : '',
    });
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields({ ...fields, [e.target.name]: e.target.value });
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    setShowPreview(true);
  };

  const handleExportPDF = async () => {
    const doc = new (jsPDF as any)();
    const contractText = `SUB-TENANCY AGREEMENT\n\nDate: ${fields.dateOfAgreement}\n\nBETWEEN:\nCompany: GREEN BRIDGE REALTY SDN. BHD\nCompany No: 202301042822 (1536738-K)\n\nAND\nTenant: ${selectedTenant?.fullName}\nPassport/NRIC: ${selectedTenant?.idNumber}\n\nDescription of said premises: ${fields.propertyAddress}\n\n1. AGREEMENT TO LET\n1.1 The Company agrees to sub-let the premises to the Tenant, and the Tenant agrees to accept the sub-tenancy for the term and rental price as stated.\n\n2. DEPOSITS\n2.1 Upon execution of this agreement, the Tenant shall pay the Company the required deposits (security and utility) as stated, which act as security for compliance with the agreement.\n2.2 The deposits are refundable without interest within 14 days after the end of the tenancy term.\n2.3 The Tenant may not use the deposits to offset rental payments.\n\n3. TENANT'S COVENANT\n(a) Pay rental in advance as per agreement.\n(b) Promptly pay for and settle all utilities.\n(c) Not transfer, assign, sub-let, or share occupation of the premises without the Company's written consent.\n(d) Not use the premises for any illegal, unlawful, or immoral purposes or cause nuisance to neighbors, and to indemnify the Company against any claims arising therefrom.\n\n4. TERMINATION OF TENANCY\n4.1 The Company may terminate the agreement with 7 days' notice if the Tenant: (a) Fails to pay rent on time. (b) Vacates early or sub-lets without consent. (c) Breaches any terms and fails to remedy the breach after notice. In such cases: (a) The Company will forfeit all deposits. (b) The Tenant is liable for damages, costs (including legal fees), and remaining rental as liquidated damages. (c) The Company may re-enter the premises. (d) The Company may take further legal or equitable action, at the Tenant's cost.\n4.2 If the Tenant ends the tenancy early: Deposits are forfeited. Tenant must pay rent for the unexpired term as liquidated damages. This does not affect the Company's rights for further legal action.\n\nSIGNATURES\nSigned on behalf of the Company: ${fields.companySignName}\nName: ${fields.companySignName}\nNRIC No: ${fields.companySignNRIC}\nDesignation: ${fields.companySignDesignation}\n\nSigned by the Tenant: ______________________  (${selectedTenant?.fullName})\nName: ${selectedTenant?.fullName}\nNRIC: ${selectedTenant?.idNumber}\nDesignation: ______________________\n\nGENERAL HOUSE RULES\nNo smoking in the property or premises.\nKeep the room and common areas clean and safe from fire/health hazards.\nNo nailing or drilling allowed.\nLock doors and secure personal items when leaving.\nDo not move or damage furniture; Tenant is responsible for any damages.\nTenant is responsible for lost/damaged access cards, keys, or parking cards. Access card replacement: RM 150\nQuiet hours: Weekdays: 11:00 PM – 8:00 AM, Weekends: 11:00 PM – 11:00 AM. Loud noises or disturbances are prohibited. Tenant is responsible for guests. Guests must leave by 12:00 AM. Overnight stays require prior permission. No pets allowed. Violating rules may lead to written warning or tenancy termination without refund of any deposits.\n\nAcknowledgement: I have read, understood, and agree to the General House Rules.\nSignature: ______________________\nName: ${selectedTenant?.fullName}\nDate: ${fields.dateOfAgreement}\n\nINVENTORY / TENANCY DETAILS\nTerm: ${fields.term}\nMove-in Date: ${fields.moveInDate}\nExpiry Date: ${fields.expiryDate}\nRental per Month: ${fields.rentalPerMonth}\nSecurity Deposit: ${fields.securityDeposit}\nUtility Deposit: ${fields.utilityDeposit}\nAccess Card Deposit: ${fields.accessCardDeposit}\nAgreement fee: ${fields.agreementFee}\n\nPARTICULARS\nDate of Agreement: ${fields.dateOfAgreement}\nTenant Name: ${selectedTenant?.fullName}\nNRIC / Passport No: ${selectedTenant?.idNumber}\nTenant Phone: ${selectedTenant?.phoneNumber}\nTenant Email: ${selectedTenant?.email}\nCompany Name: GREEN BRIDGE REALTY SDN. BHD\nCompany No: 202301042822 (1536738-K)\nCompany Address: 3-38, Kompleks Kantonmen Prima, 698, Jalan Sultan Azlan Shah, Batu 4½, Jalan Ipoh, 51200 Kuala Lumpur, W.P. Kuala Lumpur, Malaysia\nCompany Tel: 011-23583397\nCompany Mobile: +60 11-1608 0460\nCompany Email: myroom8685@gmail.com\nProperty Address: ${fields.propertyAddress}`;

    const lines = doc.splitTextToSize(contractText, 180);
    let y = 10;
    lines.forEach((line: string) => {
      if (y > 280) {
        doc.addPage();
        y = 10;
      }
      doc.text(line, 10, y);
      y += 7;
    });

    // If editing, update existing PDF
    if (isEditing && selectedContract) {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const storageRef = ref(storage, `contracts/contract_${selectedContract.tenantId}_${Date.now()}.pdf`);
      await uploadString(storageRef, pdfBase64, 'base64', {
        contentType: 'application/pdf',
      });
      const pdfUrl = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'contracts', selectedContract.id), {
        contractUrl: pdfUrl,
        updatedAt: serverTimestamp(),
      });
      toast.success('Contract updated successfully');
    } else {
      doc.save('Sub-Tenancy-Agreement.pdf');
    }

    // After contract creation or update
    await addDoc(collection(db, 'notifications'), {
      userId: selectedTenant?.id,
      message: isEditing ? 'Your contract has been updated.' : 'Your contract has been created.',
      read: false,
      createdAt: serverTimestamp(),
    });
  };

  const handleSendToTenant = async () => {
    if (!selectedTenant?.email) {
      toast.error('Tenant email is required');
      return;
    }
    setPushingToTenant(true);
    try {
      // Generate PDF
      const pdfDoc = new (jsPDF as any)();
      const contractText = `SUB-TENANCY AGREEMENT\n\nDate: ${fields.dateOfAgreement}\n\nBETWEEN:\nCompany: GREEN BRIDGE REALTY SDN. BHD\nCompany No: 202301042822 (1536738-K)\n\nAND\nTenant: ${selectedTenant?.fullName}\nPassport/NRIC: ${selectedTenant?.idNumber}\n\nDescription of said premises: ${fields.propertyAddress}\n\n1. AGREEMENT TO LET\n1.1 The Company agrees to sub-let the premises to the Tenant, and the Tenant agrees to accept the sub-tenancy for the term and rental price as stated.\n\n2. DEPOSITS\n2.1 Upon execution of this agreement, the Tenant shall pay the Company the required deposits (security and utility) as stated, which act as security for compliance with the agreement.\n2.2 The deposits are refundable without interest within 14 days after the end of the tenancy term.\n2.3 The Tenant may not use the deposits to offset rental payments.\n\n3. TENANT'S COVENANT\n(a) Pay rental in advance as per agreement.\n(b) Promptly pay for and settle all utilities.\n(c) Not transfer, assign, sub-let, or share occupation of the premises without the Company's written consent.\n(d) Not use the premises for any illegal, unlawful, or immoral purposes or cause nuisance to neighbors, and to indemnify the Company against any claims arising therefrom.\n\n4. TERMINATION OF TENANCY\n`;
      const lines = pdfDoc.splitTextToSize(contractText, 180);
      let y = 10;
      lines.forEach((line: string) => {
        if (y > 280) {
          pdfDoc.addPage();
          y = 10;
        }
        pdfDoc.text(line, 10, y);
        y += 7;
      });

      // Convert PDF to base64
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];
      
      // Upload to Firebase Storage
      const fileName = `contract_${selectedTenant.id}_${Date.now()}.pdf`;
      const storageRef = ref(storage, `contracts/${fileName}`);
      await uploadString(storageRef, pdfBase64, 'base64', {
        contentType: 'application/pdf',
      });
      
      // Get download URL
      const pdfUrl = await getDownloadURL(storageRef);
      
      // Create contract document in Firestore
      const contractData = {
        tenantId: selectedTenant.id,
        contractUrl: pdfUrl,
        propertyAddress: fields.propertyAddress,
        term: fields.term,
        moveInDate: fields.moveInDate,
        expiryDate: fields.expiryDate,
        rentalPerMonth: fields.rentalPerMonth,
        securityDeposit: fields.securityDeposit,
        utilityDeposit: fields.utilityDeposit,
        accessCardDeposit: fields.accessCardDeposit,
        agreementFee: fields.agreementFee,
        dateOfAgreement: fields.dateOfAgreement,
        companySignName: fields.companySignName,
        companySignNRIC: fields.companySignNRIC,
        companySignDesignation: fields.companySignDesignation,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      const contractRef = await addDoc(collection(db, 'contracts'), contractData);
      
      // Update tenant's contractUrl
      await updateDoc(doc(db, 'users', selectedTenant.id), {
        contractUrl: pdfUrl,
        updatedAt: serverTimestamp(),
      });
      
      // Send email with EmailJS
      const templateParams = {
        to_name: selectedTenant.fullName,
        to_email: selectedTenant.email,
        contract_link: pdfUrl,
        from_name: 'GREEN BRIDGE REALTY SDN. BHD',
      };
      
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );
      
      toast.success('Contract created and sent successfully to tenant');
      setView('list');

      if (renewingContractId) {
        await updateDoc(doc(db, 'contracts', renewingContractId), { renewed: true, renewedAt: serverTimestamp() });
        await updateDoc(doc(db, 'contracts', contractRef.id), { previousContractId: renewingContractId });
        setRenewingContractId(null);
      }

      // After contract creation or update
      await addDoc(collection(db, 'notifications'), {
        userId: selectedTenant.id,
        message: 'Your contract has been created.',
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error creating contract:', error);
      toast.error('Failed to create and send contract to tenant');
    } finally {
      setPushingToTenant(false);
    }
  };

  const handleEditContract = (contract: Contract) => {
    setSelectedContract(contract);
    setIsEditing(true);
    setView('edit');
    const tenant = tenants.find(t => t.id === contract.tenantId);
    if (tenant) {
      setSelectedTenant(tenant);
      setFields({
        propertyAddress: contract.propertyAddress,
        term: contract.term,
        moveInDate: contract.moveInDate,
        expiryDate: contract.expiryDate,
        rentalPerMonth: contract.rentalPerMonth,
        securityDeposit: contract.securityDeposit,
        utilityDeposit: contract.utilityDeposit,
        accessCardDeposit: contract.accessCardDeposit,
        agreementFee: contract.agreementFee,
        dateOfAgreement: contract.dateOfAgreement,
        companySignName: contract.companySignName,
        companySignNRIC: contract.companySignNRIC,
        companySignDesignation: contract.companySignDesignation,
      });
    }
  };

  const handleViewContract = (contract: Contract) => {
    window.open(contract.contractUrl, '_blank');
  };

  const handleSendExpiryReminder = async (contract: Contract, tenant: Tenant) => {
    try {
      const templateParams = {
        to_name: tenant.fullName,
        to_email: tenant.email,
        contract_link: contract.contractUrl,
        expiry_date: new Date(contract.expiryDate).toLocaleDateString(),
        from_name: 'GREEN BRIDGE REALTY SDN. BHD',
      };

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );

      toast.success('Expiry reminder sent successfully');
    } catch (error) {
      console.error('Error sending expiry reminder:', error);
      toast.error('Failed to send expiry reminder');
    }
  };

  const handleRenewContract = (contract: Contract) => {
    setSelectedTenant(tenants.find(t => t.id === contract.tenantId) || null);
    setFields({
      ...initialContractFields,
      ...contract,
      moveInDate: '',
      expiryDate: '',
      dateOfAgreement: '',
    });
    setIsEditing(false);
    setView('create');
    setRenewingContractId(contract.id);
  };

  const handleArchiveContract = async (contract: Contract) => {
    await updateDoc(doc(db, 'contracts', contract.id), { archived: true, archivedAt: serverTimestamp() });
    setContracts(contracts.filter(c => c.id !== contract.id));
    setArchivedContracts([...archivedContracts, { ...contract, archived: true }]);
    toast.success('Contract archived');
  };

  const handleUnarchiveContract = async (contract: Contract) => {
    await updateDoc(doc(db, 'contracts', contract.id), { archived: false });
    setArchivedContracts(archivedContracts.filter(c => c.id !== contract.id));
    setContracts([...contracts, { ...contract, archived: false }]);
    toast.success('Contract unarchived');
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant?.email) {
      toast.error('Tenant email is required');
      return;
    }
    setPushingToTenant(true);
    try {
      // Generate PDF
      const pdfDoc = new (jsPDF as any)();
      const contractText = `SUB-TENANCY AGREEMENT\n\nDate: ${fields.dateOfAgreement}\n\nBETWEEN:\nCompany: GREEN BRIDGE REALTY SDN. BHD\nCompany No: 202301042822 (1536738-K)\n\nAND\nTenant: ${selectedTenant?.fullName}\nPassport/NRIC: ${selectedTenant?.idNumber}\n\nDescription of said premises: ${fields.propertyAddress}\n\n1. AGREEMENT TO LET\n1.1 The Company agrees to sub-let the premises to the Tenant, and the Tenant agrees to accept the sub-tenancy for the term and rental price as stated.\n\n2. DEPOSITS\n2.1 Upon execution of this agreement, the Tenant shall pay the Company the required deposits (security and utility) as stated, which act as security for compliance with the agreement.\n2.2 The deposits are refundable without interest within 14 days after the end of the tenancy term.\n2.3 The Tenant may not use the deposits to offset rental payments.\n\n3. TENANT'S COVENANT\n(a) Pay rental in advance as per agreement.\n(b) Promptly pay for and settle all utilities.\n(c) Not transfer, assign, sub-let, or share occupation of the premises without the Company's written consent.\n(d) Not use the premises for any illegal, unlawful, or immoral purposes or cause nuisance to neighbors, and to indemnify the Company against any claims arising therefrom.\n\n4. TERMINATION OF TENANCY\n`;
      const lines = pdfDoc.splitTextToSize(contractText, 180);
      let y = 10;
      lines.forEach((line: string) => {
        if (y > 280) {
          pdfDoc.addPage();
          y = 10;
        }
        pdfDoc.text(line, 10, y);
        y += 7;
      });

      let idImageUrl = '';
      if (tenantIdImage) {
        const idImageRef = ref(storage, `tenant-id-images/${selectedTenant.id}_${Date.now()}`);
        await uploadBytes(idImageRef, tenantIdImage);
        idImageUrl = await getDownloadURL(idImageRef);
        setTenantIdImageUrl(idImageUrl);
      }

      if (idImageUrl) {
        pdfDoc.addPage();
        pdfDoc.setFontSize(14);
        pdfDoc.text('Tenant ID Image:', 10, 20);
        pdfDoc.addImage(idImageUrl, 'JPEG', 10, 30, 100, 60);
      }

      // Convert PDF to base64
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];
      
      // Upload to Firebase Storage
      const fileName = `contract_${selectedTenant.id}_${Date.now()}.pdf`;
      const storageRef = ref(storage, `contracts/${fileName}`);
      await uploadString(storageRef, pdfBase64, 'base64', {
        contentType: 'application/pdf',
      });
      
      // Get download URL
      const pdfUrl = await getDownloadURL(storageRef);
      
      // Create contract document in Firestore
      const contractData = {
        tenantId: selectedTenant.id,
        contractUrl: pdfUrl,
        propertyAddress: fields.propertyAddress,
        term: fields.term,
        moveInDate: fields.moveInDate,
        expiryDate: fields.expiryDate,
        rentalPerMonth: fields.rentalPerMonth,
        securityDeposit: fields.securityDeposit,
        utilityDeposit: fields.utilityDeposit,
        accessCardDeposit: fields.accessCardDeposit,
        agreementFee: fields.agreementFee,
        dateOfAgreement: fields.dateOfAgreement,
        companySignName: fields.companySignName,
        companySignNRIC: fields.companySignNRIC,
        companySignDesignation: fields.companySignDesignation,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        tenantIdImageUrl: idImageUrl,
      };
      
      const contractRef = await addDoc(collection(db, 'contracts'), contractData);
      
      // Update tenant's contractUrl
      await updateDoc(doc(db, 'users', selectedTenant.id), {
        contractUrl: pdfUrl,
        updatedAt: serverTimestamp(),
      });
      
      // Send email with EmailJS
      const templateParams = {
        to_name: selectedTenant.fullName,
        to_email: selectedTenant.email,
        contract_link: pdfUrl,
        from_name: 'GREEN BRIDGE REALTY SDN. BHD',
      };
      
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );
      
      toast.success('Contract created and sent successfully to tenant');
      setView('list');

      if (renewingContractId) {
        await updateDoc(doc(db, 'contracts', renewingContractId), { renewed: true, renewedAt: serverTimestamp() });
        await updateDoc(doc(db, 'contracts', contractRef.id), { previousContractId: renewingContractId });
        setRenewingContractId(null);
      }

      // After contract creation or update
      await addDoc(collection(db, 'notifications'), {
        userId: selectedTenant.id,
        message: 'Your contract has been created.',
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error creating contract:', error);
      toast.error('Failed to create contract');
    } finally {
      setPushingToTenant(false);
    }
  };

  const renderContractList = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Contracts</h2>
        <button
          onClick={() => {
            setView('create');
            setSelectedTenant(null);
            setFields(initialContractFields);
            setIsEditing(false);
            setSelectedContract(null);
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Create New Contract
        </button>
      </div>

      <div className="flex space-x-2 mb-4">
        <button onClick={() => setShowArchived(false)} className={`px-3 py-1 rounded ${!showArchived ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Active</button>
        <button onClick={() => setShowArchived(true)} className={`px-3 py-1 rounded ${showArchived ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Archived</button>
      </div>

      {/* Mobile View - Cards */}
      <div className="sm:hidden space-y-4">
        {contracts.map(contract => {
          const expiryStatus = getContractExpiryStatus(contract.expiryDate);
          const tenant = tenants.find(t => t.id === contract.tenantId);
          return (
            <div key={contract.id} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-lg">{contract.tenantName}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getExpiryBadgeClass(expiryStatus.status)}`}>
                      {expiryStatus.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Property: {contract.propertyAddress}</p>
                  <p className="text-sm text-gray-600">Term: {contract.term}</p>
                  <p className="text-sm text-gray-600">Rent: RM{contract.rentalPerMonth}/month</p>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <button
                    onClick={() => handleViewContract(contract)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View PDF
                  </button>
                  <button
                    onClick={() => handleEditContract(contract)}
                    className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Edit
                  </button>
                  {expiryStatus.status === 'expiring_soon' && tenant && (
                    <button
                      onClick={() => handleSendExpiryReminder(contract, tenant)}
                      className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Send Reminder
                    </button>
                  )}
                  {(expiryStatus.status === 'expired' || contract.renewed) && !contract.archived && (
                    <button
                      onClick={() => handleArchiveContract(contract)}
                      className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-700"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop View - Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {contracts.map(contract => {
              const expiryStatus = getContractExpiryStatus(contract.expiryDate);
              const tenant = tenants.find(t => t.id === contract.tenantId);
              return (
                <tr key={contract.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{contract.tenantName}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{contract.propertyAddress}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{contract.term}</td>
                  <td className="px-6 py-4 whitespace-nowrap">RM{contract.rentalPerMonth}/month</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getExpiryBadgeClass(expiryStatus.status)}`}>
                      {expiryStatus.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap space-x-2">
                    <button
                      onClick={() => handleViewContract(contract)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View PDF
                    </button>
                    <button
                      onClick={() => handleEditContract(contract)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      Edit
                    </button>
                    {expiryStatus.status === 'expiring_soon' && tenant && (
                      <button
                        onClick={() => handleSendExpiryReminder(contract, tenant)}
                        className="text-yellow-600 hover:text-yellow-900"
                      >
                        Send Reminder
                      </button>
                    )}
                    {(expiryStatus.status === 'expired' || contract.renewed) && !contract.archived && (
                      <button
                        onClick={() => handleArchiveContract(contract)}
                        className="text-gray-500 hover:text-gray-900"
                      >
                        Archive
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderContractForm = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit Contract' : 'Create New Contract'}
        </h2>
        <button
          onClick={() => setView('list')}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Back to List
        </button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Tenant</label>
        <select
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={selectedTenant?.id || ''}
          onChange={e => {
            const tenant = tenants.find(t => t.id === e.target.value);
            if (tenant) handleTenantSelect(tenant);
          }}
        >
          <option value="">-- Select a tenant --</option>
          {tenants.map(tenant => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.fullName} ({tenant.unitNumber})
            </option>
          ))}
        </select>
      </div>

      {selectedTenant && (
        <form className="space-y-4 bg-white p-4 rounded-lg shadow" onSubmit={handlePreview}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600">Tenant Name</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                value={selectedTenant.fullName}
                onChange={e => setSelectedTenant({ ...selectedTenant, fullName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">NRIC/Passport</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                value={selectedTenant.idNumber}
                onChange={e => setSelectedTenant({ ...selectedTenant, idNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Phone</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                value={selectedTenant.phoneNumber}
                onChange={e => setSelectedTenant({ ...selectedTenant, phoneNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Email</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                value={selectedTenant.email}
                onChange={e => setSelectedTenant({ ...selectedTenant, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Unit Number</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                value={selectedTenant.unitNumber}
                onChange={e => setSelectedTenant({ ...selectedTenant, unitNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Rental Type</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                value={selectedTenant.rentalType}
                onChange={e => setSelectedTenant({ ...selectedTenant, rentalType: e.target.value as any })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-gray-600">Property Address</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                name="propertyAddress"
                value={fields.propertyAddress}
                onChange={handleFieldChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Term</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                name="term"
                value={fields.term}
                onChange={handleFieldChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Move-in Date</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                name="moveInDate"
                value={fields.moveInDate}
                onChange={handleFieldChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Expiry Date</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                name="expiryDate"
                value={fields.expiryDate}
                onChange={handleFieldChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Rental per Month</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                name="rentalPerMonth"
                value={fields.rentalPerMonth}
                onChange={handleFieldChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Security Deposit</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                name="securityDeposit"
                value={fields.securityDeposit}
                onChange={handleFieldChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Utility Deposit</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                name="utilityDeposit"
                value={fields.utilityDeposit}
                onChange={handleFieldChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Access Card Deposit</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                name="accessCardDeposit"
                value={fields.accessCardDeposit}
                onChange={handleFieldChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Agreement Fee</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                name="agreementFee"
                value={fields.agreementFee}
                onChange={handleFieldChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Date of Agreement</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                name="dateOfAgreement"
                value={fields.dateOfAgreement}
                onChange={handleFieldChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Company Signatory Name</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                name="companySignName"
                value={fields.companySignName}
                onChange={handleFieldChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Company Signatory NRIC</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                name="companySignNRIC"
                value={fields.companySignNRIC}
                onChange={handleFieldChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Company Signatory Designation</label>
              <input
                className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1"
                name="companySignDesignation"
                value={fields.companySignDesignation}
                onChange={handleFieldChange}
              />
            </div>
          </div>
          <div className="flex space-x-2 mt-4">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700" disabled={pushingToTenant}>
              {pushingToTenant ? 'Creating...' : (isEditing ? 'Update Contract' : 'Create Contract')}
            </button>
          </div>
        </form>
      )}

      {showPreview && (
        <div className="mt-8 bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Contract Preview</h3>
          <pre className="whitespace-pre-wrap text-sm text-gray-800 mb-4" style={{fontFamily:'inherit'}}>
            {`SUB-TENANCY AGREEMENT\n\nDate: ${fields.dateOfAgreement}\n\nBETWEEN:\nCompany: GREEN BRIDGE REALTY SDN. BHD\nCompany No: 202301042822 (1536738-K)\n\nAND\nTenant: ${selectedTenant?.fullName}\nPassport/NRIC: ${selectedTenant?.idNumber}\n\nDescription of said premises: ${fields.propertyAddress}\n\n1. AGREEMENT TO LET...`}
          </pre>
          <div className="flex space-x-2 mb-4">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              type="button"
            >
              Download PDF
            </button>
            <button
              onClick={handleCreateContract}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              disabled={pushingToTenant}
              type="button"
            >
              {pushingToTenant ? 'Creating...' : (isEditing ? 'Update Contract' : 'Create Contract')}
            </button>
            <button
              onClick={() => setShowPreview(false)}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              type="button"
            >
              Edit
            </button>
            {selectedTenant && selectedContract && selectedContract.contractUrl && (
              <button
                onClick={() => window.open(selectedContract.contractUrl, '_blank')}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                type="button"
              >
                View as Tenant
              </button>
            )}
          </div>
          <div className="mb-4 text-xs text-gray-500">
            Creating will make this contract visible to the tenant in their contract page.
          </div>
        </div>
      )}

      <label className="block mt-4">
        <span className="text-gray-700 font-medium">Tenant ID Image</span>
        <input type="file" accept="image/*" onChange={e => setTenantIdImage(e.target.files?.[0] || null)} className="mt-1 w-full" />
        {tenantIdImage && <span className="text-xs text-green-600">{tenantIdImage.name}</span>}
      </label>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-0 max-w-7xl mx-auto">
      {view === 'list' ? renderContractList() : renderContractForm()}
      
      {selectedContract?.previousContractId && (
        <div className="mt-4">
          <h4 className="font-semibold">Version History</h4>
          <ul className="list-disc ml-6">
            <li>
              {(() => {
                const prev = contracts.find(c => c.id === selectedContract.previousContractId) || archivedContracts.find(c => c.id === selectedContract.previousContractId);
                return prev ? (
                  <a href="#" onClick={() => handleViewContract(prev)} className="text-blue-600 underline">Previous Version</a>
                ) : (
                  <span className="text-gray-400">Previous Version (not found)</span>
                );
              })()}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
} 