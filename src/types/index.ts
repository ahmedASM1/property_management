import { Timestamp, FieldValue } from 'firebase/firestore';

export type UserRole = 'admin' | 'tenant' | 'service_provider' | 'property_owner' | 'mixedProvider';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export type RentalType = 'Room1' | 'Room2' | 'Room3' | 'Studio' | 'Whole Unit';

export interface User {
  id: string;
  uid?: string;
  email: string;
  fullName: string;
  idNumber?: string;
  phoneNumber?: string;
  role: UserRole;
  status: UserStatus;
  contractUrl?: string;
  contractStatus?: 'Active' | 'Expiring' | 'Expired' | 'Not Available';
  contractStart?: string | Date;
  contractEnd?: string | Date;
  createdAt: Date;
  updatedAt: Date;
  unitNumber?: string;
  profileImage?: string;
  buildingName?: string;
  rentalType?: RentalType;
  serviceType?: string;
  companyName?: string;
  // Legacy field for backward compatibility
  isApproved?: boolean;
  hasSetPassword?: boolean;
  magicLinkToken?: string;
  magicLinkExpires?: string;
  passwordResetToken?: string;
  passwordResetExpires?: string;
}

export interface Tenant extends User {
  unitNumber: string;
  rentalType: RentalType;
  rentAmount: number;
  moveInDate: Date;
  moveOutDate?: Date;
  contractExpiry?: string | Date;
  outstandingAmount?: number;
  contractEnd?: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  unitNumber?: string;
  month: string;
  year: number;
  lineItems: { description: string; amount: number }[];
  tax: number;
  subtotal: number;
  totalAmount: number;
  isPaid: boolean;
  paidAt?: string;
  dueDate?: string;
  status: 'pending_payment' | 'paid' | 'unpaid' | 'overdue' | 'pending_approval' | 'queried' | 'rejected';
  createdAt: Date | string;
  updatedAt?: Date | string;
  utilities?: {
    water: number;
    electricity: number;
    internet: number;
    other?: number;
  };
  rentAmount?: number;
  receiptUrl?: string;
  // Service Provider Invoice Fields
  from?: string;
  fromId?: string;
  to?: string;
  toId?: string;
  maintenanceRequestId?: string;
  description?: string;
  invoiceDate?: string;
  issuedDate?: string;
  hiddenFor?: string[];
  statusChangeRequest?: {
    requestedStatus: string;
    tenantName?: string;
    requestedAt?: Date | string;
  } | null;
  tenantDetails?: {
    fullName: string;
    phoneNumber: string;
    unitNumber?: string;
    rentalType?: RentalType;
  };
}

export interface Contract {
  id: string;
  tenantId: string;
  tenantName: string;
  contractUrl: string;
  unitNumber?: string;
  propertyAddress: string;
  term: string;
  moveInDate: string; // or Date
  expiryDate: string; // or Date
  rentalPerMonth: number;
  securityDeposit: number;
  utilityDeposit: number;
  accessCardDeposit: number;
  agreementFee: number;
  dateOfAgreement: string; // or Date
  companySignName: string;
  companySignNRIC: string;
  companySignDesignation: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  status: 'active' | 'pending' | 'expired' | 'terminated';
  acknowledged?: boolean;
  acknowledgedAt?: Date;
  resent?: boolean;
  resentAt?: Date;
  archived?: boolean;
  archivedAt?: Date | string | FieldValue; // Firestore Timestamp
  reminderSent?: boolean;
  createdAt: Date | string | FieldValue; // Firestore Timestamp
  updatedAt: Date | string | FieldValue; // Firestore Timestamp
  agreementText?: string;
}

export interface Comment {
  id: string;
  author: 'tenant' | 'admin' | 'propertyOwner' | 'service';
  message: string;
  timestamp: Date | string; // Firestore Timestamp
}

export interface Building {
  id: string;
  name: string;
  address: string;
  totalFloors: number;
  totalUnits: number;
  description?: string;
  amenities?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Unit {
  id: string;
  buildingId: string;
  buildingName: string;
  block: string;
  floor: number;
  unitNumber: string;
  fullUnitNumber: string; // Format: A-15-02
  status: 'occupied' | 'vacant' | 'maintenance';
  monthlyRent: number;
  rentalType: RentalType;
  size?: number; // in sq ft
  bedrooms?: number;
  bathrooms?: number;
  currentTenantId?: string;
  currentTenantName?: string;
  ownerId?: string;
  amenities?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Property {
  id: string;
  propertyName: string;
  buildingName: string;
  address: string;
  unitNumber: string;
  status: 'occupied' | 'vacant';
  monthlyRent: number;
  rentalType: string;
  ownerId: string;
  currentTenantId?: string;
  pendingMaintenanceRequests?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type RequestStatus = 'pending' | 'in progress' | 'completed' | 'delayed' | 'faced an issue';

export interface Message {
  sender: string;
  text: string;
  timestamp: Date | string; // Can be Firestore Timestamp or ISO string
  senderName?: string;
}

export interface MaintenanceRequest {
  id: string;
  issueDescription: string;
  unitProperty: string;
  priority: string;
  status: RequestStatus;
  type: 'maintenance' | 'service';
  serviceType?: string;
  userId: string;
  tenantName: string;
  tenantPhone: string;
  buildingName: string;
  createdAt: Timestamp | Date;
  scheduledDate?: Timestamp | Date;
  completedAt?: Timestamp | Date;
  assignedTo?: string;
  assignedProviderName?: string;
  assignedAt?: Timestamp | Date;
  providerInstructions?: string;
  messages: {
    sender: string;
    text: string;
    timestamp: Timestamp | Date;
    senderName?: string;
  }[];
  fileUrls?: string[];
  assignedBy?: string;
  from?: string;
  fromId?: string;
  to?: string;
  toId?: string;
  maintenanceRequestId?: string;
  description?: string;
  invoiceDate?: string;
}