import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  FaFileInvoice, 
  FaPlus, 
  FaTrash, 
  FaPaperPlane, 
  FaCalendar,
  FaUser,
  FaEye,
  FaSave,
  FaEnvelope,
  FaCalculator,
  FaDollarSign,
  FaListAlt,
  FaArrowLeft,
  FaCheck
} from 'react-icons/fa';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const invoiceSchema = z.object({
  tenant: z.string().min(1, 'Tenant is required'),
  month: z.string().min(1, 'Month is required'),
  year: z.string().min(1, 'Year is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  lineItems: z.array(z.object({
    description: z.string().min(1, 'Description required'),
    amount: z.number().min(0.01, 'Amount required'),
  })).min(1, 'At least one line item is required'),
  tax: z.number().min(0, 'Tax must be positive'),
  status: z.enum(['paid', 'unpaid', 'overdue']),
  email: z.boolean().optional(),
  notes: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

const mockTenants = [
  { id: '1', name: 'Mohammed Alwaeli', unit: 'A-101', email: 'mohammed@email.com' },
  { id: '2', name: 'Sarah Johnson', unit: 'B-205', email: 'sarah@email.com' },
  { id: '3', name: 'David Chen', unit: 'C-301', email: 'david@email.com' },
  { id: '4', name: 'Maria Garcia', unit: 'A-102', email: 'maria@email.com' },
];

interface Tenant {
  id: string;
  name: string;
  unit?: string;
}

const INVOICE_ITEMS = [
  { value: 'rent', label: 'Monthly Rent' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'water', label: 'Water' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'internet', label: 'Internet' },
  { value: 'other', label: 'Other' }
];

interface InvoiceItem {
  type: string;
  description: string;
  amount: number;
  status?: 'paid' | 'unpaid' | 'overdue';
  tax?: number;
  notes?: string;
}

interface InvoiceWizardProps {
  tenants: Tenant[];
  onTenantSelect: (tenantId: string) => void;
  onSubmit: (data: {
    tenant: string;
    month: string;
    year: string;
    dueDate: string;
    lineItems: { description: string; amount: number }[];
    tax: number;
    status: string;
  }) => Promise<void>;
}

export default function InvoiceWizard({ tenants, onTenantSelect, onSubmit }: InvoiceWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const addItem = () => {
    setItems([...items, { 
      type: 'rent',
      description: 'Monthly Rent',
      amount: 0
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems(items.map((item, i) => {
      if (i === index) {
        if (field === 'type') {
          const predefined = INVOICE_ITEMS.find(i => i.value === value);
          return {
            ...item,
            type: value,
            description: value === 'other' ? '' : (predefined ? predefined.label : '')
          };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!selectedTenant || !month || !year || !dueDate) {
        toast.error('Please fill in all required fields');
        return;
      }
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    if (items.some(item => item.amount <= 0)) {
      toast.error('All items must have an amount greater than 0');
      return;
    }

    if (items.some(item => !item.description)) {
      toast.error('All items must have a description');
      return;
    }

    if (items.some(item => item.type === 'other' && !item.description)) {
      toast.error('Please specify description for "Other" items');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        tenant: selectedTenant,
        month,
        year,
        dueDate: dueDate?.toISOString() || '',
        lineItems: items.map(item => ({
          description: item.type === 'other' ? `${item.description}` : `${item.type}: ${item.description}`,
          amount: item.amount
        })),
        tax: 0,
        status: 'unpaid'
      });
      
      // Reset form
      setSelectedTenant('');
      setMonth('');
      setYear(new Date().getFullYear().toString());
      setDueDate(null);
      setItems([]);
      setStep(1);
    } catch (error) {
      console.error('Error submitting invoice:', error);
      toast.error('Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg">
      {/* Header Section */}
      <div className="border-b border-gray-200">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Dashboard</span>
            </button>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create New Invoice</h1>
              <p className="mt-1 text-sm text-gray-500">Generate and send invoices to tenants</p>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-center">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                  {step}
                </div>
                <div className="ml-2 text-sm text-gray-600">
                  Step {step} of 2
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 sm:p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Section */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow-sm rounded-2xl border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <FaFileInvoice className="h-5 w-5 text-blue-600 mr-2" />
                    Invoice Details
                  </h2>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Step 1: Basic Information */}
                  {step === 1 && (
                    <>
                      {/* Tenant Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <FaUser className="inline h-4 w-4 mr-1" />
                          Select Tenant
                        </label>
                        <select 
                          value={selectedTenant}
                          onChange={(e) => {
                            setSelectedTenant(e.target.value);
                            onTenantSelect(e.target.value);
                          }}
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        >
                          <option value="">Choose a tenant...</option>
                          {tenants.map(tenant => (
                            <option key={tenant.id} value={tenant.id}>
                              {tenant.name} {tenant.unit && `- Unit ${tenant.unit}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Period */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            <FaCalendar className="inline h-4 w-4 mr-1" />
                            Month
                          </label>
                          <select 
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          >
                            <option value="">Select month...</option>
                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month) => (
                              <option key={month} value={month}>
                                {month}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                          <input 
                            type="number"
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            placeholder="2025"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                          <DatePicker
                            selected={dueDate}
                            onChange={(date) => setDueDate(date)}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            dateFormat="yyyy-MM-dd"
                            placeholderText="Select due date"
                            minDate={new Date()}
                          />
                        </div>
                      </div>

                      {/* Line Items */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          <FaListAlt className="inline h-4 w-4 mr-1" />
                          Invoice Items
                        </label>
                        <div className="space-y-4">
                          {items.map((item, index) => (
                            <div key={index} className="flex items-center gap-3 p-4 border rounded-lg bg-gray-50">
                              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Item Type Selection */}
                                <select
                                  className="w-full rounded-md border border-gray-300 p-2"
                                  value={item.type}
                                  onChange={(e) => updateItem(index, 'type', e.target.value)}
                                >
                                  {INVOICE_ITEMS.map(option => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>

                                {/* Description Field - Only for "Other" type */}
                                {item.type === 'other' && (
                                  <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 p-2"
                                    placeholder="Type description here..."
                                    value={item.description}
                                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                                    autoFocus
                                  />
                                )}

                                {/* Amount Field */}
                                <div className="relative">
                                  <span className="absolute left-3 top-2 text-gray-500">RM</span>
                                  <input
                                    type="number"
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md"
                                    placeholder="0.00"
                                    value={item.amount}
                                    onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>

                              {/* Remove Button */}
                              <button
                                onClick={() => removeItem(index)}
                                className="p-2 text-red-500 hover:text-red-700 transition"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}

                          {/* Add Item Button */}
                          <button
                            type="button"
                            onClick={addItem}
                            className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:text-gray-800 hover:border-gray-400 transition flex items-center justify-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Invoice Item
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleNext}
                          disabled={!selectedTenant || !month || !year || !dueDate}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Continue to Review
                        </button>
                      </div>
                    </>
                  )}

                  {/* Step 2: Additional Details */}
                  {step === 2 && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            <FaCalculator className="inline h-4 w-4 mr-1" />
                            Tax Amount (RM)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                              RM
                            </span>
                            <input 
                              type="number" 
                              step="0.01" 
                              className="w-full pl-10 pr-3 py-2 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                          <select 
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          >
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                        <textarea 
                          className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          placeholder="Additional notes or payment instructions..."
                        />
                      </div>

                      <div className="flex items-center space-x-3">
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="text-sm text-gray-700">
                          <FaEnvelope className="inline h-4 w-4 mr-1" />
                          Email invoice to tenant automatically
                        </label>
                      </div>

                      <div className="flex justify-between">
                        <button
                          type="button"
                          onClick={handleBack}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Back
                        </button>
                        
                        <div className="flex space-x-3">
                          <button
                            type="button"
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <FaSave className="h-4 w-4 mr-2" />
                            Save as Draft
                          </button>
                          
                          <button
                            type="submit"
                            disabled={loading || items.length === 0}
                            className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed min-w-[140px]"
                          >
                            {loading ? (
                              <div className="flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Creating...
                              </div>
                            ) : (
                              <>
                                <FaPaperPlane className="h-4 w-4 mr-2" />
                                Create Invoice
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Preview Section */}
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <div className="bg-white shadow-sm rounded-2xl border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <FaEye className="h-5 w-5 text-green-600 mr-2" />
                      Live Preview
                    </h3>
                  </div>
                  
                  <div className="p-6">
                    <div className="border rounded-lg p-4 bg-gray-50">
                      {/* Invoice Header */}
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
                          <p className="text-sm text-gray-600">#{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                          items.some(item => item.status === 'paid') ? 'bg-green-100 text-green-800' :
                          items.some(item => item.status === 'overdue') ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {items.some(item => item.status === 'paid') ? 'Paid' :
                            items.some(item => item.status === 'overdue') ? 'Overdue' : 'Unpaid'}
                        </span>
                      </div>

                      {/* Invoice Details */}
                      <div className="mb-6 space-y-2">
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">To:</span>
                          <div className="text-gray-900">
                            {selectedTenant ? tenants.find(t => t.id === selectedTenant)?.name || 'Select a tenant' : 'Select a tenant'}
                            {selectedTenant && tenants.find(t => t.id === selectedTenant)?.unit && <div className="text-gray-600">Unit {tenants.find(t => t.id === selectedTenant)?.unit}</div>}
                          </div>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">Period:</span> 
                          <span className="text-gray-900 ml-1">
                            {month ? `${month} ${year}` : 'Select period'}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">Due Date:</span> 
                          <span className="text-gray-900 ml-1">
                            {dueDate ? new Date(dueDate).toLocaleDateString() : 'Set due date'}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">Date Issued:</span> 
                          <span className="text-gray-900 ml-1">{new Date().toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Line Items */}
                      <div className="border-t border-gray-200 pt-4 mb-4">
                        <div className="space-y-2">
                          {items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-700">{item.description}</span>
                              <span className="text-gray-900 font-medium">RM {item.amount.toFixed(2)}</span>
                            </div>
                          ))}
                          {(!items || items.length === 0) && (
                            <div className="text-sm text-gray-500 italic">No items added yet</div>
                          )}
                        </div>
                      </div>

                      {/* Totals */}
                      <div className="border-t border-gray-200 pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-600">Subtotal:</span>
                          <span className="text-gray-900">RM {items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-600">Tax:</span>
                          <span className="text-gray-900">RM {items.reduce((sum, item) => sum + (item.tax || 0), 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                          <span className="text-gray-900">Total:</span>
                          <span className="text-gray-900">RM {items.reduce((sum, item) => sum + item.amount + (item.tax || 0), 0).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Notes */}
                      {items.some(item => item.notes) && (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                          <p className="text-sm font-medium text-gray-600 mb-1">Notes:</p>
                          <p className="text-sm text-gray-700">{items.find(item => item.notes)?.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
export default function InvoiceWizard({ 
  tenants = mockTenants, 
  onSubmit,
  onCancel,
  rent = 0,
  onTenantSelect
}: { 
  tenants?: { id: string; name: string; unit?: string; email?: string }[]; 
  onSubmit?: (data: InvoiceFormValues) => void;
  onCancel?: () => void;
  rent?: number;
  onTenantSelect?: (tenantId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = async (data: InvoiceFormValues) => {
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(data);
      } else {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Invoice created:', data);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const methods = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      tenant: '',
      month: '',
      year: new Date().getFullYear().toString(),
      dueDate: '',
      lineItems: [{ description: 'Monthly Rent', amount: 0 }],
      tax: 0,
      status: 'unpaid',
      email: true,
      notes: '',
    },
    mode: 'onChange',
  });

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isValid } } = methods;
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const values = watch();

  // Automatically set the first line item's amount to rent when tenant changes and rent > 0
  useEffect(() => {
    if (values.tenant && rent > 0) {
      setValue('lineItems.0.amount', rent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.tenant, rent]);

  // Calculate totals
  const subtotal = values.lineItems?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;
  const taxAmount = Number(values.tax) || 0;
  const total = subtotal + taxAmount;

  const selectedTenant = tenants.find(t => t.id === values.tenant);

  // Generate next month options
  const monthOptions = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentMonth = new Date().getMonth();
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FaArrowLeft className="h-4 w-4 mr-2" />
                Back to Invoices
              </button>
              <div className="h-6 border-l border-gray-300"></div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Create New Invoice</h1>
                <p className="text-sm text-gray-500">Generate and send invoices to tenants</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                {[1, 2].map((stepNumber) => (
                  <div key={stepNumber} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step === stepNumber 
                        ? 'bg-blue-600 text-white' 
                        : step > stepNumber 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {step > stepNumber ? <FaCheck className="h-4 w-4" /> : stepNumber}
                    </div>
                    {stepNumber < 2 && (
                      <div className={`w-12 h-1 mx-2 ${
                        step > stepNumber ? 'bg-green-500' : 'bg-gray-200'
                      }`}></div>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-sm text-gray-500">
                Step {step} of 2
              </span>
            </div>
          </div>
        </div>
      </div>

      <FormProvider {...methods}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Section */}
              <div className="lg:col-span-2">
                <div className="bg-white shadow-sm rounded-2xl border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                      <FaFileInvoice className="h-5 w-5 text-blue-600 mr-2" />
                      Invoice Details
                    </h2>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    {/* Step 1: Basic Information */}
                    {step === 1 && (
                      <>
                        {/* Tenant Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            <FaUser className="inline h-4 w-4 mr-1" />
                            Select Tenant
                          </label>
                          <select 
                            {...register('tenant')}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            onChange={e => {
                              register('tenant').onChange(e);
                              if (onTenantSelect) onTenantSelect(e.target.value);
                            }}
                          >
                            <option value="">Choose a tenant...</option>
                            {tenants.map(tenant => (
                              <option key={tenant.id} value={tenant.id}>
                                {tenant.name} {tenant.unit && `- Unit ${tenant.unit}`}
                              </option>
                            ))}
                          </select>
                          {errors.tenant && (
                            <p className="mt-1 text-sm text-red-600">{errors.tenant.message}</p>
                          )}
                          {selectedTenant && (
                            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                              <div className="text-sm text-blue-800">
                                <strong>{selectedTenant.name}</strong>
                                {selectedTenant.unit && <span className="ml-2">Unit {selectedTenant.unit}</span>}
                                {selectedTenant.email && <span className="block">{selectedTenant.email}</span>}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Period */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <FaCalendar className="inline h-4 w-4 mr-1" />
                              Month
                            </label>
                            <select 
                              {...register('month')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            >
                              <option value="">Select month...</option>
                              {monthOptions.map((month) => (
                                <option key={month} value={month}>
                                  {month}
                                </option>
                              ))}
                            </select>
                            {errors.month && (
                              <p className="mt-1 text-sm text-red-600">{errors.month.message}</p>
                            )}
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                            <input 
                              {...register('year')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                              placeholder="2025"
                            />
                            {errors.year && (
                              <p className="mt-1 text-sm text-red-600">{errors.year.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                            <input 
                              type="date"
                              {...register('dueDate')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                            {errors.dueDate && (
                              <p className="mt-1 text-sm text-red-600">{errors.dueDate.message}</p>
                            )}
                          </div>
                        </div>

                        {/* Line Items */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            <FaListAlt className="inline h-4 w-4 mr-1" />
                            Invoice Items
                          </label>
                          <div className="space-y-3">
                            {fields.map((field, idx) => (
                              <div key={field.id} className="flex gap-3 items-start">
                                <div className="flex-1">
                                  <input
                                    {...register(`lineItems.${idx}.description` as const)}
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                    placeholder="Item description"
                                  />
                                  {errors.lineItems?.[idx]?.description && (
                                    <p className="mt-1 text-xs text-red-600">
                                      {errors.lineItems[idx]?.description?.message}
                                    </p>
                                  )}
                                </div>
                                <div className="w-32">
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                                      RM
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      {...register(`lineItems.${idx}.amount` as const, { valueAsNumber: true })}
                                      className="w-full pl-10 pr-3 py-2 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                      placeholder="0.00"
                                    />
                                  </div>
                                  {errors.lineItems?.[idx]?.amount && (
                                    <p className="mt-1 text-xs text-red-600">
                                      {errors.lineItems[idx]?.amount?.message}
                                    </p>
                                  )}
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => fields.length > 1 && remove(idx)}
                                  disabled={fields.length === 1}
                                  className="p-2 text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                >
                                  <FaTrash className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <button 
                              type="button" 
                              onClick={() => append({ description: '', amount: 0 })}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <FaPlus className="h-4 w-4 mr-1" />
                              Add Item
                            </button>
                          </div>
                          {errors.lineItems && (
                            <p className="mt-2 text-sm text-red-600">{errors.lineItems.message}</p>
                          )}
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setStep(2)}
                            disabled={!values.tenant || !values.month || !values.year || !values.dueDate || fields.some(f => !f.description || !f.amount)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            Continue to Review
                          </button>
                        </div>
                      </>
                    )}

                    {/* Step 2: Additional Details */}
                    {step === 2 && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <FaCalculator className="inline h-4 w-4 mr-1" />
                              Tax Amount (RM)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                                RM
                              </span>
                              <input 
                                type="number" 
                                step="0.01" 
                                {...register('tax', { valueAsNumber: true })} 
                                className="w-full pl-10 pr-3 py-2 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                placeholder="0.00"
                              />
                            </div>
                            {errors.tax && (
                              <p className="mt-1 text-sm text-red-600">{errors.tax.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                            <select 
                              {...register('status')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            >
                              <option value="unpaid">Unpaid</option>
                              <option value="paid">Paid</option>
                              <option value="overdue">Overdue</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                          <textarea 
                            {...register('notes')} 
                            rows={3}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            placeholder="Additional notes or payment instructions..."
                          />
                        </div>

                        <div className="flex items-center space-x-3">
                          <input 
                            type="checkbox" 
                            {...register('email')} 
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label className="text-sm text-gray-700">
                            <FaEnvelope className="inline h-4 w-4 mr-1" />
                            Email invoice to tenant automatically
                          </label>
                        </div>

                        <div className="flex justify-between">
                          <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Back
                          </button>
                          
                          <div className="flex space-x-3">
                            <button
                              type="button"
                              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <FaSave className="h-4 w-4 mr-2" />
                              Save as Draft
                            </button>
                            
                            <button
                              type="submit"
                              disabled={!isValid || isSubmitting}
                              className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed min-w-[140px]"
                            >
                              {isSubmitting ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Creating...
                                </div>
                              ) : (
                                <>
                                  <FaPaperPlane className="h-4 w-4 mr-2" />
                                  Create Invoice
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview Section */}
              <div className="lg:col-span-1">
                <div className="sticky top-8">
                  <div className="bg-white shadow-sm rounded-2xl border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <FaEye className="h-5 w-5 text-green-600 mr-2" />
                        Live Preview
                      </h3>
                    </div>
                    
                    <div className="p-6">
                      <div className="border rounded-lg p-4 bg-gray-50">
                        {/* Invoice Header */}
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
                            <p className="text-sm text-gray-600">#{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                          </div>
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                            values.status === 'paid' ? 'bg-green-100 text-green-800' :
                            values.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {values.status?.charAt(0).toUpperCase() + values.status?.slice(1)}
                          </span>
                        </div>

                        {/* Invoice Details */}
                        <div className="mb-6 space-y-2">
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">To:</span>
                            <div className="text-gray-900">
                              {selectedTenant?.name || 'Select a tenant'}
                              {selectedTenant?.unit && <div className="text-gray-600">Unit {selectedTenant.unit}</div>}
                            </div>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">Period:</span> 
                            <span className="text-gray-900 ml-1">
                              {values.month ? `${values.month} ${values.year}` : 'Select period'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">Due Date:</span> 
                            <span className="text-gray-900 ml-1">
                              {values.dueDate ? new Date(values.dueDate).toLocaleDateString() : 'Set due date'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">Date Issued:</span> 
                            <span className="text-gray-900 ml-1">{new Date().toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Line Items */}
                        <div className="border-t border-gray-200 pt-4 mb-4">
                          <div className="space-y-2">
                            {values.lineItems?.filter(item => item.description).map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-700">{item.description}</span>
                                <span className="text-gray-900 font-medium">RM {Number(item.amount || 0).toFixed(2)}</span>
                              </div>
                            ))}
                            {(!values.lineItems || values.lineItems.filter(item => item.description).length === 0) && (
                              <div className="text-sm text-gray-500 italic">No items added yet</div>
                            )}
                          </div>
                        </div>

                        {/* Totals */}
                        <div className="border-t border-gray-200 pt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-gray-600">Subtotal:</span>
                            <span className="text-gray-900">RM {subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-gray-600">Tax:</span>
                            <span className="text-gray-900">RM {taxAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                            <span className="text-gray-900">Total:</span>
                            <span className="text-gray-900">RM {total.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Notes */}
                        {values.notes && (
                          <div className="border-t border-gray-200 pt-4 mt-4">
                            <p className="text-sm font-medium text-gray-600 mb-1">Notes:</p>
                            <p className="text-sm text-gray-700">{values.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </FormProvider>
    </div>
  );
}
                              <span className="text-gray-900 font-medium">RM {item.amount.toFixed(2)}</span>
                            </div>
                          ))}
                          {(!items || items.length === 0) && (
                            <div className="text-sm text-gray-500 italic">No items added yet</div>
                          )}
                        </div>
                      </div>

                      {/* Totals */}
                      <div className="border-t border-gray-200 pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-600">Subtotal:</span>
                          <span className="text-gray-900">RM {items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-600">Tax:</span>
                          <span className="text-gray-900">RM {items.reduce((sum, item) => sum + (item.tax || 0), 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                          <span className="text-gray-900">Total:</span>
                          <span className="text-gray-900">RM {items.reduce((sum, item) => sum + item.amount + (item.tax || 0), 0).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Notes */}
                      {items.some(item => item.notes) && (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                          <p className="text-sm font-medium text-gray-600 mb-1">Notes:</p>
                          <p className="text-sm text-gray-700">{items.find(item => item.notes)?.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
export default function InvoiceWizard({ 
  tenants = mockTenants, 
  onSubmit,
  onCancel,
  rent = 0,
  onTenantSelect
}: { 
  tenants?: { id: string; name: string; unit?: string; email?: string }[]; 
  onSubmit?: (data: InvoiceFormValues) => void;
  onCancel?: () => void;
  rent?: number;
  onTenantSelect?: (tenantId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = async (data: InvoiceFormValues) => {
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(data);
      } else {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Invoice created:', data);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const methods = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      tenant: '',
      month: '',
      year: new Date().getFullYear().toString(),
      dueDate: '',
      lineItems: [{ description: 'Monthly Rent', amount: 0 }],
      tax: 0,
      status: 'unpaid',
      email: true,
      notes: '',
    },
    mode: 'onChange',
  });

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isValid } } = methods;
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const values = watch();

  // Automatically set the first line item's amount to rent when tenant changes and rent > 0
  useEffect(() => {
    if (values.tenant && rent > 0) {
      setValue('lineItems.0.amount', rent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.tenant, rent]);

  // Calculate totals
  const subtotal = values.lineItems?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;
  const taxAmount = Number(values.tax) || 0;
  const total = subtotal + taxAmount;

  const selectedTenant = tenants.find(t => t.id === values.tenant);

  // Generate next month options
  const monthOptions = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentMonth = new Date().getMonth();
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FaArrowLeft className="h-4 w-4 mr-2" />
                Back to Invoices
              </button>
              <div className="h-6 border-l border-gray-300"></div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Create New Invoice</h1>
                <p className="text-sm text-gray-500">Generate and send invoices to tenants</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                {[1, 2].map((stepNumber) => (
                  <div key={stepNumber} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step === stepNumber 
                        ? 'bg-blue-600 text-white' 
                        : step > stepNumber 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {step > stepNumber ? <FaCheck className="h-4 w-4" /> : stepNumber}
                    </div>
                    {stepNumber < 2 && (
                      <div className={`w-12 h-1 mx-2 ${
                        step > stepNumber ? 'bg-green-500' : 'bg-gray-200'
                      }`}></div>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-sm text-gray-500">
                Step {step} of 2
              </span>
            </div>
          </div>
        </div>
      </div>

      <FormProvider {...methods}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Section */}
              <div className="lg:col-span-2">
                <div className="bg-white shadow-sm rounded-2xl border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                      <FaFileInvoice className="h-5 w-5 text-blue-600 mr-2" />
                      Invoice Details
                    </h2>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    {/* Step 1: Basic Information */}
                    {step === 1 && (
                      <>
                        {/* Tenant Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            <FaUser className="inline h-4 w-4 mr-1" />
                            Select Tenant
                          </label>
                          <select 
                            {...register('tenant')}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            onChange={e => {
                              register('tenant').onChange(e);
                              if (onTenantSelect) onTenantSelect(e.target.value);
                            }}
                          >
                            <option value="">Choose a tenant...</option>
                            {tenants.map(tenant => (
                              <option key={tenant.id} value={tenant.id}>
                                {tenant.name} {tenant.unit && `- Unit ${tenant.unit}`}
                              </option>
                            ))}
                          </select>
                          {errors.tenant && (
                            <p className="mt-1 text-sm text-red-600">{errors.tenant.message}</p>
                          )}
                          {selectedTenant && (
                            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                              <div className="text-sm text-blue-800">
                                <strong>{selectedTenant.name}</strong>
                                {selectedTenant.unit && <span className="ml-2">Unit {selectedTenant.unit}</span>}
                                {selectedTenant.email && <span className="block">{selectedTenant.email}</span>}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Period */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <FaCalendar className="inline h-4 w-4 mr-1" />
                              Month
                            </label>
                            <select 
                              {...register('month')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            >
                              <option value="">Select month...</option>
                              {monthOptions.map((month) => (
                                <option key={month} value={month}>
                                  {month}
                                </option>
                              ))}
                            </select>
                            {errors.month && (
                              <p className="mt-1 text-sm text-red-600">{errors.month.message}</p>
                            )}
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                            <input 
                              {...register('year')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                              placeholder="2025"
                            />
                            {errors.year && (
                              <p className="mt-1 text-sm text-red-600">{errors.year.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                            <input 
                              type="date"
                              {...register('dueDate')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                            {errors.dueDate && (
                              <p className="mt-1 text-sm text-red-600">{errors.dueDate.message}</p>
                            )}
                          </div>
                        </div>

                        {/* Line Items */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            <FaListAlt className="inline h-4 w-4 mr-1" />
                            Invoice Items
                          </label>
                          <div className="space-y-3">
                            {fields.map((field, idx) => (
                              <div key={field.id} className="flex gap-3 items-start">
                                <div className="flex-1">
                                  <input
                                    {...register(`lineItems.${idx}.description` as const)}
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                    placeholder="Item description"
                                  />
                                  {errors.lineItems?.[idx]?.description && (
                                    <p className="mt-1 text-xs text-red-600">
                                      {errors.lineItems[idx]?.description?.message}
                                    </p>
                                  )}
                                </div>
                                <div className="w-32">
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                                      RM
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      {...register(`lineItems.${idx}.amount` as const, { valueAsNumber: true })}
                                      className="w-full pl-10 pr-3 py-2 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                      placeholder="0.00"
                                    />
                                  </div>
                                  {errors.lineItems?.[idx]?.amount && (
                                    <p className="mt-1 text-xs text-red-600">
                                      {errors.lineItems[idx]?.amount?.message}
                                    </p>
                                  )}
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => fields.length > 1 && remove(idx)}
                                  disabled={fields.length === 1}
                                  className="p-2 text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                >
                                  <FaTrash className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <button 
                              type="button" 
                              onClick={() => append({ description: '', amount: 0 })}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <FaPlus className="h-4 w-4 mr-1" />
                              Add Item
                            </button>
                          </div>
                          {errors.lineItems && (
                            <p className="mt-2 text-sm text-red-600">{errors.lineItems.message}</p>
                          )}
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setStep(2)}
                            disabled={!values.tenant || !values.month || !values.year || !values.dueDate || fields.some(f => !f.description || !f.amount)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            Continue to Review
                          </button>
                        </div>
                      </>
                    )}

                    {/* Step 2: Additional Details */}
                    {step === 2 && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <FaCalculator className="inline h-4 w-4 mr-1" />
                              Tax Amount (RM)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                                RM
                              </span>
                              <input 
                                type="number" 
                                step="0.01" 
                                {...register('tax', { valueAsNumber: true })} 
                                className="w-full pl-10 pr-3 py-2 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                placeholder="0.00"
                              />
                            </div>
                            {errors.tax && (
                              <p className="mt-1 text-sm text-red-600">{errors.tax.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                            <select 
                              {...register('status')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            >
                              <option value="unpaid">Unpaid</option>
                              <option value="paid">Paid</option>
                              <option value="overdue">Overdue</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                          <textarea 
                            {...register('notes')} 
                            rows={3}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            placeholder="Additional notes or payment instructions..."
                          />
                        </div>

                        <div className="flex items-center space-x-3">
                          <input 
                            type="checkbox" 
                            {...register('email')} 
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label className="text-sm text-gray-700">
                            <FaEnvelope className="inline h-4 w-4 mr-1" />
                            Email invoice to tenant automatically
                          </label>
                        </div>

                        <div className="flex justify-between">
                          <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Back
                          </button>
                          
                          <div className="flex space-x-3">
                            <button
                              type="button"
                              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <FaSave className="h-4 w-4 mr-2" />
                              Save as Draft
                            </button>
                            
                            <button
                              type="submit"
                              disabled={!isValid || isSubmitting}
                              className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed min-w-[140px]"
                            >
                              {isSubmitting ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Creating...
                                </div>
                              ) : (
                                <>
                                  <FaPaperPlane className="h-4 w-4 mr-2" />
                                  Create Invoice
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview Section */}
              <div className="lg:col-span-1">
                <div className="sticky top-8">
                  <div className="bg-white shadow-sm rounded-2xl border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <FaEye className="h-5 w-5 text-green-600 mr-2" />
                        Live Preview
                      </h3>
                    </div>
                    
                    <div className="p-6">
                      <div className="border rounded-lg p-4 bg-gray-50">
                        {/* Invoice Header */}
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
                            <p className="text-sm text-gray-600">#{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                          </div>
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                            values.status === 'paid' ? 'bg-green-100 text-green-800' :
                            values.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {values.status?.charAt(0).toUpperCase() + values.status?.slice(1)}
                          </span>
                        </div>

                        {/* Invoice Details */}
                        <div className="mb-6 space-y-2">
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">To:</span>
                            <div className="text-gray-900">
                              {selectedTenant?.name || 'Select a tenant'}
                              {selectedTenant?.unit && <div className="text-gray-600">Unit {selectedTenant.unit}</div>}
                            </div>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">Period:</span> 
                            <span className="text-gray-900 ml-1">
                              {values.month ? `${values.month} ${values.year}` : 'Select period'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">Due Date:</span> 
                            <span className="text-gray-900 ml-1">
                              {values.dueDate ? new Date(values.dueDate).toLocaleDateString() : 'Set due date'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">Date Issued:</span> 
                            <span className="text-gray-900 ml-1">{new Date().toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Line Items */}
                        <div className="border-t border-gray-200 pt-4 mb-4">
                          <div className="space-y-2">
                            {values.lineItems?.filter(item => item.description).map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-700">{item.description}</span>
                                <span className="text-gray-900 font-medium">RM {Number(item.amount || 0).toFixed(2)}</span>
                              </div>
                            ))}
                            {(!values.lineItems || values.lineItems.filter(item => item.description).length === 0) && (
                              <div className="text-sm text-gray-500 italic">No items added yet</div>
                            )}
                          </div>
                        </div>

                        {/* Totals */}
                        <div className="border-t border-gray-200 pt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-gray-600">Subtotal:</span>
                            <span className="text-gray-900">RM {subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-gray-600">Tax:</span>
                            <span className="text-gray-900">RM {taxAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                            <span className="text-gray-900">Total:</span>
                            <span className="text-gray-900">RM {total.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Notes */}
                        {values.notes && (
                          <div className="border-t border-gray-200 pt-4 mt-4">
                            <p className="text-sm font-medium text-gray-600 mb-1">Notes:</p>
                            <p className="text-sm text-gray-700">{values.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </FormProvider>
    </div>
  );
}
                              <span className="text-gray-900 font-medium">RM {item.amount.toFixed(2)}</span>
                            </div>
                          ))}
                          {(!items || items.length === 0) && (
                            <div className="text-sm text-gray-500 italic">No items added yet</div>
                          )}
                        </div>
                      </div>

                      {/* Totals */}
                      <div className="border-t border-gray-200 pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-600">Subtotal:</span>
                          <span className="text-gray-900">RM {items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-600">Tax:</span>
                          <span className="text-gray-900">RM {items.reduce((sum, item) => sum + (item.tax || 0), 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                          <span className="text-gray-900">Total:</span>
                          <span className="text-gray-900">RM {items.reduce((sum, item) => sum + item.amount + (item.tax || 0), 0).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Notes */}
                      {items.some(item => item.notes) && (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                          <p className="text-sm font-medium text-gray-600 mb-1">Notes:</p>
                          <p className="text-sm text-gray-700">{items.find(item => item.notes)?.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
export default function InvoiceWizard({ 
  tenants = mockTenants, 
  onSubmit,
  onCancel,
  rent = 0,
  onTenantSelect
}: { 
  tenants?: { id: string; name: string; unit?: string; email?: string }[]; 
  onSubmit?: (data: InvoiceFormValues) => void;
  onCancel?: () => void;
  rent?: number;
  onTenantSelect?: (tenantId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = async (data: InvoiceFormValues) => {
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(data);
      } else {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Invoice created:', data);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const methods = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      tenant: '',
      month: '',
      year: new Date().getFullYear().toString(),
      dueDate: '',
      lineItems: [{ description: 'Monthly Rent', amount: 0 }],
      tax: 0,
      status: 'unpaid',
      email: true,
      notes: '',
    },
    mode: 'onChange',
  });

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isValid } } = methods;
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const values = watch();

  // Automatically set the first line item's amount to rent when tenant changes and rent > 0
  useEffect(() => {
    if (values.tenant && rent > 0) {
      setValue('lineItems.0.amount', rent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.tenant, rent]);

  // Calculate totals
  const subtotal = values.lineItems?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;
  const taxAmount = Number(values.tax) || 0;
  const total = subtotal + taxAmount;

  const selectedTenant = tenants.find(t => t.id === values.tenant);

  // Generate next month options
  const monthOptions = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentMonth = new Date().getMonth();
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FaArrowLeft className="h-4 w-4 mr-2" />
                Back to Invoices
              </button>
              <div className="h-6 border-l border-gray-300"></div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Create New Invoice</h1>
                <p className="text-sm text-gray-500">Generate and send invoices to tenants</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                {[1, 2].map((stepNumber) => (
                  <div key={stepNumber} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step === stepNumber 
                        ? 'bg-blue-600 text-white' 
                        : step > stepNumber 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {step > stepNumber ? <FaCheck className="h-4 w-4" /> : stepNumber}
                    </div>
                    {stepNumber < 2 && (
                      <div className={`w-12 h-1 mx-2 ${
                        step > stepNumber ? 'bg-green-500' : 'bg-gray-200'
                      }`}></div>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-sm text-gray-500">
                Step {step} of 2
              </span>
            </div>
          </div>
        </div>
      </div>

      <FormProvider {...methods}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Section */}
              <div className="lg:col-span-2">
                <div className="bg-white shadow-sm rounded-2xl border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                      <FaFileInvoice className="h-5 w-5 text-blue-600 mr-2" />
                      Invoice Details
                    </h2>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    {/* Step 1: Basic Information */}
                    {step === 1 && (
                      <>
                        {/* Tenant Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            <FaUser className="inline h-4 w-4 mr-1" />
                            Select Tenant
                          </label>
                          <select 
                            {...register('tenant')}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            onChange={e => {
                              register('tenant').onChange(e);
                              if (onTenantSelect) onTenantSelect(e.target.value);
                            }}
                          >
                            <option value="">Choose a tenant...</option>
                            {tenants.map(tenant => (
                              <option key={tenant.id} value={tenant.id}>
                                {tenant.name} {tenant.unit && `- Unit ${tenant.unit}`}
                              </option>
                            ))}
                          </select>
                          {errors.tenant && (
                            <p className="mt-1 text-sm text-red-600">{errors.tenant.message}</p>
                          )}
                          {selectedTenant && (
                            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                              <div className="text-sm text-blue-800">
                                <strong>{selectedTenant.name}</strong>
                                {selectedTenant.unit && <span className="ml-2">Unit {selectedTenant.unit}</span>}
                                {selectedTenant.email && <span className="block">{selectedTenant.email}</span>}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Period */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <FaCalendar className="inline h-4 w-4 mr-1" />
                              Month
                            </label>
                            <select 
                              {...register('month')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            >
                              <option value="">Select month...</option>
                              {monthOptions.map((month) => (
                                <option key={month} value={month}>
                                  {month}
                                </option>
                              ))}
                            </select>
                            {errors.month && (
                              <p className="mt-1 text-sm text-red-600">{errors.month.message}</p>
                            )}
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                            <input 
                              {...register('year')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                              placeholder="2025"
                            />
                            {errors.year && (
                              <p className="mt-1 text-sm text-red-600">{errors.year.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                            <input 
                              type="date"
                              {...register('dueDate')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                            {errors.dueDate && (
                              <p className="mt-1 text-sm text-red-600">{errors.dueDate.message}</p>
                            )}
                          </div>
                        </div>

                        {/* Line Items */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            <FaListAlt className="inline h-4 w-4 mr-1" />
                            Invoice Items
                          </label>
                          <div className="space-y-3">
                            {fields.map((field, idx) => (
                              <div key={field.id} className="flex gap-3 items-start">
                                <div className="flex-1">
                                  <input
                                    {...register(`lineItems.${idx}.description` as const)}
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                    placeholder="Item description"
                                  />
                                  {errors.lineItems?.[idx]?.description && (
                                    <p className="mt-1 text-xs text-red-600">
                                      {errors.lineItems[idx]?.description?.message}
                                    </p>
                                  )}
                                </div>
                                <div className="w-32">
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                                      RM
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      {...register(`lineItems.${idx}.amount` as const, { valueAsNumber: true })}
                                      className="w-full pl-10 pr-3 py-2 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                      placeholder="0.00"
                                    />
                                  </div>
                                  {errors.lineItems?.[idx]?.amount && (
                                    <p className="mt-1 text-xs text-red-600">
                                      {errors.lineItems[idx]?.amount?.message}
                                    </p>
                                  )}
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => fields.length > 1 && remove(idx)}
                                  disabled={fields.length === 1}
                                  className="p-2 text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                >
                                  <FaTrash className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <button 
                              type="button" 
                              onClick={() => append({ description: '', amount: 0 })}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <FaPlus className="h-4 w-4 mr-1" />
                              Add Item
                            </button>
                          </div>
                          {errors.lineItems && (
                            <p className="mt-2 text-sm text-red-600">{errors.lineItems.message}</p>
                          )}
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setStep(2)}
                            disabled={!values.tenant || !values.month || !values.year || !values.dueDate || fields.some(f => !f.description || !f.amount)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            Continue to Review
                          </button>
                        </div>
                      </>
                    )}

                    {/* Step 2: Additional Details */}
                    {step === 2 && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <FaCalculator className="inline h-4 w-4 mr-1" />
                              Tax Amount (RM)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                                RM
                              </span>
                              <input 
                                type="number" 
                                step="0.01" 
                                {...register('tax', { valueAsNumber: true })} 
                                className="w-full pl-10 pr-3 py-2 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                placeholder="0.00"
                              />
                            </div>
                            {errors.tax && (
                              <p className="mt-1 text-sm text-red-600">{errors.tax.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                            <select 
                              {...register('status')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            >
                              <option value="unpaid">Unpaid</option>
                              <option value="paid">Paid</option>
                              <option value="overdue">Overdue</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                          <textarea 
                            {...register('notes')} 
                            rows={3}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            placeholder="Additional notes or payment instructions..."
                          />
                        </div>

                        <div className="flex items-center space-x-3">
                          <input 
                            type="checkbox" 
                            {...register('email')} 
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label className="text-sm text-gray-700">
                            <FaEnvelope className="inline h-4 w-4 mr-1" />
                            Email invoice to tenant automatically
                          </label>
                        </div>

                        <div className="flex justify-between">
                          <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Back
                          </button>
                          
                          <div className="flex space-x-3">
                            <button
                              type="button"
                              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <FaSave className="h-4 w-4 mr-2" />
                              Save as Draft
                            </button>
                            
                            <button
                              type="submit"
                              disabled={!isValid || isSubmitting}
                              className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed min-w-[140px]"
                            >
                              {isSubmitting ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Creating...
                                </div>
                              ) : (
                                <>
                                  <FaPaperPlane className="h-4 w-4 mr-2" />
                                  Create Invoice
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview Section */}
              <div className="lg:col-span-1">
                <div className="sticky top-8">
                  <div className="bg-white shadow-sm rounded-2xl border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <FaEye className="h-5 w-5 text-green-600 mr-2" />
                        Live Preview
                      </h3>
                    </div>
                    
                    <div className="p-6">
                      <div className="border rounded-lg p-4 bg-gray-50">
                        {/* Invoice Header */}
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
                            <p className="text-sm text-gray-600">#{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                          </div>
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                            values.status === 'paid' ? 'bg-green-100 text-green-800' :
                            values.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {values.status?.charAt(0).toUpperCase() + values.status?.slice(1)}
                          </span>
                        </div>

                        {/* Invoice Details */}
                        <div className="mb-6 space-y-2">
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">To:</span>
                            <div className="text-gray-900">
                              {selectedTenant?.name || 'Select a tenant'}
                              {selectedTenant?.unit && <div className="text-gray-600">Unit {selectedTenant.unit}</div>}
                            </div>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">Period:</span> 
                            <span className="text-gray-900 ml-1">
                              {values.month ? `${values.month} ${values.year}` : 'Select period'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">Due Date:</span> 
                            <span className="text-gray-900 ml-1">
                              {values.dueDate ? new Date(values.dueDate).toLocaleDateString() : 'Set due date'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">Date Issued:</span> 
                            <span className="text-gray-900 ml-1">{new Date().toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Line Items */}
                        <div className="border-t border-gray-200 pt-4 mb-4">
                          <div className="space-y-2">
                            {values.lineItems?.filter(item => item.description).map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-700">{item.description}</span>
                                <span className="text-gray-900 font-medium">RM {Number(item.amount || 0).toFixed(2)}</span>
                              </div>
                            ))}
                            {(!values.lineItems || values.lineItems.filter(item => item.description).length === 0) && (
                              <div className="text-sm text-gray-500 italic">No items added yet</div>
                            )}
                          </div>
                        </div>

                        {/* Totals */}
                        <div className="border-t border-gray-200 pt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-gray-600">Subtotal:</span>
                            <span className="text-gray-900">RM {subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-gray-600">Tax:</span>
                            <span className="text-gray-900">RM {taxAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                            <span className="text-gray-900">Total:</span>
                            <span className="text-gray-900">RM {total.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Notes */}
                        {values.notes && (
                          <div className="border-t border-gray-200 pt-4 mt-4">
                            <p className="text-sm font-medium text-gray-600 mb-1">Notes:</p>
                            <p className="text-sm text-gray-700">{values.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </FormProvider>
    </div>
  );
}
                              <span className="text-gray-900 font-medium">RM {item.amount.toFixed(2)}</span>
                            </div>
                          ))}
                          {(!items || items.length === 0) && (
                            <div className="text-sm text-gray-500 italic">No items added yet</div>
                          )}
                        </div>
                      </div>

                      {/* Totals */}
                      <div className="border-t border-gray-200 pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-600">Subtotal:</span>
                          <span className="text-gray-900">RM {items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-600">Tax:</span>
                          <span className="text-gray-900">RM {items.reduce((sum, item) => sum + (item.tax || 0), 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                          <span className="text-gray-900">Total:</span>
                          <span className="text-gray-900">RM {items.reduce((sum, item) => sum + item.amount + (item.tax || 0), 0).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Notes */}
                      {items.some(item => item.notes) && (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                          <p className="text-sm font-medium text-gray-600 mb-1">Notes:</p>
                          <p className="text-sm text-gray-700">{items.find(item => item.notes)?.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
export default function InvoiceWizard({ 
  tenants = mockTenants, 
  onSubmit,
  onCancel,
  rent = 0,
  onTenantSelect
}: { 
  tenants?: { id: string; name: string; unit?: string; email?: string }[]; 
  onSubmit?: (data: InvoiceFormValues) => void;
  onCancel?: () => void;
  rent?: number;
  onTenantSelect?: (tenantId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = async (data: InvoiceFormValues) => {
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(data);
      } else {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Invoice created:', data);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const methods = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      tenant: '',
      month: '',
      year: new Date().getFullYear().toString(),
      dueDate: '',
      lineItems: [{ description: 'Monthly Rent', amount: 0 }],
      tax: 0,
      status: 'unpaid',
      email: true,
      notes: '',
    },
    mode: 'onChange',
  });

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isValid } } = methods;
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const values = watch();

  // Automatically set the first line item's amount to rent when tenant changes and rent > 0
  useEffect(() => {
    if (values.tenant && rent > 0) {
      setValue('lineItems.0.amount', rent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.tenant, rent]);

  // Calculate totals
  const subtotal = values.lineItems?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;
  const taxAmount = Number(values.tax) || 0;
  const total = subtotal + taxAmount;

  const selectedTenant = tenants.find(t => t.id === values.tenant);

  // Generate next month options
  const monthOptions = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentMonth = new Date().getMonth();
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FaArrowLeft className="h-4 w-4 mr-2" />
                Back to Invoices
              </button>
              <div className="h-6 border-l border-gray-300"></div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Create New Invoice</h1>
                <p className="text-sm text-gray-500">Generate and send invoices to tenants</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                {[1, 2].map((stepNumber) => (
                  <div key={stepNumber} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step === stepNumber 
                        ? 'bg-blue-600 text-white' 
                        : step > stepNumber 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {step > stepNumber ? <FaCheck className="h-4 w-4" /> : stepNumber}
                    </div>
                    {stepNumber < 2 && (
                      <div className={`w-12 h-1 mx-2 ${
                        step > stepNumber ? 'bg-green-500' : 'bg-gray-200'
                      }`}></div>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-sm text-gray-500">
                Step {step} of 2
              </span>
            </div>
          </div>
        </div>
      </div>

      <FormProvider {...methods}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Section */}
              <div className="lg:col-span-2">
                <div className="bg-white shadow-sm rounded-2xl border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                      <FaFileInvoice className="h-5 w-5 text-blue-600 mr-2" />
                      Invoice Details
                    </h2>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    {/* Step 1: Basic Information */}
                    {step === 1 && (
                      <>
                        {/* Tenant Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            <FaUser className="inline h-4 w-4 mr-1" />
                            Select Tenant
                          </label>
                          <select 
                            {...register('tenant')}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            onChange={e => {
                              register('tenant').onChange(e);
                              if (onTenantSelect) onTenantSelect(e.target.value);
                            }}
                          >
                            <option value="">Choose a tenant...</option>
                            {tenants.map(tenant => (
                              <option key={tenant.id} value={tenant.id}>
                                {tenant.name} {tenant.unit && `- Unit ${tenant.unit}`}
                              </option>
                            ))}
                          </select>
                          {errors.tenant && (
                            <p className="mt-1 text-sm text-red-600">{errors.tenant.message}</p>
                          )}
                          {selectedTenant && (
                            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                              <div className="text-sm text-blue-800">
                                <strong>{selectedTenant.name}</strong>
                                {selectedTenant.unit && <span className="ml-2">Unit {selectedTenant.unit}</span>}
                                {selectedTenant.email && <span className="block">{selectedTenant.email}</span>}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Period */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <FaCalendar className="inline h-4 w-4 mr-1" />
                              Month
                            </label>
                            <select 
                              {...register('month')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            >
                              <option value="">Select month...</option>
                              {monthOptions.map((month) => (
                                <option key={month} value={month}>
                                  {month}
                                </option>
                              ))}
                            </select>
                            {errors.month && (
                              <p className="mt-1 text-sm text-red-600">{errors.month.message}</p>
                            )}
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                            <input 
                              {...register('year')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                              placeholder="2025"
                            />
                            {errors.year && (
                              <p className="mt-1 text-sm text-red-600">{errors.year.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                            <input 
                              type="date"
                              {...register('dueDate')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            />
                            {errors.dueDate && (
                              <p className="mt-1 text-sm text-red-600">{errors.dueDate.message}</p>
                            )}
                          </div>
                        </div>

                        {/* Line Items */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            <FaListAlt className="inline h-4 w-4 mr-1" />
                            Invoice Items
                          </label>
                          <div className="space-y-3">
                            {fields.map((field, idx) => (
                              <div key={field.id} className="flex gap-3 items-start">
                                <div className="flex-1">
                                  <input
                                    {...register(`lineItems.${idx}.description` as const)}
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                    placeholder="Item description"
                                  />
                                  {errors.lineItems?.[idx]?.description && (
                                    <p className="mt-1 text-xs text-red-600">
                                      {errors.lineItems[idx]?.description?.message}
                                    </p>
                                  )}
                                </div>
                                <div className="w-32">
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                                      RM
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      {...register(`lineItems.${idx}.amount` as const, { valueAsNumber: true })}
                                      className="w-full pl-10 pr-3 py-2 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                      placeholder="0.00"
                                    />
                                  </div>
                                  {errors.lineItems?.[idx]?.amount && (
                                    <p className="mt-1 text-xs text-red-600">
                                      {errors.lineItems[idx]?.amount?.message}
                                    </p>
                                  )}
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => fields.length > 1 && remove(idx)}
                                  disabled={fields.length === 1}
                                  className="p-2 text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                >
                                  <FaTrash className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <button 
                              type="button" 
                              onClick={() => append({ description: '', amount: 0 })}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <FaPlus className="h-4 w-4 mr-1" />
                              Add Item
                            </button>
                          </div>
                          {errors.lineItems && (
                            <p className="mt-2 text-sm text-red-600">{errors.lineItems.message}</p>
                          )}
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setStep(2)}
                            disabled={!values.tenant || !values.month || !values.year || !values.dueDate || fields.some(f => !f.description || !f.amount)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            Continue to Review
                          </button>
                        </div>
                      </>
                    )}

                    {/* Step 2: Additional Details */}
                    {step === 2 && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <FaCalculator className="inline h-4 w-4 mr-1" />
                              Tax Amount (RM)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                                RM
                              </span>
                              <input 
                                type="number" 
                                step="0.01" 
                                {...register('tax', { valueAsNumber: true })} 
                                className="w-full pl-10 pr-3 py-2 border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                                placeholder="0.00"
                              />
                            </div>
                            {errors.tax && (
                              <p className="mt-1 text-sm text-red-600">{errors.tax.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                            <select 
                              {...register('status')} 
                              className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            >
                              <option value="unpaid">Unpaid</option>
                              <option value="paid">Paid</option>
                              <option value="overdue">Overdue</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                          <textarea 
                            {...register('notes')} 
                            rows={3}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            placeholder="Additional notes or payment instructions..."
                          />
                        </div>

                        <div className="flex items-center space-x-3">
                          <input 
                            type="checkbox" 
                            {...register('email')} 
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label className="text-sm text-gray-700">
                            <FaEnvelope className="inline h-4 w-4 mr-1" />
                            Email invoice to tenant automatically
                          </label>
                        </div>

                        <div className="flex justify-between">
                          <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Back
                          </button>
                          
                          <div className="flex space-x-3">
                            <button
                              type="button"
                              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <FaSave className="h-4 w-4 mr-2" />
                              Save as Draft
                            </button>
                            
                            <button
                              type="submit"
                              disabled={!isValid || isSubmitting}
                              className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed min-w-[140px]"
                            >
                              {isSubmitting ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Creating...
                                </div>
                              ) : (
                                <>
                                  <FaPaperPlane className="h-4 w-4 mr-2" />
                                  Create Invoice
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview Section */}
              <div className="lg:col-span-1">
                <div className="sticky top-8">
                  <div className="bg-white shadow-sm rounded-2xl border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <FaEye className="h-5 w-5 text-green-600 mr-2" />
                        Live Preview
                      </h3>
                    </div>
                    
                    <div className="p-6">
                      <div className="border rounded-lg p-4 bg-gray-50">
                        {/* Invoice Header */}
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
                            <p className="text-sm text-gray-600">#{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                          </div>
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                            values.status === 'paid' ? 'bg-green-100 text-green-800' :
                            values.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {values.status?.charAt(0).toUpperCase() + values.status?.slice(1)}
                          </span>
                        </div>

                        {/* Invoice Details */}
                        <div className="mb-6 space-y-2">
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">To:</span>
                            <div className="text-gray-900">
                              {selectedTenant?.name || 'Select a tenant'}
                              {selectedTenant?.unit && <div className="text-gray-600">Unit {selectedTenant.unit}</div>}
                            </div>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">Period:</span> 
                            <span className="text-gray-900 ml-1">
                              {values.month ? `${values.month} ${values.year}` : 'Select period'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">Due Date:</span> 
                            <span className="text-gray-900 ml-1">
                              {values.dueDate ? new Date(values.dueDate).toLocaleDateString() : 'Set due date'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">Date Issued:</span> 
                            <span className="text-gray-900 ml-1">{new Date().toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Line Items */}
                        <div className="border-t border-gray-200 pt-4 mb-4">
                          <div className="space-y-2">
                            {values.lineItems?.filter(item => item.description).map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-700">{item.description}</span>
                                <span className="text-gray-900 font-medium">RM {Number(item.amount || 0).toFixed(2)}</span>
                              </div>
                            ))}
                            {(!values.lineItems || values.lineItems.filter(item => item.description).length === 0) && (
                              <div className="text-sm text-gray-500 italic">No items added yet</div>
                            )}
                          </div>
                        </div>

                        {/* Totals */}
                        <div className="border-t border-gray-200 pt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-gray-600">Subtotal:</span>
                            <span className="text-gray-900">RM {subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-gray-600">Tax:</span>
                            <span className="text-gray-900">RM {taxAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                            <span className="text-gray-900">Total:</span>
                            <span className="text-gray-900">RM {total.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Notes */}
                        {values.notes && (
                          <div className="border-t border-gray-200 pt-4 mt-4">
                            <p className="text-sm font-medium text-gray-600 mb-1">Notes:</p>
                            <p className="text-sm text-gray-700">{values.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </FormProvider>
    </div>
  );
}