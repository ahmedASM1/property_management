'use client';
import { useEffect, useState, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { Invoice, Tenant } from '@/types';
import { useRouter, useParams } from 'next/navigation';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import Image from 'next/image';
import { sendInvoiceEmail } from '@/lib/email';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

interface InvoiceDetailPageProps {
  params: {
    id: string;
  };
}

export default function InvoiceDetailPage({ params: initialParams }: InvoiceDetailPageProps) {
  const auth = useAuth();
  const user = auth?.user;
  const router = useRouter();
  const params = typeof window !== 'undefined' ? useParams() : initialParams;
  const { id: invoiceId } = params;
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [isRequesting, setIsRequesting] = useState(false);

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
              phoneNumber: tenantData.phoneNumber,
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !invoice) return;

    try {
      setUploading(true);

      // Upload file to Firebase Storage
      const storageRef = ref(storage, `receipts/${invoice.id}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      // Update invoice with receipt URL
      await updateDoc(doc(db, 'invoices', invoice.id), {
        receiptUrl: downloadUrl,
        updatedAt: new Date()
      });

      setInvoice(prev => prev ? {
        ...prev,
        receiptUrl: downloadUrl
      } : null);

      toast.success('Receipt uploaded successfully');
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast.error('Failed to upload receipt');
    } finally {
      setUploading(false);
    }
  };

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
        updatedAt: new Date()
      });

      setInvoice(prev => prev ? {
        ...prev,
        isPaid: true
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
      } catch (e) { /* ignore */ }
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

  // PDF Export Handler
  const handleExportPDF = () => {
    if (!invoice) return;
    const docToPdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const leftMargin = 40;
    const rightMargin = 555;
    let y = 40;

    // Add logo (PNG)
    const logoImg = new window.Image();
    logoImg.src = '/Green Bridge.png';
    logoImg.onload = () => {
      // Company Header - More compact
      docToPdf.addImage(logoImg, 'PNG', leftMargin, y, 50, 50);
      docToPdf.setFontSize(16);
      docToPdf.setFont('helvetica', 'bold');
      docToPdf.text('GREEN BRIDGE REALTY SDN. BHD.', leftMargin + 60, y + 20);
      docToPdf.setFontSize(9);
      docToPdf.setFont('helvetica', 'normal');
      docToPdf.text('3-38, Kompleks Kantonmen Prima, 698, Jalan Sultan Azlan Shah, Batu 4½, Jalan Ipoh,', leftMargin + 60, y + 32);
      docToPdf.text('51200 Kuala Lumpur, W.P. Kuala Lumpur, Malaysia', leftMargin + 60, y + 44);
      
      // Invoice Title
      docToPdf.setFontSize(24);
      docToPdf.setFont('helvetica', 'bold');
      docToPdf.text('INVOICE', rightMargin, y + 25, { align: 'right' });
      
      // Invoice Details
      docToPdf.setFontSize(10);
      docToPdf.setFont('helvetica', 'normal');
      docToPdf.text(`Invoice #: ${invoice.id}`, rightMargin, y + 45, { align: 'right' });
      docToPdf.text(`Date: ${safeDate(invoice.createdAt)}`, rightMargin, y + 57, { align: 'right' });
      
      y += 80;

      // Billing Details
      docToPdf.setFontSize(11);
      docToPdf.setFont('helvetica', 'bold');
      docToPdf.text('BILL TO:', leftMargin, y);
      docToPdf.setFont('helvetica', 'normal');
      if (invoice.tenantDetails) {
        docToPdf.text(invoice.tenantDetails.fullName, leftMargin, y + 15);
        docToPdf.text(`Unit: ${invoice.tenantDetails.unitNumber}`, leftMargin, y + 30);
        docToPdf.text(`Type: ${invoice.tenantDetails.rentalType || 'Not specified'}`, leftMargin, y + 45);
        docToPdf.text(`Phone: ${invoice.tenantDetails.phoneNumber}`, leftMargin, y + 60);
      }

      y += 90;

      // Table header with improved styling
      docToPdf.setFillColor(240, 240, 240);
      docToPdf.rect(leftMargin, y, 515, 25, 'F');
      docToPdf.setFont('helvetica', 'bold');
      docToPdf.setFontSize(10);
      docToPdf.text('Item Description', leftMargin + 10, y + 16);
      docToPdf.text('Qty', leftMargin + 280, y + 16, { align: 'center' });
      docToPdf.text('Unit Price (RM)', leftMargin + 380, y + 16, { align: 'center' });
      docToPdf.text('Amount (RM)', rightMargin - 10, y + 16, { align: 'right' });

      // Table rows
      y += 25;
      docToPdf.setFont('helvetica', 'normal');
      
      const items = (invoice.lineItems && Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0)
        ? invoice.lineItems.map(item => ({ description: item.description, quantity: 1, unitPrice: item.amount || 0 }))
        : [
            { description: 'Rent', quantity: 1, unitPrice: invoice.rentAmount || 0 },
            { description: 'Water', quantity: 1, unitPrice: invoice.utilities?.water || 0 },
            { description: 'Electricity', quantity: 1, unitPrice: invoice.utilities?.electricity || 0 },
            { description: 'Internet', quantity: 1, unitPrice: invoice.utilities?.internet || 0 },
            ...(invoice.utilities?.other ? [{ description: 'Other', quantity: 1, unitPrice: invoice.utilities.other }] : [])
          ].filter(item => item.unitPrice > 0);

      items.forEach(item => {
        if (item.unitPrice > 0) {
          docToPdf.text(item.description, leftMargin + 10, y + 15);
          docToPdf.text('1', leftMargin + 280, y + 15, { align: 'center' });
          docToPdf.text(item.unitPrice.toFixed(2), leftMargin + 380, y + 15, { align: 'center' });
          docToPdf.text(item.unitPrice.toFixed(2), rightMargin - 10, y + 15, { align: 'right' });
          y += 25;
        }
      });

      // Totals section with improved styling
      y += 10;
      const subtotal = items.reduce((sum: number, item: { unitPrice: number; quantity: number; }) => sum + (item.unitPrice * item.quantity), 0);
      const tax = 0;
      const total = subtotal + tax;

      docToPdf.setDrawColor(200, 200, 200);
      docToPdf.line(leftMargin + 250, y, rightMargin, y);
      y += 15;

      docToPdf.text('Subtotal:', leftMargin + 380, y, { align: 'right' });
      docToPdf.text(subtotal.toFixed(2), rightMargin - 10, y, { align: 'right' });
      y += 20;

      docToPdf.text('Tax (0%):', leftMargin + 380, y, { align: 'right' });
      docToPdf.text(tax.toFixed(2), rightMargin - 10, y, { align: 'right' });
      y += 20;

      docToPdf.setFont('helvetica', 'bold');
      docToPdf.text('Total:', leftMargin + 380, y, { align: 'right' });
      docToPdf.text(total.toFixed(2), rightMargin - 10, y, { align: 'right' });

      // Payment Details and Notes
      y += 50;
      docToPdf.setFont('helvetica', 'bold');
      docToPdf.text('Payment Details:', leftMargin, y);
      docToPdf.setFont('helvetica', 'normal');
      docToPdf.text('Bank: Maybank', leftMargin, y + 15);
      docToPdf.text('Account Name: GREEN BRIDGE REALTY SDN. BHD.', leftMargin, y + 30);
      docToPdf.text('Account Number: 514123456789', leftMargin, y + 45);

      // Terms and Conditions
      y += 80;
      docToPdf.setFont('helvetica', 'bold');
      docToPdf.text('Terms & Conditions:', leftMargin, y);
      docToPdf.setFont('helvetica', 'normal');
      docToPdf.setFontSize(9);
      docToPdf.text('1. Payment is due within 7 days of invoice date', leftMargin, y + 15);
      docToPdf.text('2. Please include invoice number in payment reference', leftMargin, y + 27);
      docToPdf.text('3. Late payments may incur additional charges', leftMargin, y + 39);

      // Footer
      y = 780;
      docToPdf.setFontSize(10);
      docToPdf.text('Thank you for your business!', leftMargin, y);
      
      // Signature
      docToPdf.text('Authorized Signature', rightMargin, y, { align: 'right' });
      docToPdf.line(rightMargin - 150, y + 5, rightMargin, y + 5);
      docToPdf.text('Green Bridge Realty Sdn. Bhd.', rightMargin, y + 20, { align: 'right' });

      // Save the PDF
      docToPdf.save(`Invoice-${invoice.id}.pdf`);
    };
  };

  // Admin: Start editing
  const handleEdit = () => {
    if (!invoice) return;
    setEditForm({
      month: invoice.month,
      year: invoice.year,
      rentAmount: invoice.rentAmount,
      water: invoice.utilities?.water || 0,
      electricity: invoice.utilities?.electricity || 0,
      internet: invoice.utilities?.internet || 0,
      other: invoice.utilities?.other || 0,
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : '',
    });
    setEditing(true);
  };

  // Admin: Save edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    try {
      await updateDoc(doc(db, 'invoices', invoice.id), {
        month: editForm.month,
        year: Number(editForm.year),
        rentAmount: Number(editForm.rentAmount),
        utilities: {
          water: Number(editForm.water),
          electricity: Number(editForm.electricity),
          internet: Number(editForm.internet),
          other: Number(editForm.other) || 0,
        },
        totalAmount:
          Number(editForm.rentAmount) + 
          Number(editForm.water) + 
          Number(editForm.electricity) + 
          Number(editForm.internet) + 
          (Number(editForm.other) || 0),
        dueDate: new Date(editForm.dueDate),
        updatedAt: new Date(),
      });
      toast.success('Invoice updated');
      setEditing(false);
      // Refresh invoice
      const invoiceDoc = await getDoc(doc(db, 'invoices', invoice.id));
      setInvoice(invoiceDoc.exists() ? { id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice : null);
    } catch (err) {
      toast.error('Failed to update invoice');
    }
  };

  // Helper for safe date formatting
  function safeDate(date: any) {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date.toDate ? date.toDate() : new Date(date);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!invoice) {
    return null;
  }

  // Helper for currency
  const formatCurrency = (amount: number) => `RM${Number(amount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

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
            <Image src="/Green Bridge.png" alt="Green Bridge Logo" width={50} height={50} className="object-contain" />
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
            <span className={invoice.isPaid ? 'text-green-600' : 'text-red-600'}>{invoice.isPaid ? 'Paid' : 'Unpaid'}</span>
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
            <div className="text-sm">
              <span className="font-semibold">Receipt:</span>{' '}
              <a href={invoice.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">View Receipt</a>
            </div>
          )}
        </div>
        {/* Admin: Mark as Paid */}
        {user?.role === 'admin' && !invoice.isPaid && (
          <div className="mb-4">
            <button
              onClick={handleMarkAsPaid}
              className="px-4 py-2 bg-green-700 text-white rounded shadow hover:bg-green-800 font-semibold"
            >
              Mark as Paid
            </button>
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
            {invoice.statusChangeRequest ? (
              <div className="text-center p-4 bg-blue-100 text-blue-800 rounded-lg">
                <p className="font-semibold">Request Pending</p>
                <p className="text-sm">Your request to change the status to "{invoice.statusChangeRequest.requestedStatus}" is awaiting admin approval.</p>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Request Status Change</h3>
                <p className="text-sm text-gray-600 mb-4">
                  If you have made a payment or have an issue, please notify the admin.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => handleRequestStatusChange('paid')} 
                    disabled={isRequesting} 
                    className="px-4 py-2 bg-green-600 text-white rounded-md shadow hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    Mark as Paid
                  </button>
                  <button 
                    onClick={() => handleRequestStatusChange('delayed')} 
                    disabled={isRequesting} 
                    className="px-4 py-2 bg-yellow-500 text-white rounded-md shadow hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                  >
                    Payment Delayed
                  </button>
                  <button 
                    onClick={() => handleRequestStatusChange('queried')} 
                    disabled={isRequesting} 
                    className="px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Have a Question
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