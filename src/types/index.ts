export type UserRole = 'admin' | 'tenant' | 'service' | 'owner';

export type RentalType = 'Room1' | 'Room2' | 'Room3' | 'Studio' | 'Whole Unit';

export interface User {
  id: string;
  email: string;
  fullName: string;
  idNumber: string;
  phoneNumber: string;
  role: UserRole;
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
  isApproved?: boolean;
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
  createdAt: any;
  updatedAt?: any;
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
  statusChangeRequest?: {
    requestedStatus: string;
    tenantName?: string;
    requestedAt?: any;
  };
  tenantDetails?: {
    fullName: string;
    phoneNumber: string;
    unitNumber?: string;
    rentalType?: RentalType;
  };
}

export interface Contract {
  id: string;
  tenantId: string;  contractUrl: string;
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
  timestamp: any; // Can be Firestore Timestamp or ISO string
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
  createdAt: any; // Firestore Timestamp
  scheduledDate?: any; // ISO string or Firestore Timestamp
  assignedTo?: string;
  assignedProviderName?: string;
  assignedAt?: any; // ISO string or Firestore Timestamp
  providerInstructions?: string;
  messages: Message[];
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