'use client';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Invoice, Tenant } from '@/types';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import Image from 'next/image';
import { sendInvoiceEmail } from '@/lib/email';
import Link from 'next/link';
import { FaArrowLeft, FaUpload, FaFileImage } from 'react-icons/fa';

export default function InvoiceDetailPage() {
  const auth = useAuth();
  const user = auth?.user;
  const router = useRouter();
  const params = useParams();
  const { id: invoiceId } = params;
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!invoiceId || !user) {
      if (!user && typeof window !== 'undefined') router.push('/login');
      return;
    };
    async function fetchInvoice() {
      try {
        const invoiceDoc = await getDoc(doc(db, 'invoices', String(invoiceId)));
        if (invoiceDoc.exists()) {
          const invoiceData = {
            id: invoiceDoc.id,
            ...invoiceDoc.data()
          } as Invoice;

          // Check if user has access to this invoice
          if (user?.role === 'tenant' && invoiceData.tenantId !== user.id) {
            router.push('/dashboard/invoices');
            return;
          }

          // Fetch tenant details
          const tenantDoc = await getDoc(doc(db, 'users', invoiceData.tenantId));
          if (tenantDoc.exists()) {
            const tenantData = tenantDoc.data() as Tenant;
            invoiceData.tenantDetails = {
              fullName: tenantData.fullName,
              phoneNumber: tenantData.phoneNumber || '',
              unitNumber: tenantData.unitNumber,
              rentalType: tenantData.rentalType
            };
          }

          setInvoice(invoiceData);
        } else {
          router.push('/dashboard/invoices');
        }
      } catch (error) {
        console.error('Error fetching invoice:', error);
        toast.error('Failed to load invoice');
      } finally {
        setLoading(false);
      }
    }

    fetchInvoice();
  }, [invoiceId, user, router]);

  const handleRequestStatusChange = async (newStatus: string) => {
    if (!invoice || !user) return;
    setIsRequesting(true);
    const toastId = toast.loading('Sending request...');
    try {
      const tenantName = invoice.tenantDetails?.fullName || user.fullName || 'A tenant';
      
      await updateDoc(doc(db, 'invoices', invoice.id), {
        statusChangeRequest: {
          requestedStatus: newStatus,
          tenantName: tenantName,
          requestedAt: serverTimestamp(),
        },
      });
      
      await addDoc(collection(db, "notifications"), {
        role: 'admin',
        message: `${tenantName} requested to change invoice #${invoice.id.substring(0, 6)} status to "${newStatus}".`,
        link: `/dashboard/invoices#${invoice.id}`,
        createdAt: serverTimestamp(),
        read: false,
      });

      setInvoice(prev => prev ? { ...prev, statusChangeRequest: { requestedStatus: newStatus } } as Invoice : null);
      toast.success('Status change request sent to admin.', { id: toastId });
    } catch (error) {
      console.error("Failed to send request", error);
      toast.error('Failed to send request.', { id: toastId });
    } finally {
      setIsRequesting(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!invoice) return;

    try {
      await updateDoc(doc(db, 'invoices', invoice.id), {
        isPaid: true,
        receiptStatus: 'approved',
        updatedAt: new Date()
      });

      setInvoice(prev => prev ? {
        ...prev,
        isPaid: true,
        receiptStatus: 'approved'
      } : null);

      // Fetch tenant email and name (if not already in invoice)
      let tenantEmail = '';
      let tenantName = '';
      try {
        const userDoc = await getDoc(doc(db, 'users', invoice.tenantId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          tenantEmail = userData.email;
          tenantName = userData.fullName;
        }
      } catch (error) { 
        console.error('Error fetching user data:', error);
      }
      if (tenantEmail && tenantName) {
        sendInvoiceEmail(tenantEmail, tenantName, invoice.id)
          .then(() => toast.success('Tenant notified by email'))
          .catch(() => toast.error('Failed to send email notification'));
      }

      toast.success('Invoice marked as paid');
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      toast.error('Failed to update invoice status');
    }
  };

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !invoice || user?.role !== 'tenant' || invoice.tenantId !== user?.id) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload an image (JPEG, PNG, WebP) or PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB.');
      return;
    }
    setUploadingReceipt(true);
    const toastId = toast.loading('Uploading receipt...');
    try {
      const storageRef = ref(storage, `receipts/${invoice.id}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const now = new Date().toISOString();
      const originalFileName = file.name;
      await updateDoc(doc(db, 'invoices', invoice.id), {
        receiptUrl: url,
        receiptStatus: 'pending_review',
        receiptUploadedAt: now,
        receiptFileName: originalFileName,
        updatedAt: new Date()
      });
      setInvoice(prev => prev ? { ...prev, receiptUrl: url, receiptStatus: 'pending_review', receiptUploadedAt: now, receiptFileName: originalFileName } : null);
      await addDoc(collection(db, 'notifications'), {
        role: 'admin',
        message: `${invoice.tenantDetails?.fullName || 'A tenant'} uploaded payment proof for invoice #${invoice.id.substring(0, 8)}. Please verify.`,
        link: `/dashboard/invoices/${invoice.id}`,
        createdAt: serverTimestamp(),
        read: false,
      });
      toast.success('Receipt uploaded. Admin will verify and update status.', { id: toastId });
      if (receiptInputRef.current) receiptInputRef.current.value = '';
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload receipt.', { id: toastId });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleAdminRejectReceipt = async () => {
    if (!invoice) return;
    try {
      await updateDoc(doc(db, 'invoices', invoice.id), {
        receiptStatus: 'rejected',
        updatedAt: new Date()
      });
      setInvoice(prev => prev ? { ...prev, receiptStatus: 'rejected' } : null);
      toast.success('Receipt rejected. Tenant can upload a new one.');
    } catch (err) {
      console.error('Reject error:', err);
      toast.error('Failed to update.');
    }
  };

  // PDF Export Handler
  const handleExportPDF = () => {
    if (!invoice) return;
    const docToPdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const leftMargin = 40;
    const rightMargin = 555;
    let y = 40;

    // Add logo (PNG)
    const logoImg = new window.Image();
    logoImg.src = '/Green Bridge.svg';
    logoImg.onload = () => {
      // Company Header - More compact
      docToPdf.addImage(logoImg, 'PNG', leftMargin, y, 50, 50);
      docToPdf.setFontSize(16);
      docToPdf.setFont('helvetica', 'bold');
      docToPdf.text('GREEN BRIDGE REALTY SDN. BHD.', leftMargin + 60, y + 15);
      docToPdf.setFontSize(10);
      docToPdf.setFont('helvetica', 'normal');
      docToPdf.text('3-38, Kompleks Kantonmen Prima, 698, Jalan Sultan Azlan Shah, Batu 4½, Jalan Ipoh, 51200 Kuala Lumpur, W.P. Kuala Lumpur, Malaysia', leftMargin + 60, y + 30);
      docToPdf.text('Tel: 011-23583397 | Email: info@greenbridge-my.com', leftMargin + 60, y + 45);
      y += 80;
      
      // Invoice Title
      docToPdf.setFontSize(20);
      docToPdf.setFont('helvetica', 'bold');
      docToPdf.text('INVOICE', leftMargin, y);
      y += 30;
      
      // Invoice Details
      docToPdf.setFontSize(12);
      docToPdf.setFont('helvetica', 'normal');
      docToPdf.text(`Invoice #: ${invoice.id.substring(0, 8).toUpperCase()}`, leftMargin, y); y += 20;
      docToPdf.text(`Date: ${safeDate(invoice.createdAt)}`, leftMargin, y); y += 20;
      docToPdf.text(`Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}`, leftMargin, y); y += 30;

      // Tenant Information
      docToPdf.setFontSize(14);
      docToPdf.setFont('helvetica', 'bold');
      docToPdf.text('Bill To:', leftMargin, y);
      y += 20;
      docToPdf.setFontSize(12);
      docToPdf.setFont('helvetica', 'normal');
      docToPdf.text(invoice.tenantDetails?.fullName || 'Tenant', leftMargin, y); y += 15;
      docToPdf.text(`Unit: ${invoice.tenantDetails?.unitNumber || invoice.unitNumber || 'N/A'}`, leftMargin, y); y += 15;
      docToPdf.text(`Phone: ${invoice.tenantDetails?.phoneNumber || 'N/A'}`, leftMargin, y); y += 30;

      // Line Items Table
      docToPdf.setFontSize(12);
      docToPdf.setFont('helvetica', 'bold');
      docToPdf.text('Description', leftMargin, y);
      docToPdf.text('Amount (RM)', rightMargin - 80, y);
      y += 20;
      docToPdf.setLineWidth(1);
      docToPdf.line(leftMargin, y, rightMargin, y);
      y += 20;

      // Add line items
      docToPdf.setFont('helvetica', 'normal');
      invoice.lineItems.forEach(item => {
        docToPdf.text(item.description, leftMargin, y);
        docToPdf.text(item.amount.toFixed(2), rightMargin - 80, y);
        y += 15;
      });

      // Add utilities if present
      if (invoice.utilities) {
        if (invoice.utilities.water) {
          docToPdf.text('Water Bill', leftMargin, y);
          docToPdf.text(invoice.utilities.water.toFixed(2), rightMargin - 80, y);
          y += 15;
        }
        if (invoice.utilities.electricity) {
          docToPdf.text('Electricity Bill', leftMargin, y);
          docToPdf.text(invoice.utilities.electricity.toFixed(2), rightMargin - 80, y);
          y += 15;
        }
        if (invoice.utilities.internet) {
          docToPdf.text('Internet Bill', leftMargin, y);
          docToPdf.text(invoice.utilities.internet.toFixed(2), rightMargin - 80, y);
          y += 15;
        }
        if (invoice.utilities.other) {
          docToPdf.text('Other Utilities', leftMargin, y);
          docToPdf.text(invoice.utilities.other.toFixed(2), rightMargin - 80, y);
          y += 15;
        }
      }

      y += 10;
      docToPdf.setLineWidth(1);
      docToPdf.line(leftMargin, y, rightMargin, y);
      y += 20;

      // Totals
      docToPdf.setFont('helvetica', 'bold');
      docToPdf.text('Subtotal:', leftMargin, y);
      docToPdf.text(invoice.subtotal.toFixed(2), rightMargin - 80, y);
      y += 15;
      docToPdf.text('Tax:', leftMargin, y);
      docToPdf.text(invoice.tax.toFixed(2), rightMargin - 80, y);
      y += 15;
      docToPdf.setFontSize(14);
      docToPdf.text('Total:', leftMargin, y);
      docToPdf.text(invoice.totalAmount.toFixed(2), rightMargin - 80, y);
      y += 30;

      // Payment Instructions
      docToPdf.setFontSize(12);
      docToPdf.setFont('helvetica', 'bold');
      docToPdf.text('Payment Instructions:', leftMargin, y);
      y += 20;
      docToPdf.setFont('helvetica', 'normal');
      docToPdf.text('Please make payment to:', leftMargin, y);
      y += 15;
      docToPdf.text('Bank: Maybank', leftMargin, y);
      y += 15;
      docToPdf.text('Account: 1234-5678-9012', leftMargin, y);
      y += 15;
      docToPdf.text('Account Name: GREEN BRIDGE REALTY SDN. BHD.', leftMargin, y);
      y += 15;
      docToPdf.text('Reference: Invoice #' + invoice.id.substring(0, 8).toUpperCase(), leftMargin, y);

      docToPdf.save(`Invoice_${invoice.id.substring(0, 8)}.pdf`);
    };
  };

  // Helper for safe date formatting
  function safeDate(date: unknown): string {
    if (!date) return 'N/A';
    let dateObj: Date;
    if (typeof date === 'object' && date !== null && 'toDate' in date) {
      dateObj = (date as { toDate(): Date }).toDate();
    } else if (typeof date === 'object' && date !== null && 'seconds' in date) {
      dateObj = new Date((date as { seconds: number }).seconds * 1000);
    } else {
      dateObj = new Date(date as string | number | Date);
    }
    return dateObj.toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Invoice Not Found</h2>
        <p className="text-gray-600 mb-6">The invoice you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.</p>
        <Link href="/dashboard/invoices" className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
          <FaArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Link>
      </div>
    );
  }

  // Use dynamic line items if available
  const items = (invoice.lineItems && Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0)
    ? invoice.lineItems.map(item => ({ description: item.description, quantity: 1, unitPrice: item.amount || 0 }))
    : [
        { description: 'Rent', quantity: 1, unitPrice: invoice.rentAmount || 0 },
        { description: 'Water', quantity: 1, unitPrice: invoice.utilities?.water || 0 },
        { description: 'Electricity', quantity: 1, unitPrice: invoice.utilities?.electricity || 0 },
        { description: 'Internet', quantity: 1, unitPrice: invoice.utilities?.internet || 0 },
        ...(invoice.utilities?.other ? [{ description: 'Other', quantity: 1, unitPrice: invoice.utilities.other }] : [])
      ].filter(item => item.unitPrice > 0);
  const subtotal = items.reduce((sum: number, item: { unitPrice: number; quantity: number; }) => sum + (item.unitPrice * item.quantity), 0);
  const tax = invoice.tax || 0;
  const total = subtotal + tax;

  return (
    <div className="max-w-2xl mx-auto my-8">
      <div className="mb-4">
        <Link href="/dashboard/invoices" className="flex items-center text-gray-500 hover:text-gray-700 gap-2">
          <FaArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Link>
      </div>
      <div className="bg-white shadow-lg rounded-lg p-8 border border-gray-200">
        {/* Logo and Header - More compact */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <Image src="/Green Bridge.svg" alt="Green Bridge Logo" width={50} height={50} className="object-contain" />
            <div>
              <div className="text-xl font-bold text-green-900">GREEN BRIDGE REALTY SDN. BHD.</div>
              <div className="text-xs text-gray-600 mt-1">
                3-38, Kompleks Kantonmen Prima, 698, Jalan Sultan Azlan Shah,<br />
                Batu 4½, Jalan Ipoh, 51200 Kuala Lumpur
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-900">INVOICE</div>
            <div className="text-sm text-gray-600 mt-1">#{invoice.id}</div>
            <div className="text-sm text-gray-600">Date: {safeDate(invoice.createdAt)}</div>
          </div>
        </div>

        {/* Bill To Section */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm font-semibold text-gray-700 mb-2">BILL TO:</div>
          {invoice.tenantDetails ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="font-medium text-gray-900">{invoice.tenantDetails.fullName}</div>
                <div className="text-gray-600">Unit: {invoice.tenantDetails.unitNumber}</div>
                <div className="text-gray-600">Type: {invoice.tenantDetails.rentalType || 'Not specified'}</div>
                <div className="text-gray-600">Phone: {invoice.tenantDetails.phoneNumber}</div>
              </div>
              <div className="text-right">
                <div className="font-medium text-gray-900">Due Date:</div>
                <div className="text-gray-600">{safeDate(invoice.dueDate)}</div>
                <div className="font-medium text-gray-900 mt-2">Status:</div>
                <div className={invoice.isPaid ? 'text-green-600' : 'text-red-600'}>
                  {invoice.isPaid ? 'Paid' : 'Unpaid'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-600">Loading tenant details...</div>
          )}
        </div>

        {/* Invoice Table */}
        <table className="w-full text-sm mb-6 border border-gray-300 rounded overflow-hidden">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-3 text-left">Item</th>
              <th className="py-2 px-3 text-center">Qty</th>
              <th className="py-2 px-3 text-right">Unit Price</th>
              <th className="py-2 px-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.description + idx} className="border-t border-gray-200">
                <td className="py-2 px-3">{item.description}</td>
                <td className="py-2 px-3 text-center">{item.quantity}</td>
                <td className="py-2 px-3 text-right">RM{item.unitPrice.toFixed(2)}</td>
                <td className="py-2 px-3 text-right">RM{(item.quantity * item.unitPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-2 px-3 text-right font-semibold">Subtotal:</td>
              <td className="py-2 px-3 text-right">RM{subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="py-2 px-3 text-right font-semibold">Tax (0%):</td>
              <td className="py-2 px-3 text-right">RM{tax.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="py-2 px-3 text-right font-bold">Total:</td>
              <td className="py-2 px-3 text-right font-bold">RM{total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        {/* Status and Receipt */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="text-sm">
            <span className="font-semibold">Status:</span>{' '}
            <span className={
              invoice.isPaid ? 'text-green-600' :
              invoice.receiptStatus === 'pending_review' ? 'text-amber-600' : 'text-red-600'
            }>
              {invoice.isPaid ? 'Paid' : invoice.receiptStatus === 'pending_review' ? 'Pending review (proof uploaded)' : 'Unpaid'}
            </span>
          </div>
          <div className="text-sm">
            <span className="font-semibold">Due Date:</span>{' '}
            {safeDate(invoice.dueDate)}
          </div>
          <div className="text-sm">
            <span className="font-semibold">Issued Date:</span>{' '}
            {safeDate(invoice.createdAt)}
          </div>
          {invoice.receiptUrl && (
            <div className="text-sm flex flex-wrap items-center gap-2">
              <span className="font-semibold">Payment proof:</span>
              <a href={invoice.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">View</a>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(invoice.receiptUrl!);
                    const blob = await res.blob();
                    const name = invoice.receiptFileName?.replace(/^.*[/\\]/, '') || `receipt-${invoice.id}`;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = name;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    window.open(invoice.receiptUrl!, '_blank');
                  }
                }}
                className="text-blue-700 underline bg-transparent border-none cursor-pointer p-0"
              >
                Download{invoice.receiptFileName ? ` (${invoice.receiptFileName})` : ''}
              </button>
            </div>
          )}
        </div>
        {/* Admin: Verify receipt or Mark as Paid */}
        {user?.role === 'admin' && !invoice.isPaid && (
          <div className="mb-4 flex flex-wrap gap-3">
            {invoice.receiptUrl && invoice.receiptStatus === 'pending_review' && (
              <>
                <button
                  onClick={handleMarkAsPaid}
                  className="px-4 py-2 bg-green-700 text-white rounded shadow hover:bg-green-800 font-semibold"
                >
                  Approve & mark as paid
                </button>
                <button
                  onClick={handleAdminRejectReceipt}
                  className="px-4 py-2 bg-red-600 text-white rounded shadow hover:bg-red-700 font-semibold"
                >
                  Reject receipt
                </button>
              </>
            )}
            {(!invoice.receiptUrl || invoice.receiptStatus !== 'pending_review') && (
              <button
                onClick={handleMarkAsPaid}
                className="px-4 py-2 bg-green-700 text-white rounded shadow hover:bg-green-800 font-semibold"
              >
                Mark as Paid
              </button>
            )}
          </div>
        )}
        {/* Export as PDF Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleExportPDF}
            className="px-6 py-2 bg-green-700 text-white rounded shadow hover:bg-green-800 font-semibold"
          >
            Export as PDF
          </button>
        </div>
        {user?.role === 'tenant' && !invoice.isPaid && (
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Payment proof</h3>
            <p className="text-sm text-gray-600 mb-4">
              After paying rent, upload a photo or file of your receipt so the admin can verify and update the status.
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleUploadReceipt}
                disabled={uploadingReceipt}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => receiptInputRef.current?.click()}
                disabled={uploadingReceipt}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <FaUpload className="h-4 w-4" />
                {uploadingReceipt ? 'Uploading...' : (invoice.receiptStatus === 'rejected' ? 'Upload new receipt' : 'Upload receipt / image')}
              </button>
              {invoice.receiptStatus === 'pending_review' && (
                <span className="text-amber-600 text-sm flex items-center gap-1">
                  <FaFileImage className="h-4 w-4" />
                  Pending admin verification
                </span>
              )}
              {invoice.receiptStatus === 'rejected' && (
                <span className="text-red-600 text-sm">Receipt was rejected. You can upload a new one above.</span>
              )}
            </div>
            {invoice.statusChangeRequest ? (
              <div className="text-center p-4 bg-blue-100 text-blue-800 rounded-lg mt-4">
                <p className="font-semibold">Request Pending</p>
                <p className="text-sm">Your request to change the status to &quot;{invoice.statusChangeRequest.requestedStatus}&quot; is awaiting admin approval.</p>
              </div>
            ) : (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Or request status change</h4>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => handleRequestStatusChange('paid')} 
                    disabled={isRequesting}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 text-sm"
                  >
                    Request mark as paid
                  </button>
                  <button 
                    onClick={() => handleRequestStatusChange('queried')} 
                    disabled={isRequesting}
                    className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 text-sm"
                  >
                    Query Invoice
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 