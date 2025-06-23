'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import jsPDF from 'jspdf';

export default function TenantContractPage() {
  const auth = useAuth();
  const user = auth?.user;
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    async function fetchContract() {
      if (!user) return;
      setLoading(true);
      const q = query(collection(db, 'contracts'), where('tenantId', '==', user.id), where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setContract({ id: doc.id, ...doc.data() });
        // Fetch comments
        const commentsQ = query(
          collection(db, 'contracts', doc.id, 'comments'),
          orderBy('timestamp', 'asc')
        );
        const commentsSnap = await getDocs(commentsQ);
        setComments(commentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setContract(null);
      }
      setLoading(false);
    }
    fetchContract();
  }, [user]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !contract) return;
    setCommentLoading(true);
    await addDoc(collection(db, 'contracts', contract.id, 'comments'), {
      author: 'tenant',
      message: newComment,
      timestamp: serverTimestamp(),
    });
    // Refresh comments
    const commentsQ = query(
      collection(db, 'contracts', contract.id, 'comments'),
      orderBy('timestamp', 'asc')
    );
    const commentsSnap = await getDocs(commentsQ);
    setComments(commentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setNewComment('');
    setCommentLoading(false);
  };

  const handleExportPDF = () => {
    if (!contract) return;
    const docPDF = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 40;
    docPDF.setFontSize(20);
    docPDF.setFont('helvetica', 'bold');
    docPDF.text('Active Tenancy Contract', 40, y);
    y += 30;
    docPDF.setFontSize(12);
    docPDF.setFont('helvetica', 'normal');
    docPDF.text(`Tenant: ${user?.fullName || ''}`, 40, y); y += 18;
    docPDF.text(`Property: ${contract.propertyAddress}`, 40, y); y += 18;
    docPDF.text(`Term: ${contract.term}`, 40, y); y += 18;
    docPDF.text(`Move-in Date: ${new Date(contract.moveInDate).toLocaleDateString()}`, 40, y); y += 18;
    docPDF.text(`Expiry Date: ${new Date(contract.expiryDate).toLocaleDateString()}`, 40, y); y += 18;
    docPDF.text(`Rental per Month: RM${contract.rentalPerMonth}`, 40, y); y += 18;
    docPDF.text(`Security Deposit: RM${contract.securityDeposit}`, 40, y); y += 18;
    docPDF.text(`Utility Deposit: RM${contract.utilityDeposit}`, 40, y); y += 18;
    docPDF.text(`Access Card Deposit: RM${contract.accessCardDeposit}`, 40, y); y += 18;
    docPDF.text(`Agreement Fee: RM${contract.agreementFee}`, 40, y); y += 24;
    docPDF.text(`Date of Agreement: ${contract.dateOfAgreement}`, 40, y); y += 18;
    docPDF.text(`Company: GREEN BRIDGE REALTY SDN. BHD.`, 40, y); y += 18;
    docPDF.text(`Company No: 202301042822 (1536738-K)`, 40, y); y += 18;
    docPDF.text(`Company Address: 3-38, Kompleks Kantonmen Prima, 698, Jalan Sultan Azlan Shah, Batu 4½, Jalan Ipoh, 51200 Kuala Lumpur, W.P. Kuala Lumpur, Malaysia`, 40, y, { maxWidth: 500 }); y += 36;
    docPDF.text(`Company Tel: 011-23583397 | Company Email: myroom8685@gmail.com`, 40, y); y += 18;
    docPDF.save(`Contract_${user?.fullName || ''}_${contract.dateOfAgreement}.pdf`);
  };

  // Sign contract handler
  const handleSignContract = async () => {
    if (!contract) return;
    setSigning(true);
    await updateDoc(doc(db, 'contracts', contract.id), {
      acknowledged: true,
      acknowledgedAt: new Date(),
    });
    setContract({ ...contract, acknowledged: true, acknowledgedAt: new Date() });
    setSigning(false);
  };

  // Resend contract handler
  const handleResend = async () => {
    if (!contract) return;
    setResent(true);
    await updateDoc(doc(db, 'contracts', contract.id), {
      resent: true,
      resentAt: new Date(),
    });
    setTimeout(() => setResent(false), 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-indigo-50 flex flex-col items-center py-8 px-2">
      <div className="w-full max-w-2xl bg-white shadow-lg rounded-xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <svg className={`h-8 w-8 ${contract ? 'text-green-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <span className={`text-xl font-bold ${contract ? 'text-green-700' : 'text-gray-400'}`}>{contract ? 'Contract Available' : 'No Contract Yet'}</span>
          </div>
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline font-medium">Back to Dashboard</Link>
        </div>

        {!contract ? (
          <div className="text-gray-500 py-12 text-center">No active contract available.</div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600">Contract ID:</div>
                <div className="font-mono text-green-700 text-lg">{contract.id.slice(-6).toUpperCase()}</div>
              </div>
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Active</span>
            </div>

            {/* Contract Details */}
            <div className="mb-8 bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">Contract Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Property Address</div>
                  <div className="font-medium">{contract.propertyAddress}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Term</div>
                  <div className="font-medium">{contract.term}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Move-in Date</div>
                  <div className="font-medium">{new Date(contract.moveInDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Expiry Date</div>
                  <div className="font-medium">{new Date(contract.expiryDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Rental per Month</div>
                  <div className="font-medium">RM {contract.rentalPerMonth}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Security Deposit</div>
                  <div className="font-medium">RM {contract.securityDeposit}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Utility Deposit</div>
                  <div className="font-medium">RM {contract.utilityDeposit}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Access Card Deposit</div>
                  <div className="font-medium">RM {contract.accessCardDeposit}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Agreement Fee</div>
                  <div className="font-medium">RM {contract.agreementFee}</div>
                </div>
              </div>
            </div>

            {/* Signature Section */}
            <div className="mt-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
              {!contract.acknowledged ? (
                <button
                  onClick={handleSignContract}
                  disabled={signing}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700 disabled:opacity-50"
                >
                  {signing ? 'Signing...' : 'Sign Contract'}
                </button>
              ) : (
                <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full font-semibold text-sm">Signed</span>
              )}
              {contract.acknowledged && (
                <button
                  onClick={handleResend}
                  disabled={resent}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow hover:bg-blue-700 disabled:opacity-50"
                >
                  {resent ? 'Resending...' : 'Resend to Admin'}
                </button>
              )}
            </div>

            {/* Comments Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">Comments & Change Requests</h3>
              <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                {comments.map(comment => (
                  <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{comment.author === 'tenant' ? 'You' : 'Admin'}</span>
                      <span className="text-xs text-gray-500">
                        {comment.timestamp?.toDate?.().toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm">{comment.message}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type your comment or request..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleAddComment}
                  disabled={commentLoading || !newComment.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {commentLoading ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium shadow"
              >
                Export as PDF
              </button>
              {contract.contractUrl && (
                <a
                  href={contract.contractUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium shadow"
                >
                  Download PDF
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
} 