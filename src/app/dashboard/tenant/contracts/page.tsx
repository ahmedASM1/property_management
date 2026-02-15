'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { getContractExpiryStatus, getExpiryBadgeClass } from '@/lib/utils';
import SignaturePad from 'react-signature-canvas';
import { getStorage, ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Contract {
  id: string;
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
  acknowledged: boolean;
  acknowledgedAt?: string | Date;
  createdAt: string | Date;
  signatureUrl?: string;
  status?: string;
  tenantName?: string;
  tenantUploadedContractUrl?: string;
  tenantUploadedAt?: string | Date;
  tenantUploadedContractFileName?: string;
}

export default function TenantContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const auth = useAuth();
  const user = auth?.user;
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signingContractId, setSigningContractId] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [sigPad, setSigPad] = useState<SignaturePad | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingContractId, setUploadingContractId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const storage = getStorage();

  useEffect(() => {
    async function fetchContracts() {
      if (!user?.id) return;
      
      try {
        const q = query(
          collection(db, 'contracts'),
          where('tenantId', '==', user.id),
          where('status', 'in', ['pending', 'signed', 'active']),
          orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const contractsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Contract[];
        
        setContracts(contractsData);
      } catch (_error) {
        console.error('Error fetching contracts:', _error);
        toast.error('Failed to load contracts');
      } finally {
        setLoading(false);
      }
    }

    fetchContracts();
  }, [user?.id]);

  const handleAcknowledge = async (contractId: string) => {
    setSigningContractId(contractId);
    setShowSignatureModal(true);
  };

  const handleSignatureSubmit = async () => {
    if (!signatureData || !signingContractId || !user?.id) return;
    try {
      const fileName = `signatures/${user.id}_${signingContractId}_${Date.now()}.png`;
      const storageRef = ref(storage, fileName);
      await uploadString(storageRef, signatureData.replace(/^data:image\/png;base64,/, ''), 'base64', { contentType: 'image/png' });
      const signatureUrl = await getDownloadURL(storageRef);
      const contractToSign = contracts.find(c => c.id === signingContractId);
      await updateDoc(doc(db, 'contracts', signingContractId), {
        acknowledged: true,
        acknowledgedAt: serverTimestamp(),
        signatureUrl,
        status: 'signed',
        updatedAt: new Date().toISOString(),
      });
      setContracts(contracts.map(contract =>
        contract.id === signingContractId
          ? { ...contract, acknowledged: true, acknowledgedAt: new Date(), signatureUrl, status: 'signed' }
          : contract
      ));
      await addDoc(collection(db, 'notifications'), {
        role: 'admin',
        message: `${user.fullName || 'A tenant'} has signed the contract${contractToSign?.propertyAddress ? ` for ${contractToSign.propertyAddress}` : ''}. Please verify.`,
        link: `/dashboard/contracts/${signingContractId}`,
        createdAt: serverTimestamp(),
        read: false,
      });
      toast.success('Contract signed. Admin has been notified to verify.');
    } catch {
      toast.error('Failed to acknowledge contract');
    } finally {
      setShowSignatureModal(false);
      setSigningContractId(null);
      setSignatureData(null);
    }
  };

  const handleViewContract = (contractUrl: string) => {
    window.open(contractUrl, '_blank');
  };

  const handleDownloadContract = async (contract: Contract) => {
    try {
      const res = await fetch(contract.contractUrl);
      const blob = await res.blob();
      const filename = `contract-${(contract.propertyAddress || contract.id).replace(/[^a-z0-9-_]/gi, '-').slice(0, 40)}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Contract downloaded.');
    } catch (e) {
      console.error(e);
      window.open(contract.contractUrl, '_blank');
      toast.success('Opening contract in new tab.');
    }
  };

  const openUploadModal = (contractId: string) => {
    setUploadingContractId(contractId);
    setUploadFile(null);
    setShowUploadModal(true);
  };

  const handleUploadSignedContract = async () => {
    if (!uploadingContractId || !uploadFile || !user?.id) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(uploadFile.type)) {
      toast.error('Please upload a PDF or image (JPEG, PNG, WebP).');
      return;
    }
    if (uploadFile.size > 15 * 1024 * 1024) {
      toast.error('File must be under 15MB.');
      return;
    }
    setUploading(true);
    try {
      const ext = uploadFile.name.split('.').pop() || 'pdf';
      const fileName = `signed_contracts/${uploadingContractId}_${user.id}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, uploadFile);
      const downloadUrl = await getDownloadURL(storageRef);
      const contractToUpdate = contracts.find(c => c.id === uploadingContractId);
      const originalFileName = uploadFile.name;
      await updateDoc(doc(db, 'contracts', uploadingContractId), {
        tenantUploadedContractUrl: downloadUrl,
        tenantUploadedAt: new Date().toISOString(),
        tenantUploadedContractFileName: originalFileName,
        status: 'signed',
        updatedAt: new Date().toISOString(),
      });
      setContracts(contracts.map(c =>
        c.id === uploadingContractId
          ? { ...c, tenantUploadedContractUrl: downloadUrl, tenantUploadedAt: new Date().toISOString(), tenantUploadedContractFileName: originalFileName, status: 'signed' }
          : c
      ));
      await addDoc(collection(db, 'notifications'), {
        role: 'admin',
        message: `${user.fullName || 'A tenant'} has uploaded a signed contract${contractToUpdate?.propertyAddress ? ` for ${contractToUpdate.propertyAddress}` : ''}. Please review.`,
        link: `/dashboard/contracts/${uploadingContractId}`,
        createdAt: serverTimestamp(),
        read: false,
      });
      toast.success('Signed contract uploaded. Admin has been notified.');
      setShowUploadModal(false);
      setUploadingContractId(null);
      setUploadFile(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="text-center text-gray-500 mt-8">No active contract available.</div>
    );
  }

  return (
    <div className="px-2 sm:px-0 max-w-7xl mx-auto bg-gray-50 min-h-[60vh] rounded-lg">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">My Contracts</h2>
        </div>

        {/* Mobile View - Cards */}
        <div className="sm:hidden space-y-4">
          {contracts.map(contract => {
            const expiryStatus = getContractExpiryStatus(contract.expiryDate);
            return (
              <div key={contract.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-lg">Contract Details</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getExpiryBadgeClass(expiryStatus.status)}`}>
                        {expiryStatus.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Property: {contract.propertyAddress}</p>
                    <p className="text-sm text-gray-600">Term: {contract.term}</p>
                    <p className="text-sm text-gray-600">Rent: RM{contract.rentalPerMonth}/month</p>
                    <p className="text-sm text-gray-600">
                      Valid: {new Date(contract.moveInDate).toLocaleDateString()} - {new Date(contract.expiryDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {contract.acknowledged || contract.status === 'signed' ? (
                      <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                        Signed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAcknowledge(contract.id)}
                        className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => handleViewContract(contract.contractUrl)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      View PDF
                    </button>
                    <button
                      onClick={() => handleDownloadContract(contract)}
                      className="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => openUploadModal(contract.id)}
                      className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg shadow-md hover:bg-violet-700 focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
                    >
                      📤 Upload signed contract
                    </button>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contracts.map(contract => {
                const expiryStatus = getContractExpiryStatus(contract.expiryDate);
                return (
                  <tr key={contract.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{contract.propertyAddress}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{contract.term}</td>
                    <td className="px-6 py-4 whitespace-nowrap">RM{contract.rentalPerMonth}/month</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(contract.moveInDate).toLocaleDateString()} - {new Date(contract.expiryDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap space-y-1">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getExpiryBadgeClass(expiryStatus.status)}`}>
                        {expiryStatus.label}
                      </span>
                      {contract.acknowledged || contract.status === 'signed' ? (
                        <span className="block px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                          Signed
                        </span>
                      ) : (
                        <span className="block px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-2">
                        {!contract.acknowledged && contract.status !== 'signed' && (
                          <button
                            onClick={() => handleAcknowledge(contract.id)}
                            className="px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-900 border border-indigo-300 rounded-md hover:bg-indigo-50"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => handleViewContract(contract.contractUrl)}
                          className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-900 border border-blue-300 rounded-md hover:bg-blue-50"
                        >
                          View PDF
                        </button>
                        <button
                          onClick={() => handleDownloadContract(contract)}
                          className="px-3 py-1.5 text-sm text-emerald-600 hover:text-emerald-900 border border-emerald-300 rounded-md hover:bg-emerald-50"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => openUploadModal(contract.id)}
                          className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg shadow hover:bg-violet-700 focus:ring-2 focus:ring-violet-500 focus:ring-offset-1"
                        >
                          📤 Upload signed contract
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Upload signed contract modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full border border-gray-200">
              <h3 className="text-lg font-bold mb-2">Upload signed contract</h3>
              <p className="text-sm text-gray-600 mb-4">
                Export the contract PDF, fill in all required fields and sign it, then upload the file here. Admin will receive it for verification.
              </p>
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-violet-50 file:text-violet-700"
              />
              {uploadFile && (
                <p className="mt-2 text-sm text-gray-500">{uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)</p>
              )}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleUploadSignedContract}
                  disabled={!uploadFile || uploading}
                  className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Submit to admin'}
                </button>
                <button
                  onClick={() => { setShowUploadModal(false); setUploadingContractId(null); setUploadFile(null); }}
                  disabled={uploading}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showSignatureModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
              <h3 className="text-lg font-bold mb-2">Sign to Acknowledge</h3>
              <SignaturePad
                ref={setSigPad}
                canvasProps={{ width: 300, height: 120, className: 'border border-gray-300 rounded mb-2' }}
                onEnd={() => {
                  const dataUrl = sigPad?.getTrimmedCanvas().toDataURL('image/png');
                  if (dataUrl) {
                    setSignatureData(dataUrl);
                  }
                }}
              />
              <div className="flex space-x-2 mb-2">
                <button onClick={() => { sigPad?.clear(); setSignatureData(null); }} className="px-3 py-1 bg-gray-200 rounded">Clear</button>
                <button onClick={handleSignatureSubmit} className="px-3 py-1 bg-indigo-600 text-white rounded" disabled={!signatureData}>Submit</button>
                <button onClick={() => setShowSignatureModal(false)} className="px-3 py-1 bg-gray-400 text-white rounded">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 