import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FaUser, FaHome, FaCalendarAlt, FaCheckCircle, FaMagic, FaSpinner, FaBuilding, FaFileContract } from 'react-icons/fa';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Unit } from '@/types';

const contractSchema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  unitId: z.string().min(1, 'Unit is required'),
  term: z.string().min(1, 'Term is required'),
  moveInDate: z.string().min(1, 'Move-in date is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  monthlyRent: z.number().min(1, 'Rent is required'),
  securityDeposit: z.number().min(0, 'Security deposit is required'),
  utilityDeposit: z.number().min(0, 'Utility deposit is required'),
  accessCardDeposit: z.number().min(0, 'Access card deposit is required'),
  agreementFee: z.number().min(0, 'Agreement fee is required'),
});

type ContractFormValues = z.infer<typeof contractSchema>;

const steps = [
  { label: 'Tenant & Unit', icon: <FaUser /> },
  { label: 'Terms', icon: <FaCalendarAlt /> },
  { label: 'Financial', icon: <FaHome /> },
  { label: 'Review', icon: <FaCheckCircle /> },
];

export default function ContractWizard({ onSubmit }: { onSubmit?: (data: ContractFormValues) => void }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [aiPreview, setAiPreview] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [tenants, setTenants] = useState<User[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  
  const methods = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: { 
      tenantId: '', 
      unitId: '', 
      term: '', 
      moveInDate: '', 
      expiryDate: '', 
      monthlyRent: 0,
      securityDeposit: 0,
      utilityDeposit: 0,
      accessCardDeposit: 0,
      agreementFee: 0
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
        setValue('monthlyRent', unit.monthlyRent);
        // Set default deposits based on rent
        setValue('securityDeposit', unit.monthlyRent * 2);
        setValue('utilityDeposit', unit.monthlyRent * 0.5);
        setValue('accessCardDeposit', 50);
        setValue('agreementFee', 200);
      }
    }
  }, [selectedUnitId, units, setValue]);

  const nextStep = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const handleFinalSubmit = (data: ContractFormValues) => {
    if (onSubmit) onSubmit(data);
    // You can add Firestore logic here
  };

  const generateAIContract = async () => {
    setAiLoading(true);
    try {
      const values = getValues();
      const selectedTenant = tenants.find(t => t.id === values.tenantId);
      const selectedUnit = units.find(u => u.id === values.unitId);
      
      const contractInputs = {
        tenantName: selectedTenant?.fullName || '',
        tenantEmail: selectedTenant?.email || '',
        tenantPhone: selectedTenant?.phoneNumber || '',
        unitNumber: selectedUnit?.fullUnitNumber || '',
        buildingName: selectedUnit?.buildingName || '',
        monthlyRent: values.monthlyRent,
        term: values.term,
        moveInDate: values.moveInDate,
        expiryDate: values.expiryDate,
        securityDeposit: values.securityDeposit,
        utilityDeposit: values.utilityDeposit,
        accessCardDeposit: values.accessCardDeposit,
        agreementFee: values.agreementFee
      };

      const res = await fetch('/api/ai/contract', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ inputs: contractInputs })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI failed');
      setAiPreview(data.contract);
      toast.success('AI contract generated successfully');
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
        <div className="mb-6 grid grid-cols-2 gap-2">
          <button onClick={()=>setMode('manual')} className={`px-3 py-2 rounded border ${mode==='manual' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'}`}>Manual</button>
          <button onClick={()=>setMode('ai')} className={`px-3 py-2 rounded border ${mode==='ai' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300'}`}>AI Assist</button>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
                  <select {...register('term')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500">
                    <option value="">-- Select Term --</option>
                    <option value="6 months">6 months</option>
                    <option value="12 months">12 months</option>
                    <option value="18 months">18 months</option>
                    <option value="24 months">24 months</option>
                  </select>
                  {errors.term && <span className="text-red-500 text-xs mt-1 block">{errors.term.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Move-in Date</label>
                  <input type="date" {...register('moveInDate')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                  {errors.moveInDate && <span className="text-red-500 text-xs mt-1 block">{errors.moveInDate.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
                  <input type="date" {...register('expiryDate')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                  {errors.expiryDate && <span className="text-red-500 text-xs mt-1 block">{errors.expiryDate.message}</span>}
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Rent (RM)</label>
                  <input type="number" {...register('monthlyRent', { valueAsNumber: true })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                  {errors.monthlyRent && <span className="text-red-500 text-xs mt-1 block">{errors.monthlyRent.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Security Deposit (RM)</label>
                  <input type="number" {...register('securityDeposit', { valueAsNumber: true })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                  {errors.securityDeposit && <span className="text-red-500 text-xs mt-1 block">{errors.securityDeposit.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Utility Deposit (RM)</label>
                  <input type="number" {...register('utilityDeposit', { valueAsNumber: true })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                  {errors.utilityDeposit && <span className="text-red-500 text-xs mt-1 block">{errors.utilityDeposit.message}</span>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Access Card Deposit (RM)</label>
                  <input type="number" {...register('accessCardDeposit', { valueAsNumber: true })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                  {errors.accessCardDeposit && <span className="text-red-500 text-xs mt-1 block">{errors.accessCardDeposit.message}</span>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Agreement Fee (RM)</label>
                  <input type="number" {...register('agreementFee', { valueAsNumber: true })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                  {errors.agreementFee && <span className="text-red-500 text-xs mt-1 block">{errors.agreementFee.message}</span>}
                </div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FaFileContract className="mr-2" />
                Review Contract
              </h3>
              <div className="bg-gray-50 rounded-lg p-6 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><span className="font-medium text-gray-700">Tenant:</span> {tenants.find(t => t.id === getValues('tenantId'))?.fullName || '-'}</div>
                  <div><span className="font-medium text-gray-700">Unit:</span> {units.find(u => u.id === getValues('unitId'))?.fullUnitNumber || '-'}</div>
                  <div><span className="font-medium text-gray-700">Building:</span> {units.find(u => u.id === getValues('unitId'))?.buildingName || '-'}</div>
                  <div><span className="font-medium text-gray-700">Term:</span> {getValues('term')}</div>
                  <div><span className="font-medium text-gray-700">Move-in Date:</span> {getValues('moveInDate')}</div>
                  <div><span className="font-medium text-gray-700">Expiry Date:</span> {getValues('expiryDate')}</div>
                  <div><span className="font-medium text-gray-700">Monthly Rent:</span> RM {getValues('monthlyRent')?.toLocaleString()}</div>
                  <div><span className="font-medium text-gray-700">Security Deposit:</span> RM {getValues('securityDeposit')?.toLocaleString()}</div>
                  <div><span className="font-medium text-gray-700">Utility Deposit:</span> RM {getValues('utilityDeposit')?.toLocaleString()}</div>
                  <div><span className="font-medium text-gray-700">Access Card Deposit:</span> RM {getValues('accessCardDeposit')?.toLocaleString()}</div>
                  <div><span className="font-medium text-gray-700">Agreement Fee:</span> RM {getValues('agreementFee')?.toLocaleString()}</div>
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
              <button type="submit" className="ml-auto px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors">Create Contract</button>
            )}
          </div>
        </form>
        )}

        {mode==='ai' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <FaMagic className="text-green-600 mr-2" />
                <h3 className="font-medium text-green-900">AI Contract Generation</h3>
              </div>
              <p className="text-sm text-green-700">
                Fill out the form steps above, then click &quot;Generate with AI&quot; to create a professional contract. 
                The AI will use your tenant and unit information to generate a comprehensive lease agreement.
              </p>
            </div>
            
            <div className="flex justify-center">
              <button
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                onClick={generateAIContract}
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
                <h4 className="font-medium text-gray-900">Generated Contract:</h4>
                <div className="bg-white border border-gray-200 rounded-lg p-6 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{aiPreview}</pre>
                </div>
                <div className="flex gap-3">
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    onClick={() => {
                      // Copy to clipboard
                      navigator.clipboard.writeText(aiPreview);
                      toast.success('Contract copied to clipboard');
                    }}
                  >
                    Copy Contract
                  </button>
                  <button
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    onClick={() => setAiPreview('')}
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