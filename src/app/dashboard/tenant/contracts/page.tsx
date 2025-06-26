'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { getContractExpiryStatus, getExpiryBadgeClass } from '@/lib/utils';
import SignaturePad from 'react-signature-canvas';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

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
  const storage = getStorage();

  useEffect(() => {
    async function fetchContracts() {
      if (!user?.id) return;
      
      try {
        const q = query(
          collection(db, 'contracts'),
          where('tenantId', '==', user.id),
          where('status', '==', 'active'),
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
      // Upload signature to Firebase Storage
      const fileName = `signatures/${user.id}_${signingContractId}_${Date.now()}.png`;
      const storageRef = ref(storage, fileName);
      await uploadString(storageRef, signatureData.replace(/^data:image\/png;base64,/, ''), 'base64', { contentType: 'image/png' });
      const signatureUrl = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'contracts', signingContractId), {
        acknowledged: true,
        acknowledgedAt: serverTimestamp(),
        signatureUrl,
      });
      setContracts(contracts.map(contract =>
        contract.id === signingContractId
          ? { ...contract, acknowledged: true, acknowledgedAt: new Date(), signatureUrl }
          : contract
      ));
      toast.success('Contract acknowledged with signature');
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
    <div className="px-2 sm:px-0 max-w-7xl mx-auto">
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
                    {contract.acknowledged ? (
                      <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                        Acknowledged
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
                      {contract.acknowledged ? (
                        <span className="block px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                          Acknowledged
                        </span>
                      ) : (
                        <span className="block px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap space-x-2">
                      {!contract.acknowledged && (
                        <button
                          onClick={() => handleAcknowledge(contract.id)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => handleViewContract(contract.contractUrl)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {showSignatureModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
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