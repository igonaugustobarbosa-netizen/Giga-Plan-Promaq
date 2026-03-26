export type UserRole = 'admin' | 'supervisor' | 'operator' | 'gestor';

export interface UserProfile {
  uid: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  phoneNumber?: string;
}

export interface Equipment {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  technicalInfo: string;
  photoUrl: string;
  manualUrl: string;
  currentHours: number;
  avgHoursPerDay: number;
  currentKm?: number;
  avgKmPerDay?: number;
  customerId?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  createdAt: string;
}

export interface Part {
  id: string;
  equipmentId: string;
  name: string;
  code: string;
  cost: number;
}

export interface MaintenancePlan {
  id: string;
  equipmentId: string;
  description: string;
  workDescription?: string;
  intervalHours: number;
  partsRequired: {
    partId: string;
    quantity: number;
  }[];
  criticality: 'low' | 'medium' | 'high';
}

export type MaintenanceStatus = 'planned' | 'in-progress' | 'completed';

export interface UsedPart {
  partId: string;
  name: string;
  quantity: number;
  unitCost: number;
}

export interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  planId: string;
  status: MaintenanceStatus;
  startDate: string;
  endDate?: string;
  scheduledStartDate?: string;
  hoursPerDay?: number;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  totalPartsCost?: number;
  totalLaborCost?: number;
  hourMeter?: number;
  kmMeter?: number;
  avgHoursPerDay?: number;
  avgKmPerDay?: number;
  usedParts?: UsedPart[];
  notes?: string;
  // Denormalized for reports
  equipmentName?: string;
  planDescription?: string;
  criticality?: 'low' | 'medium' | 'high';
}

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  type: 'new' | 'maintenance' | 'alert';
  date: string;
  readBy?: string[];
  whatsappMessage?: string;
  creatorUid?: string;
}
