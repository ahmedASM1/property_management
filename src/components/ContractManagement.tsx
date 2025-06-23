import React, { useState, useEffect } from 'react';
import { FileText, Users, Edit3, Eye, Download, ArrowLeft, Plus, Menu, X } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { sendContractNotification } from '../utils/emailNotifications';
import ContractWizard from './ContractWizard';

// Mock data for demonstration
const mockTenants = [
  {
    id: '1',
    fullName: 'John Doe',
    email: 'john@example.com',
    phoneNumber: '+60123456789',
    idNumber: 'A12345678',
    unitNumber: 'A-33A-4',
    rentalType: 'Room',
    rentAmount: 1200
  },
  {
    id: '2',
    fullName: 'Jane Smith',
    email: 'jane@example.com',
    phoneNumber: '+60987654321',
    idNumber: 'B87654321',
    unitNumber: 'B-15C-2',
    rentalType: 'Studio',
    rentAmount: 1500
  }
];

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

// Types
interface Tenant {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  idNumber: string;
  unitNumber: string;
  rentalType: string;
  rentAmount: number;
}

interface Contract {
  id: string;
  tenantId: string;
  tenantName: string;
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
  status: 'pending' | 'signed' | 'rejected';
  signedContractUrl?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ContractManagement() {
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  // Contract management state
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'preview'>('list');
  const [tenants] = useState<Tenant[]>(mockTenants);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [contractFields, setContractFields] = useState<typeof initialContractFields>(initialContractFields);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [wizardKey, setWizardKey] = useState(0);

  // Drawer open/close helpers
  const openDrawer = () => {
    setDrawerVisible(true);
    setTimeout(() => setDrawerOpen(true), 10);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setDrawerVisible(false), 300);
  };
  const closeDrawerInstant = () => {
    setDrawerOpen(false);
    setDrawerVisible(false);
  };

  // Load contracts from Firestore on component mount
  useEffect(() => {
    fetchContracts();
  }, []);

  // Fetch contracts from Firestore
  const fetchContracts = async () => {
    const querySnapshot = await getDocs(collection(db, 'contracts'));
    const contractsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setContracts(contractsData as Contract[]);
  };

  const handleTenantSelect = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setContractFields({
      ...initialContractFields,
      rentalPerMonth: tenant.rentAmount ? String(tenant.rentAmount) : '',
    });
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContractFields({ ...contractFields, [e.target.name]: e.target.value });
  };

  const handleCreateContract = async (contractData: any) => {
    if (!selectedTenant) {
      alert('Please select a tenant first');
      return;
    }
    const newContract = {
      tenantId: selectedTenant.id,
      tenantName: selectedTenant.fullName,
      ...contractData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      let contractId;
      if (editingContract) {
        // Update existing contract
        const contractRef = doc(db, 'contracts', editingContract.id);
        await updateDoc(contractRef, newContract);
        contractId = editingContract.id;
      } else {
        // Create new contract
        const docRef = await addDoc(collection(db, 'contracts'), newContract);
        contractId = docRef.id;
      }
      
      // Send email notification
      await sendContractNotification('created', contractId, selectedTenant.id);
      
      // Fetch contracts again after creation
      fetchContracts();
      setContractFields(initialContractFields);
      setSelectedTenant(null);
      setEditingContract(null);
      setView('list');
      setWizardKey(prev => prev + 1);
    } catch (error: unknown) {
      alert('Failed to save contract: ' + (error as Error).message);
    }
  };

  const handleEditContract = (contract: Contract) => {
    const tenant = tenants.find(t => t.id === contract.tenantId) || null;
    setSelectedTenant(tenant);
    setContractFields({
      propertyAddress: contract.propertyAddress || '',
      term: contract.term || '',
      moveInDate: contract.moveInDate || '',
      expiryDate: contract.expiryDate || '',
      rentalPerMonth: contract.rentalPerMonth || '',
      securityDeposit: contract.securityDeposit || '',
      utilityDeposit: contract.utilityDeposit || '',
      accessCardDeposit: contract.accessCardDeposit || '',
      agreementFee: contract.agreementFee || '',
      dateOfAgreement: contract.dateOfAgreement || '',
      companySignName: contract.companySignName || 'ALWAELI MOHAMMED',
      companySignNRIC: contract.companySignNRIC || '09308729',
      companySignDesignation: contract.companySignDesignation || 'Managing Director',
    });
    setEditingContract(contract);
    setView('create');
  };

  const handleDeleteContract = async (contractId: string) => {
    if (confirm('Are you sure you want to delete this contract?')) {
      try {
        await deleteDoc(doc(db, 'contracts', contractId));
        fetchContracts();
      } catch (error: unknown) {
        alert('Failed to delete contract: ' + (error as Error).message);
      }
    }
  };

  const handleContractSigning = async (contractId: string, signedFile: File) => {
    try {
      // Upload the signed contract to Firebase Storage
      const storageRef = ref(storage, `signed-contracts/${contractId}`);
      await uploadBytes(storageRef, signedFile);
      const downloadUrl = await getDownloadURL(storageRef);

      // Update the contract in Firestore
      const contractRef = doc(db, 'contracts', contractId);
      await updateDoc(contractRef, {
        status: 'signed',
        signedContractUrl: downloadUrl,
        signedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Send email notification
      const contractDoc = await getDoc(contractRef);
      const contract = contractDoc.data();
      if (contract) {
        await sendContractNotification('signed', contractId, contract.tenantId);
      }

      // Refresh the contracts list
      fetchContracts();
    } catch (error: unknown) {
      alert('Failed to upload signed contract: ' + (error as Error).message);
    }
  };

  const exportContractAsPDF = async (contract: Contract) => {
    try {
      const doc = new jsPDF();
      
      // Add company logo (if you have one)
      // doc.addImage(logo, 'PNG', 20, 20, 40, 20);
      
      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('SUB-TENANCY AGREEMENT', 105, 30, { align: 'center' });
      
      // Date
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${contract.dateOfAgreement}`, 20, 45);
      
      // Parties
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('BETWEEN:', 20, 60);
      
      // Company Details
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Company: GREEN BRIDGE REALTY SDN. BHD', 20, 70);
      doc.text('Company No: 202301042822 (1536738-K)', 20, 77);
      doc.text('Company Address: 3-38, Kompleks Kantonmen Prima, 698,', 20, 84);
      doc.text('Jalan Sultan Azlan Shah, Batu 4½, Jalan Ipoh,', 20, 91);
      doc.text('51200 Kuala Lumpur, W.P. Kuala Lumpur, Malaysia', 20, 98);
      doc.text('Company Tel: 011-23583397', 20, 105);
      doc.text('Company Email: myroom8685@gmail.com', 20, 112);
      
      // Tenant Details
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('AND', 20, 125);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tenant: ${contract.tenantName}`, 20, 135);
      doc.text(`Passport/NRIC: ${contract.tenantId}`, 20, 142);
      
      // Contract Details
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('TENANCY DETAILS:', 20, 155);
      
      // Create a table for contract details
      const contractDetails = [
        ['Property Address', contract.propertyAddress],
        ['Term', contract.term],
        ['Move-in Date', contract.moveInDate],
        ['Expiry Date', contract.expiryDate],
        ['Rental per Month', `RM ${isNaN(Number(contract.rentalPerMonth)) ? '0.00' : Number(contract.rentalPerMonth).toFixed(2)}`],
        ['Security Deposit', `RM ${isNaN(Number(contract.securityDeposit)) ? '0.00' : Number(contract.securityDeposit).toFixed(2)}`],
        ['Utility Deposit', `RM ${isNaN(Number(contract.utilityDeposit)) ? '0.00' : Number(contract.utilityDeposit).toFixed(2)}`],
        ['Access Card Deposit', `RM ${isNaN(Number(contract.accessCardDeposit)) ? '0.00' : Number(contract.accessCardDeposit).toFixed(2)}`],
        ['Agreement Fee', `RM ${isNaN(Number(contract.agreementFee)) ? '0.00' : Number(contract.agreementFee).toFixed(2)}`]
      ];
      
      (doc as any).autoTable({
        startY: 165,
        head: [['Item', 'Details']],
        body: contractDetails,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 5 }
      });
      
      // Terms and Conditions
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('TERMS AND CONDITIONS:', 20, (doc as any).lastAutoTable.finalY + 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const terms = [
        '1. AGREEMENT TO LET',
        '1.1 The Company agrees to sub-let the premises to the Tenant, and the Tenant agrees to accept the sub-tenancy for the term and rental price as stated.',
        '',
        '2. DEPOSITS',
        '2.1 Upon execution of this agreement, the Tenant shall pay the Company the required deposits (security and utility) as stated, which act as security for compliance with the agreement.',
        '2.2 The deposits are refundable without interest within 14 days after the end of the tenancy term.',
        '2.3 The Tenant may not use the deposits to offset rental payments.',
        '',
        '3. TENANT\'S COVENANT',
        '(a) Pay rental in advance as per agreement.',
        '(b) Promptly pay for and settle all utilities.',
        '(c) Not transfer, assign, sub-let, or share occupation of the premises without the Company\'s written consent.',
        '(d) Not use the premises for any illegal, unlawful, or immoral purposes or cause nuisance to neighbors.',
        '',
        '4. TERMINATION OF TENANCY',
        '4.1 The Company may terminate the agreement with 7 days\' notice if the Tenant fails to comply with any terms.'
      ];
      
      terms.forEach((term, index) => {
        doc.text(term, 20, (doc as any).lastAutoTable.finalY + 30 + (index * 5));
      });
      
      // Signatures
      const signatureY = (doc as any).lastAutoTable.finalY + 30 + (terms.length * 5) + 20;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('SIGNATURES', 20, signatureY);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Company Representative:', 20, signatureY + 15);
      doc.text(`Name: ${contract.companySignName}`, 20, signatureY + 22);
      doc.text(`NRIC: ${contract.companySignNRIC}`, 20, signatureY + 29);
      doc.text(`Designation: ${contract.companySignDesignation}`, 20, signatureY + 36);
      
      doc.text('Tenant:', 120, signatureY + 15);
      doc.text(`Name: ${contract.tenantName}`, 120, signatureY + 22);
      doc.text(`NRIC: ${contract.tenantId}`, 120, signatureY + 29);
      doc.text(`Date: ${contract.dateOfAgreement}`, 120, signatureY + 36);
      
      // Save the PDF
      doc.save(`contract-${contract.id}.pdf`);
    } catch (error) {
      alert('Failed to export contract: ' + (error as Error).message);
    }
  };

  const generateContractPreview = () => {
    if (!selectedTenant) return '';
    return `SUB-TENANCY AGREEMENT\n\nDate: ${contractFields.dateOfAgreement}\n\nBETWEEN:\nCompany: GREEN BRIDGE REALTY SDN. BHD\nCompany No: 202301042822 (1536738-K)\nCompany Address: 3-38, Kompleks Kantonmen Prima, 698, Jalan Sultan Azlan Shah, \nBatu 4½, Jalan Ipoh, 51200 Kuala Lumpur, W.P. Kuala Lumpur, Malaysia\nCompany Tel: 011-23583397 | Company Email: myroom8685@gmail.com\n\nAND\nTenant: ${selectedTenant.fullName}\nPassport/NRIC: ${selectedTenant.idNumber}\nPhone: ${selectedTenant.phoneNumber}\nEmail: ${selectedTenant.email}\n\nDescription of said premises: ${contractFields.propertyAddress}\n\nTENANCY DETAILS:\nTerm: ${contractFields.term}\nMove-in Date: ${contractFields.moveInDate}\nExpiry Date: ${contractFields.expiryDate}\nRental per Month: RM ${isNaN(Number(contractFields.rentalPerMonth)) ? '0.00' : Number(contractFields.rentalPerMonth).toFixed(2)}\nSecurity Deposit: RM ${isNaN(Number(contractFields.securityDeposit)) ? '0.00' : Number(contractFields.securityDeposit).toFixed(2)}\nUtility Deposit: RM ${isNaN(Number(contractFields.utilityDeposit)) ? '0.00' : Number(contractFields.utilityDeposit).toFixed(2)}\nAccess Card Deposit: RM ${isNaN(Number(contractFields.accessCardDeposit)) ? '0.00' : Number(contractFields.accessCardDeposit).toFixed(2)}\nAgreement Fee: RM ${isNaN(Number(contractFields.agreementFee)) ? '0.00' : Number(contractFields.agreementFee).toFixed(2)}\n\nCOMPANY SIGNATORY:\nName: ${contractFields.companySignName}\nNRIC: ${contractFields.companySignNRIC}\nDesignation: ${contractFields.companySignDesignation}\n\n1. AGREEMENT TO LET\n1.1 The Company agrees to sub-let the premises to the Tenant, and the Tenant agrees to accept the sub-tenancy for the term and rental price as stated.\n\n2. DEPOSITS\n2.1 Upon execution of this agreement, the Tenant shall pay the Company the required deposits (security and utility) as stated, which act as security for compliance with the agreement.\n2.2 The deposits are refundable without interest within 14 days after the end of the tenancy term.\n2.3 The Tenant may not use the deposits to offset rental payments.\n\n3. TENANT'S COVENANT\n(a) Pay rental in advance as per agreement.\n(b) Promptly pay for and settle all utilities.\n(c) Not transfer, assign, sub-let, or share occupation of the premises without the Company's written consent.\n(d) Not use the premises for any illegal, unlawful, or immoral purposes or cause nuisance to neighbors.\n\n4. TERMINATION OF TENANCY\n4.1 The Company may terminate the agreement with 7 days' notice if the Tenant fails to comply with any terms.\n\nGENERAL HOUSE RULES\n- No smoking in the property or premises\n- Keep the room and common areas clean and safe\n- No nailing or drilling allowed\n- Lock doors and secure personal items when leaving\n- Tenant is responsible for any damages to furniture\n- Access card replacement: RM 150\n- Quiet hours: Weekdays 11:00 PM – 8:00 AM, Weekends 11:00 PM – 11:00 AM\n- No pets allowed\n\nSIGNATURES\nCompany Representative: ____________________\nName: ${contractFields.companySignName}\nNRIC: ${contractFields.companySignNRIC}\nDesignation: ${contractFields.companySignDesignation}\n\nTenant: ____________________\nName: ${selectedTenant.fullName}\nNRIC: ${selectedTenant.idNumber}\nDate: ${contractFields.dateOfAgreement}`;
  };

  // --- Render functions ---
  const renderContractList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FileText className="h-8 w-8 text-indigo-600" />
          Contract Management
        </h1>
        <button
          onClick={() => {
            setView('create');
            setSelectedTenant(null);
            setContractFields(initialContractFields);
            setEditingContract(null);
          }}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors"
        >
          + Create New Contract
        </button>
      </div>
      {/* Desktop/tablet: Table view */}
      <div className="hidden sm:block overflow-x-auto rounded-lg shadow bg-white">
        <table className="min-w-[700px] divide-y divide-gray-200 text-sm md:text-base">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Tenant</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Term</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Rent</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Move-in</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Expiry</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Created</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {contracts.map(contract => (
              <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-4 whitespace-nowrap font-semibold text-gray-900">{contract.tenantName}</td>
                <td className="px-3 py-4 whitespace-nowrap text-gray-700">{contract.term || <span className='text-gray-400'>Not set</span>}</td>
                <td className="px-3 py-4 whitespace-nowrap text-gray-700">RM {isNaN(Number(contract.rentalPerMonth)) ? '0.00' : Number(contract.rentalPerMonth).toFixed(2)}/month</td>
                <td className="px-3 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    contract.status === 'signed' 
                      ? 'bg-green-100 text-green-800'
                      : contract.status === 'rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {contract.status}
                  </span>
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-gray-700">{contract.moveInDate || <span className='text-gray-400'>Not set</span>}</td>
                <td className="px-3 py-4 whitespace-nowrap text-gray-700">{contract.expiryDate || <span className='text-gray-400'>Not set</span>}</td>
                <td className="px-3 py-4 whitespace-nowrap text-gray-700">{new Date(contract.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-4 whitespace-nowrap flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <button
                    onClick={() => {
                      setEditingContract(contract);
                      setSelectedTenant(tenants.find(t => t.id === contract.tenantId) || null);
                      setContractFields({
                        propertyAddress: contract.propertyAddress || '',
                        term: contract.term || '',
                        moveInDate: contract.moveInDate || '',
                        expiryDate: contract.expiryDate || '',
                        rentalPerMonth: contract.rentalPerMonth || '',
                        securityDeposit: contract.securityDeposit || '',
                        utilityDeposit: contract.utilityDeposit || '',
                        accessCardDeposit: contract.accessCardDeposit || '',
                        agreementFee: contract.agreementFee || '',
                        dateOfAgreement: contract.dateOfAgreement || '',
                        companySignName: contract.companySignName || 'ALWAELI MOHAMMED',
                        companySignNRIC: contract.companySignNRIC || '09308729',
                        companySignDesignation: contract.companySignDesignation || 'Managing Director',
                      });
                      setView('preview');
                    }}
                    className="flex items-center gap-1 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50"
                  >
                    <Eye className="h-4 w-4" /> View
                  </button>
                  <button
                    onClick={() => handleEditContract(contract)}
                    className="flex items-center gap-1 px-4 py-2 border border-gray-400 text-gray-700 rounded-lg font-semibold hover:bg-gray-100"
                  >
                    <Edit3 className="h-4 w-4" /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteContract(contract.id)}
                    className="flex items-center gap-1 px-4 py-2 border border-red-500 text-red-600 rounded-lg font-semibold hover:bg-red-50"
                  >
                    Delete
                  </button>
                  {contract.status === 'signed' && contract.signedContractUrl && (
                    <a
                      href={contract.signedContractUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-4 py-2 border border-green-600 text-green-600 rounded-lg font-semibold hover:bg-green-50"
                    >
                      <Eye className="h-4 w-4" /> View Signed
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile: Card view */}
      <div className="sm:hidden mt-6 space-y-4">
        {contracts.map(contract => (
          <div key={contract.id} className="bg-white rounded-lg shadow p-4 flex flex-col space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg text-gray-900">{contract.tenantName}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                contract.status === 'signed' 
                  ? 'bg-green-100 text-green-800'
                  : contract.status === 'rejected'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {contract.status}
              </span>
            </div>
            <div className="text-sm text-gray-700">Term: {contract.term || <span className='text-gray-400'>Not set</span>}</div>
            <div className="text-sm text-gray-700">Rent: RM {isNaN(Number(contract.rentalPerMonth)) ? '0.00' : Number(contract.rentalPerMonth).toFixed(2)}/month</div>
            <div className="text-sm text-gray-700">Move-in: {contract.moveInDate || <span className='text-gray-400'>Not set</span>}</div>
            <div className="text-sm text-gray-700">Expiry: {contract.expiryDate || <span className='text-gray-400'>Not set</span>}</div>
            <div className="text-sm text-gray-700">Security Deposit: RM {isNaN(Number(contract.securityDeposit)) ? '0.00' : Number(contract.securityDeposit).toFixed(2)}</div>
            <div className="text-sm text-gray-700">Created: {new Date(contract.createdAt).toLocaleDateString()}</div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  setEditingContract(contract);
                  setSelectedTenant(tenants.find(t => t.id === contract.tenantId) || null);
                  setContractFields({
                    propertyAddress: contract.propertyAddress || '',
                    term: contract.term || '',
                    moveInDate: contract.moveInDate || '',
                    expiryDate: contract.expiryDate || '',
                    rentalPerMonth: contract.rentalPerMonth || '',
                    securityDeposit: contract.securityDeposit || '',
                    utilityDeposit: contract.utilityDeposit || '',
                    accessCardDeposit: contract.accessCardDeposit || '',
                    agreementFee: contract.agreementFee || '',
                    dateOfAgreement: contract.dateOfAgreement || '',
                    companySignName: contract.companySignName || 'ALWAELI MOHAMMED',
                    companySignNRIC: contract.companySignNRIC || '09308729',
                    companySignDesignation: contract.companySignDesignation || 'Managing Director',
                  });
                  setView('preview');
                }}
                className="flex-1 flex items-center justify-center gap-1 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50"
              >
                <Eye className="h-4 w-4" /> View
              </button>
              <button
                onClick={() => handleEditContract(contract)}
                className="flex-1 flex items-center justify-center gap-1 px-4 py-2 border border-gray-400 text-gray-700 rounded-lg font-semibold hover:bg-gray-100"
              >
                <Edit3 className="h-4 w-4" /> Edit
              </button>
              <button
                onClick={() => handleDeleteContract(contract.id)}
                className="flex-1 flex items-center justify-center gap-1 px-4 py-2 border border-red-500 text-red-600 rounded-lg font-semibold hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderContractForm = () => (
    <div className="max-w-3xl mx-auto">
      <ContractWizard
        key={wizardKey}
        tenants={mockTenants.map(t => ({ id: t.id, name: t.fullName }))}
        onSubmit={handleCreateContract}
      />
    </div>
  );

  const renderContractPreview = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setView(editingContract ? 'list' : 'create')}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Contract Preview</h1>
      </div>
      <div className="bg-white border rounded-lg p-8">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-bold">Contract Preview</h2>
          <div className="flex gap-3">
            {!editingContract && (
              <button
                onClick={() => setView('create')}
                className="flex items-center gap-2 px-4 py-2 text-indigo-600 border border-indigo-600 rounded hover:bg-indigo-50"
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </button>
            )}
            <button
              onClick={() => handleCreateContract(contractFields)}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              {editingContract ? 'Update Contract' : 'Create Contract'}
            </button>
          </div>
        </div>
        <div className="border rounded-lg p-6 bg-gray-50 max-h-96 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 font-mono">
            {generateContractPreview()}
          </pre>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Hamburger for mobile */}
      <div className="md:hidden flex items-center mb-4">
        <button onClick={openDrawer} className="p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Open menu">
          <Menu className="h-6 w-6 text-gray-700" />
        </button>
        <span className="ml-3 text-xl font-bold text-gray-900">Contract Management</span>
      </div>
      {/* Side drawer for mobile */}
      {drawerVisible && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div className="fixed inset-0 bg-black bg-opacity-40 transition-opacity" onClick={closeDrawer} aria-label="Close menu overlay" />
          {/* Drawer */}
          <nav className={`relative bg-white w-64 max-w-[80vw] h-full shadow-lg flex flex-col p-6 z-50 ${drawerOpen ? 'animate-slide-in-left' : 'animate-slide-out-left'}`}>
            <button
              className="absolute top-4 right-4 p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onClick={closeDrawer}
              aria-label="Close menu"
            >
              <X className="h-6 w-6 text-gray-700" />
            </button>
            <div className="flex flex-col gap-2 mt-10">
              <button onClick={() => { setView('list'); closeDrawerInstant(); }} className="text-left px-4 py-2 rounded hover:bg-gray-100 font-medium">All Contracts</button>
              <button onClick={() => { setView('create'); closeDrawerInstant(); }} className="text-left px-4 py-2 rounded hover:bg-gray-100 font-medium">Create Contract</button>
              <button onClick={() => { /* Add dashboard navigation here */ closeDrawerInstant(); }} className="text-left px-4 py-2 rounded hover:bg-gray-100 font-medium">Back to Dashboard</button>
            </div>
          </nav>
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        {/* Desktop header */}
        <div className="hidden md:flex items-center mb-4">
          <FileText className="h-8 w-8 text-indigo-600 mr-3" />
          <span className="text-3xl font-bold text-gray-900">Contract Management</span>
        </div>
        {/* Main content */}
        {view === 'list' && renderContractList()}
        {view === 'create' && renderContractForm()}
        {view === 'preview' && renderContractPreview()}
      </div>
    </div>
  );
} 