'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getContractExpiryStatus, getExpiryBadgeClass } from '@/lib/utils';
import Image from 'next/image';

interface ContractDoc {
  id: string;
  tenantId: string;
  tenantName: string;
  contractUrl: string;
  propertyAddress?: string;
  term?: string;
  moveInDate?: string;
  expiryDate?: string;
  rentalPerMonth?: string | number;
  status?: string;
  acknowledged?: boolean;
  acknowledgedAt?: string | { toDate?: () => Date };
  signatureUrl?: string;
  archived?: boolean;
  createdAt?: unknown;
  tenantUploadedContractUrl?: string;
  tenantUploadedAt?: string | { toDate?: () => Date };
  tenantUploadedContractFileName?: string;
}

export default function ContractDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [contract, setContract] = useState<ContractDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'contracts', id));
        if (!snap.exists()) {
          setContract(null);
          return;
        }
        const data = snap.data();
        setContract({ id: snap.id, ...data } as ContractDoc);
      } catch (err) {
        console.error(err);
        setContract(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const exportSignature = useCallback(async (format: 'png' | 'jpeg') => {
    if (!contract?.signatureUrl || !contract?.id) return;
    try {
      const res = await fetch(contract.signatureUrl);
      const blob = await res.blob();
      const ext = format === 'jpeg' ? 'jpg' : 'png';
      const filename = `contract-${contract.id}-signature.${ext}`;
      if (format === 'png') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = contract.signatureUrl!;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (b) => {
            if (!b) return;
            const url = URL.createObjectURL(b);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
          },
          'image/jpeg',
          0.92
        );
      }
    } catch (e) {
      console.error(e);
      window.open(contract.signatureUrl!, '_blank');
    }
  }, [contract?.id, contract?.signatureUrl]);

  const downloadUploadedContract = useCallback(async () => {
    if (!contract?.tenantUploadedContractUrl || !contract?.id) return;
    try {
      const res = await fetch(contract.tenantUploadedContractUrl);
      const blob = await res.blob();
      const contentType = res.headers.get('content-type') || blob.type || '';
      let ext = 'pdf';
      if (contentType.includes('wordprocessingml') || contentType.includes('msword')) ext = 'docx';
      else if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) ext = 'jpg';
      else if (contentType.includes('image/png')) ext = 'png';
      else if (contentType.includes('image/webp')) ext = 'webp';
      else if (contentType.includes('pdf')) ext = 'pdf';
      const rawName = contract.tenantUploadedContractFileName?.trim();
      const filename = rawName
        ? rawName.replace(/^.*[/\\]/, '').replace(/[\0-\x1f\x7f]/g, '') || `tenant-signed-contract-${contract.id}.${ext}`
        : `tenant-signed-contract-${contract.id}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      window.open(contract.tenantUploadedContractUrl!, '_blank');
    }
  }, [contract?.id, contract?.tenantUploadedContractUrl, contract?.tenantUploadedContractFileName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-gray-600 mb-4">Contract not found.</p>
        <Link href="/dashboard/contracts" className="text-indigo-600 hover:text-indigo-800">
          ← Back to Contracts
        </Link>
      </div>
    );
  }

  const acknowledgedAt =
    contract.acknowledgedAt &&
    (typeof contract.acknowledgedAt === 'object' && contract.acknowledgedAt !== null && 'toDate' in contract.acknowledgedAt
      ? (contract.acknowledgedAt as { toDate: () => Date }).toDate()
      : new Date(contract.acknowledgedAt as string));
  const expiryStatus = contract.expiryDate
    ? getContractExpiryStatus(contract.expiryDate)
    : { status: 'active' as const, label: 'Active', daysRemaining: 0 };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard/contracts" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
          ← Back to Contracts
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Contract details</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {contract.tenantName} · {contract.propertyAddress || '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getExpiryBadgeClass(expiryStatus.status)}`}>
              {expiryStatus.label}
            </span>
            {(contract.acknowledged || contract.status === 'signed') && (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                Signed by tenant
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Contract document</h2>
            <a
              href={contract.contractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              View contract PDF
            </a>
          </section>

          {(contract.acknowledged || contract.status === 'signed') && (
            <section className="border-t border-gray-200 pt-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Signed by tenant</h2>
              <p className="text-sm text-gray-600 mb-2">
                This contract was signed by the tenant
                {acknowledgedAt && (
                  <> on {acknowledgedAt.toLocaleDateString()} at {acknowledgedAt.toLocaleTimeString()}</>
                )}.
              </p>
              {contract.signatureUrl && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-500 mb-2">Tenant signature</p>
                  <div className="relative w-64 h-24 bg-white border border-gray-200 rounded flex items-center justify-center overflow-hidden">
                    <Image
                      src={contract.signatureUrl}
                      alt="Tenant signature"
                      width={256}
                      height={96}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => exportSignature('png')}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Export as PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => exportSignature('jpeg')}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Export as JPG
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {contract.tenantUploadedContractUrl && (
            <section className="border-t border-gray-200 pt-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Tenant uploaded signed contract</h2>
              <p className="text-sm text-gray-600 mb-2">
                The tenant has uploaded a signed and filled contract file
                {contract.tenantUploadedAt && (
                  <> on {
                    typeof contract.tenantUploadedAt === 'object' && contract.tenantUploadedAt !== null && 'toDate' in contract.tenantUploadedAt
                      ? (contract.tenantUploadedAt as { toDate: () => Date }).toDate().toLocaleString()
                      : new Date(contract.tenantUploadedAt as string).toLocaleString()
                  }</>
                )}.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={contract.tenantUploadedContractUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
                >
                  View uploaded contract
                </a>
                <button
                  type="button"
                  onClick={downloadUploadedContract}
                  className="inline-flex items-center px-4 py-2 bg-white border border-violet-600 text-violet-600 rounded-lg hover:bg-violet-50"
                >
                  Download (PDF / Word / as submitted)
                </button>
              </div>
            </section>
          )}

          <section className="border-t border-gray-200 pt-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Summary</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-500">Tenant</dt><dd className="font-medium">{contract.tenantName}</dd></div>
              <div><dt className="text-gray-500">Property</dt><dd className="font-medium">{contract.propertyAddress || '—'}</dd></div>
              <div><dt className="text-gray-500">Term</dt><dd className="font-medium">{contract.term || '—'}</dd></div>
              <div><dt className="text-gray-500">Rent / month</dt><dd className="font-medium">{contract.rentalPerMonth != null ? `RM ${Number(contract.rentalPerMonth).toLocaleString()}` : '—'}</dd></div>
              <div><dt className="text-gray-500">Move-in date</dt><dd className="font-medium">{contract.moveInDate ? new Date(contract.moveInDate).toLocaleDateString() : '—'}</dd></div>
              <div><dt className="text-gray-500">Expiry date</dt><dd className="font-medium">{contract.expiryDate ? new Date(contract.expiryDate).toLocaleDateString() : '—'}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
