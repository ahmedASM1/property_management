export function getContractExpiryStatus(expiryDate: string): {
  status: 'expired' | 'expiring_soon' | 'active';
  daysRemaining: number;
  label: string;
} {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      status: 'expired',
      daysRemaining: Math.abs(daysRemaining),
      label: 'Expired',
    };
  }

  if (daysRemaining <= 30) {
    return {
      status: 'expiring_soon',
      daysRemaining,
      label: `Expires in ${daysRemaining} days`,
    };
  }

  return {
    status: 'active',
    daysRemaining,
    label: 'Active',
  };
}

export function getExpiryBadgeClass(status: 'expired' | 'expiring_soon' | 'active'): string {
  switch (status) {
    case 'expired':
      return 'bg-red-100 text-red-800';
    case 'expiring_soon':
      return 'bg-yellow-100 text-yellow-800';
    case 'active':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
} 