import React, { useState } from 'react';
import { FaUser, FaHome, FaCalendarAlt, FaCheckCircle } from 'react-icons/fa';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const contractSchema = z.object({
  tenant: z.string().min(1, 'Tenant is required'),
  property: z.string().min(1, 'Property is required'),
  term: z.string().min(1, 'Term is required'),
  moveInDate: z.string().min(1, 'Move-in date is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  rent: z.string().min(1, 'Rent is required'),
});

type ContractFormValues = z.infer<typeof contractSchema>;

const steps = [
  { label: 'Tenant', icon: <FaUser /> },
  { label: 'Property', icon: <FaHome /> },
  { label: 'Term', icon: <FaCalendarAlt /> },
  { label: 'Review', icon: <FaCheckCircle /> },
];

export default function ContractWizard({ tenants = [], onSubmit }: { tenants?: { id: string; name: string }[]; onSubmit?: (data: ContractFormValues) => void }) {
  const [step, setStep] = useState(0);
  const methods = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: { tenant: '', property: '', term: '', moveInDate: '', expiryDate: '', rent: '' },
    mode: 'onTouched',
  });
  const { handleSubmit, register, formState: { errors }, getValues } = methods;

  const nextStep = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const handleFinalSubmit = (data: ContractFormValues) => {
    if (onSubmit) onSubmit(data);
    // You can add Firestore logic here
  };

  return (
    <FormProvider {...methods}>
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-6 mt-8">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, idx) => (
            <div key={s.label} className="flex-1 flex flex-col items-center">
              <div className={`w-10 h-10 flex items-center justify-center rounded-full border-2 ${idx <= step ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-gray-100 text-gray-400'}`}>{s.icon}</div>
              <span className={`mt-2 text-xs font-medium ${idx === step ? 'text-primary' : 'text-gray-400'}`}>{s.label}</span>
              {idx < steps.length - 1 && <div className={`h-1 w-full ${idx < step ? 'bg-primary' : 'bg-gray-200'}`}></div>}
            </div>
          ))}
        </div>
        {/* Step Content */}
        <form onSubmit={handleSubmit(handleFinalSubmit)}>
          {step === 0 && (
            <div className="space-y-6">
              <label className="block">
                <span className="text-gray-700 font-medium">Select Tenant</span>
                <select {...register('tenant')} className="mt-1 w-full border rounded-lg px-3 py-2">
                  <option value="">-- Select --</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {errors.tenant && <span className="text-red-500 text-xs">{errors.tenant.message}</span>}
              </label>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-6">
              <label className="block">
                <span className="text-gray-700 font-medium">Property Address</span>
                <input {...register('property')} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Enter property address" />
                {errors.property && <span className="text-red-500 text-xs">{errors.property.message}</span>}
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6">
              <label className="block">
                <span className="text-gray-700 font-medium">Term</span>
                <input {...register('term')} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="e.g., 12 months" />
                {errors.term && <span className="text-red-500 text-xs">{errors.term.message}</span>}
              </label>
              <label className="block">
                <span className="text-gray-700 font-medium">Move-in Date</span>
                <input type="date" {...register('moveInDate')} className="mt-1 w-full border rounded-lg px-3 py-2" />
                {errors.moveInDate && <span className="text-red-500 text-xs">{errors.moveInDate.message}</span>}
              </label>
              <label className="block">
                <span className="text-gray-700 font-medium">Expiry Date</span>
                <input type="date" {...register('expiryDate')} className="mt-1 w-full border rounded-lg px-3 py-2" />
                {errors.expiryDate && <span className="text-red-500 text-xs">{errors.expiryDate.message}</span>}
              </label>
              <label className="block">
                <span className="text-gray-700 font-medium">Monthly Rent (RM)</span>
                <input type="number" {...register('rent')} className="mt-1 w-full border rounded-lg px-3 py-2" />
                {errors.rent && <span className="text-red-500 text-xs">{errors.rent.message}</span>}
              </label>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Review Contract</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div><span className="font-medium">Tenant:</span> {tenants.find(t => t.id === getValues('tenant'))?.name || '-'}</div>
                <div><span className="font-medium">Property:</span> {getValues('property')}</div>
                <div><span className="font-medium">Term:</span> {getValues('term')}</div>
                <div><span className="font-medium">Move-in Date:</span> {getValues('moveInDate')}</div>
                <div><span className="font-medium">Expiry Date:</span> {getValues('expiryDate')}</div>
                <div><span className="font-medium">Monthly Rent:</span> RM {getValues('rent')}</div>
              </div>
            </div>
          )}
          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            {step > 0 && (
              <button type="button" onClick={prevStep} className="px-6 py-2 bg-gray-200 rounded-lg font-semibold hover:bg-gray-300">Back</button>
            )}
            {step < steps.length - 1 && (
              <button type="button" onClick={nextStep} className="ml-auto px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark">Next</button>
            )}
            {step === steps.length - 1 && (
              <button type="submit" className="ml-auto px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark">Create Contract</button>
            )}
          </div>
        </form>
      </div>
    </FormProvider>
  );
} 