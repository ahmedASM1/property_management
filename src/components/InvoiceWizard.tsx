'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FaUser, FaCalendarAlt, FaCheckCircle, FaMagic, FaSpinner, FaFileInvoiceDollar, FaBuilding } from 'react-icons/fa';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Unit } from '@/types';

const invoiceSchema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  unitId: z.string().min(1, 'Unit is required'),
  month: z.string().min(1, 'Month is required'),
  year: z.number().min(2020, 'Year is required'),
  rentAmount: z.number().min(0, 'Rent amount is required'),
  utilities: z.object({
    water: z.number().min(0),
    electricity: z.number().min(0),
    internet: z.number().min(0),
    other: z.number().min(0)
  }),
  description: z.string().optional(),
  dueDate: z.string().min(1, 'Due date is required')
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

const steps = [
  { label: 'Tenant & Unit', icon: <FaUser /> },
  { label: 'Period', icon: <FaCalendarAlt /> },
  { label: 'Amounts', icon: <FaFileInvoiceDollar /> },
  { label: 'Review', icon: <FaCheckCircle /> },
];

interface InvoiceWizardProps {
  onSubmit?: (data: InvoiceFormValues) => Promise<void>;
  onCancel?: () => void;
}

export default function InvoiceWizard({ 
  onSubmit
}: InvoiceWizardProps) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [aiPreview, setAiPreview] = useState<Record<string, unknown> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [tenants, setTenants] = useState<User[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const methods = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { 
      tenantId: '', 
      unitId: '', 
      month: '', 
      year: new Date().getFullYear(),
      rentAmount: 0,
      utilities: {
        water: 0,
        electricity: 0,
        internet: 0,
        other: 0
      } as { water: number; electricity: number; internet: number; other: number },
      description: '',
      dueDate: ''
    },
    mode: 'onTouched',
  });
  const { handleSubmit, register, formState: { errors }, getValues, watch, setValue } = methods;

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tenants
        const tenantsQuery = query(collection(db, 'users'), where('role', '==', 'tenant'), where('isApproved', '==', true));
        const tenantsSnapshot = await getDocs(tenantsQuery);
        const tenantsData = tenantsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date()
        })) as User[];
        setTenants(tenantsData);

        // Fetch units
        const unitsQuery = query(collection(db, 'units'));
        const unitsSnapshot = await getDocs(unitsQuery);
        const unitsData = unitsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date()
        })) as Unit[];
        setUnits(unitsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Auto-fill unit details when unit is selected
  const selectedUnitId = watch('unitId');
  useEffect(() => {
    if (selectedUnitId) {
      const unit = units.find(u => u.id === selectedUnitId);
      if (unit) {
        setValue('rentAmount', unit.monthlyRent);
      }
    }
  }, [selectedUnitId, units, setValue]);

  const nextStep = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const handleFinalSubmit = async (data: InvoiceFormValues) => {
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(data);
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Invoice created:', data);
        toast.success('Invoice created successfully');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateAIInvoice = async () => {
    setAiLoading(true);
    try {
      const values = getValues();
      const selectedTenant = tenants.find(t => t.id === values.tenantId);
      const selectedUnit = units.find(u => u.id === values.unitId);
      
      const invoiceDescription = `Create invoice for ${selectedTenant?.fullName || 'tenant'} at ${selectedUnit?.fullUnitNumber || 'unit'} for ${values.month} ${values.year}. Rent: RM${values.rentAmount}, Water: RM${values.utilities.water}, Electricity: RM${values.utilities.electricity}, Internet: RM${values.utilities.internet}, Other: RM${values.utilities.other}. Due date: ${values.dueDate}`;

      const res = await fetch('/api/ai/invoice', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ description: invoiceDescription })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI failed');
      setAiPreview(data.invoice);
      toast.success('AI invoice generated successfully');
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 mt-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Invoice</h1>
          <p className="text-gray-600">Generate professional invoices for your tenants</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2">
          <button onClick={() => setMode('manual')} className={`px-3 py-2 rounded border ${mode==='manual' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'}`}>Manual</button>
          <button onClick={() => setMode('ai')} className={`px-3 py-2 rounded border ${mode==='ai' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300'}`}>AI Assist</button>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, idx) => (
            <div key={s.label} className="flex-1 flex flex-col items-center">
              <div className={`w-10 h-10 flex items-center justify-center rounded-full border-2 ${idx <= step ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-gray-100 text-gray-400'}`}>{s.icon}</div>
              <span className={`mt-2 text-xs font-medium ${idx === step ? 'text-green-600' : 'text-gray-400'}`}>{s.label}</span>
              {idx < steps.length - 1 && <div className={`h-1 w-full ${idx < step ? 'bg-green-600' : 'bg-gray-200'}`}></div>}
            </div>
          ))}
        </div>

        {/* Step Content */}
        {mode==='manual' && (
        <form onSubmit={handleSubmit(handleFinalSubmit)}>
          {step === 0 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FaUser className="inline mr-2" />
                    Select Tenant
                  </label>
                  <select {...register('tenantId')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500">
                    <option value="">-- Select Tenant --</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.fullName} ({t.email})
                      </option>
                    ))}
                  </select>
                  {errors.tenantId && <span className="text-red-500 text-xs mt-1 block">{errors.tenantId.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FaBuilding className="inline mr-2" />
                    Select Unit
                  </label>
                  <select {...register('unitId')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500">
                    <option value="">-- Select Unit --</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullUnitNumber} - {u.buildingName} (RM {u.monthlyRent.toLocaleString()})
                      </option>
                    ))}
                  </select>
                  {errors.unitId && <span className="text-red-500 text-xs mt-1 block">{errors.unitId.message}</span>}
                </div>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                  <select {...register('month')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500">
                    <option value="">-- Select Month --</option>
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month) => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                  {errors.month && <span className="text-red-500 text-xs mt-1 block">{errors.month.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                  <input type="number" {...register('year', { valueAsNumber: true })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                  {errors.year && <span className="text-red-500 text-xs mt-1 block">{errors.year.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                  <input type="date" {...register('dueDate')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                  {errors.dueDate && <span className="text-red-500 text-xs mt-1 block">{errors.dueDate.message}</span>}
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rent Amount (RM)</label>
                  <input type="number" {...register('rentAmount', { valueAsNumber: true })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                  {errors.rentAmount && <span className="text-red-500 text-xs mt-1 block">{errors.rentAmount.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Water (RM)</label>
                  <input type="number" {...register('utilities.water', { valueAsNumber: true })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Electricity (RM)</label>
                  <input type="number" {...register('utilities.electricity', { valueAsNumber: true })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Internet (RM)</label>
                  <input type="number" {...register('utilities.internet', { valueAsNumber: true })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Other (RM)</label>
                  <input type="number" {...register('utilities.other', { valueAsNumber: true })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea {...register('description')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" rows={3} />
                </div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FaFileInvoiceDollar className="mr-2" />
                Review Invoice
              </h3>
              <div className="bg-gray-50 rounded-lg p-6 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><span className="font-medium text-gray-700">Tenant:</span> {tenants.find(t => t.id === getValues('tenantId'))?.fullName || '-'}</div>
                  <div><span className="font-medium text-gray-700">Unit:</span> {units.find(u => u.id === getValues('unitId'))?.fullUnitNumber || '-'}</div>
                  <div><span className="font-medium text-gray-700">Period:</span> {getValues('month')} {getValues('year')}</div>
                  <div><span className="font-medium text-gray-700">Due Date:</span> {getValues('dueDate')}</div>
                  <div><span className="font-medium text-gray-700">Rent:</span> RM {getValues('rentAmount')?.toLocaleString()}</div>
                  <div><span className="font-medium text-gray-700">Water:</span> RM {getValues('utilities.water')?.toLocaleString()}</div>
                  <div><span className="font-medium text-gray-700">Electricity:</span> RM {getValues('utilities.electricity')?.toLocaleString()}</div>
                  <div><span className="font-medium text-gray-700">Internet:</span> RM {getValues('utilities.internet')?.toLocaleString()}</div>
                  <div><span className="font-medium text-gray-700">Other:</span> RM {getValues('utilities.other')?.toLocaleString()}</div>
                  <div className="md:col-span-2">
                    <span className="font-medium text-gray-700">Total:</span> RM {(
                      (getValues('rentAmount') || 0) + 
                      (getValues('utilities.water') || 0) + 
                      (getValues('utilities.electricity') || 0) + 
                      (getValues('utilities.internet') || 0) + 
                      (getValues('utilities.other') || 0)
                    ).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            {step > 0 && (
              <button type="button" onClick={prevStep} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors">Back</button>
            )}
            {step < steps.length - 1 && (
              <button type="button" onClick={nextStep} className="ml-auto px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors">Next</button>
            )}
            {step === steps.length - 1 && (
              <button type="submit" disabled={isSubmitting} className="ml-auto px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50">
                {isSubmitting ? 'Creating...' : 'Create Invoice'}
              </button>
            )}
          </div>
        </form>
        )}

        {mode==='ai' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <FaMagic className="text-green-600 mr-2" />
                <h3 className="font-medium text-green-900">AI Invoice Generation</h3>
              </div>
              <p className="text-sm text-green-700">
                Fill out the form steps above, then click &quot;Generate with AI&quot; to create a professional invoice. 
                The AI will use your tenant and unit information to generate a comprehensive invoice.
              </p>
            </div>
            
            <div className="flex justify-center">
              <button
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                onClick={generateAIInvoice}
                disabled={aiLoading || !getValues('tenantId') || !getValues('unitId')}
              >
                {aiLoading ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FaMagic />
                    Generate with AI
                  </>
                )}
              </button>
            </div>
            
            {aiPreview && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Generated Invoice:</h4>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{JSON.stringify(aiPreview, null, 2)}</pre>
                </div>
                <div className="flex gap-3">
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(aiPreview, null, 2));
                      toast.success('Invoice copied to clipboard');
                    }}
                  >
                    Copy Invoice
                  </button>
                  <button
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    onClick={() => setAiPreview(null)}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </FormProvider>
  );
} 