'use client';

import { useState } from 'react';

interface Tenant {
  id: string;
  name: string;
  unit?: string;
  email?: string;
}

interface InvoiceWizardProps {
  tenants?: Tenant[];
  onSubmit?: (data: { tenant: string; amount: number }) => Promise<void>;
  onCancel?: () => void;
  rent?: number;
}

export default function InvoiceWizard({ 
  tenants = [], 
  onSubmit,
  onCancel,
  rent = 0
}: InvoiceWizardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = async (data: { tenant: string; amount: number }) => {
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(data);
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Invoice created:', data);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Invoice Wizard</h1>
        <p className="text-gray-600 mb-6">Invoice creation functionality is being implemented.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tenant</label>
            <select className="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="">Select a tenant</option>
              {tenants.map((tenant: Tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
            <input 
              type="number" 
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Enter amount"
              defaultValue={rent}
            />
          </div>
        </div>
        
        <div className="flex space-x-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleFormSubmit({ tenant: '', amount: rent })}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
} 