import React, { useState, useEffect } from 'react';
import { FileText, Download, Upload, Eye } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import jsPDF from 'jspdf';

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
  tenantIdImageUrl?: string;
}

interface TenantContractViewProps {
  tenantId: string;
}

export default function TenantContractView({ tenantId }: TenantContractViewProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchContracts();
  }, [tenantId]);

  const fetchContracts = async () => {
    try {
      const q = query(
        collection(db, 'contracts'),
        where('tenantId', '==', tenantId)
      );
      const querySnapshot = await getDocs(q);
      const contractsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Contract[];
      setContracts(contractsData);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSignedContract = async (contractId: string) => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    try {
      // Upload the signed contract to Firebase Storage
      const storageRef = ref(storage, `signed-contracts/${contractId}`);
      await uploadBytes(storageRef, selectedFile);
      const downloadUrl = await getDownloadURL(storageRef);

      // Update the contract in Firestore
      const contractRef = doc(db, 'contracts', contractId);
      await updateDoc(contractRef, {
        status: 'signed',
        signedContractUrl: downloadUrl,
        signedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Refresh the contracts list
      fetchContracts();
      setSelectedFile(null);
    } catch (error) {
      alert('Failed to upload signed contract: ' + (error as Error).message);
    }
  };

  const exportContractAsPDF = async (contract: Contract) => {
    try {
      const doc = new jsPDF();
      
      // Add contract content
      doc.setFontSize(16);
      doc.text('SUB-TENANCY AGREEMENT', 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Date: ${contract.dateOfAgreement}`, 20, 30);
      doc.text('BETWEEN:', 20, 40);
      doc.text('Company: GREEN BRIDGE REALTY SDN. BHD', 20, 50);
      doc.text(`Tenant: ${contract.tenantName}`, 20, 60);
      
      // Add more contract details...
      
      // Save the PDF
      doc.save(`contract-${contract.id}.pdf`);
    } catch (error) {
      alert('Failed to export contract: ' + (error as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center mb-6">
          <FileText className="h-8 w-8 text-indigo-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">My Contracts</h1>
        </div>

        {contracts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-600">No contracts found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {contracts.map(contract => (
              <div key={contract.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Contract Details</h2>
                    <p className="text-sm text-gray-600">Created: {new Date(contract.createdAt).toLocaleDateString()}</p>
                  </div>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Property Address</p>
                    <p className="text-gray-900">{contract.propertyAddress}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Term</p>
                    <p className="text-gray-900">{contract.term}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Move-in Date</p>
                    <p className="text-gray-900">{contract.moveInDate}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Expiry Date</p>
                    <p className="text-gray-900">{contract.expiryDate}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Monthly Rent</p>
                    <p className="text-gray-900">RM {contract.rentalPerMonth}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Security Deposit</p>
                    <p className="text-gray-900">RM {contract.securityDeposit}</p>
                  </div>
                </div>

                {/* Status Progress Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">Status Progress</span>
                    <span className="text-xs font-semibold text-primary">{contract.status === 'pending' ? 'Awaiting Signature' : contract.status === 'signed' ? 'Active' : 'Expired'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`flex-1 h-2 rounded-full ${contract.status === 'pending' ? 'bg-yellow-400' : contract.status === 'signed' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className={`flex-1 h-2 rounded-full ${contract.status === 'signed' ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                    <div className={`flex-1 h-2 rounded-full ${contract.status === 'rejected' ? 'bg-red-500' : 'bg-gray-200'}`}></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Awaiting Signature</span>
                    <span>Active</span>
                    <span>Expired</span>
                  </div>
                </div>

                {/* E-Signature Placeholder */}
                {contract.status === 'pending' && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg flex flex-col gap-2 mb-4">
                    <span className="font-semibold text-yellow-800">E-Signature Required</span>
                    <span className="text-sm text-yellow-700">Please download, sign, and upload your contract to activate it.</span>
                    <div className="flex items-center gap-4 mt-2">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        className="hidden"
                        id={`file-upload-${contract.id}`}
                      />
                      <label
                        htmlFor={`file-upload-${contract.id}`}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-400 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 cursor-pointer"
                      >
                        <Upload className="h-4 w-4" /> Choose File
                      </label>
                      {selectedFile && (
                        <button
                          onClick={() => handleUploadSignedContract(contract.id)}
                          className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark"
                        >
                          Upload Signed Contract
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => exportContractAsPDF(contract)}
                    className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50"
                  >
                    <Download className="h-4 w-4" /> Download Contract
                  </button>

                  {contract.status === 'signed' && contract.signedContractUrl && (
                    <a
                      href={contract.signedContractUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-600 rounded-lg font-semibold hover:bg-green-50"
                    >
                      <Eye className="h-4 w-4" /> View Signed Contract
                    </a>
                  )}
                </div>

                {/* Tenant ID Image */}
                {contract.tenantIdImageUrl && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Tenant ID Image</h3>
                    <img src={contract.tenantIdImageUrl} alt="Tenant ID" className="max-w-xs rounded shadow border" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 