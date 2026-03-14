export type UserRole = 'admin' | 'supervisor' | 'operator';

export interface UserProfile {
  uid: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  phoneNumber?: string;
  receiveAlerts?: boolean;
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
  intervalHours: number;
  partsRequired: {
    partId: string;
    quantity: number;
  }[];
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
  usedParts?: UsedPart[];
  notes?: string;
  // Denormalized for reports
  equipmentName?: string;
  planDescription?: string;
}
