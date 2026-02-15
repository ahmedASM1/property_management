'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface ContractUnitOption {
  /** Display label for dropdown (e.g. "D-11-1 - TAMARIND SUITES") */
  label: string;
  /** Value to store (e.g. unit number or "unitNumber - propertyAddress") */
  value: string;
  contractId: string;
}

/**
 * Returns unit options derived from the tenant's active contract(s).
 * Use this wherever the tenant's unit should be identified from their contract (e.g. maintenance, services).
 */
export function useTenantContractUnits(tenantId: string | undefined): {
  units: ContractUnitOption[];
  loading: boolean;
} {
  const [units, setUnits] = useState<ContractUnitOption[]>([]);
  const [loading, setLoading] = useState(!!tenantId);

  useEffect(() => {
    if (!tenantId) {
      setUnits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const q = query(
          collection(db, 'contracts'),
          where('tenantId', '==', tenantId),
          where('status', 'in', ['pending', 'signed', 'active']),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        if (cancelled) return;
        const options: ContractUnitOption[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const unitNumber = (d.unitNumber as string) || '';
          const propertyAddress = (d.propertyAddress as string) || '';
          const value = unitNumber
            ? (propertyAddress ? `${unitNumber} - ${propertyAddress}` : unitNumber)
            : propertyAddress || docSnap.id;
          const label = value;
          return { label, value, contractId: docSnap.id };
        });
        setUnits(options);
      } catch (_err) {
        if (!cancelled) setUnits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return { units, loading };
}
