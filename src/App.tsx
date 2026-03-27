import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  auth, db 
} from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  onAuthStateChanged, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  Timestamp,
  collectionGroup
} from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Settings, 
  LayoutDashboard, 
  Wrench, 
  FileText, 
  Plus, 
  LogOut, 
  Search, 
  Filter,
  ChevronRight,
  Package,
  Clock,
  Navigation,
  AlertCircle,
  CheckCircle2,
  Play,
  StopCircle,
  Download,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  User as UserIcon,
  Shield,
  HardHat,
  Info,
  ShieldCheck,
  Users,
  Bell,
  QrCode,
  Printer,
  Menu,
  X,
  MessageCircle,
  RotateCcw
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addHours, isAfter, parseISO, subDays, differenceInDays } from 'date-fns';
import { UserProfile, Equipment, Part, MaintenancePlan, MaintenanceRecord, UserRole, MaintenanceStatus, AppNotification, Customer } from './types';

// --- Utilities ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo.error;
}

// --- Components ---

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 50, x: '-50%' }}
    animate={{ opacity: 1, y: 0, x: '-50%' }}
    exit={{ opacity: 0, y: 50, x: '-50%' }}
    className={`fixed bottom-8 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] border ${
      type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' :
      type === 'error' ? 'bg-red-500 text-white border-red-400' :
      'bg-zinc-900 text-white border-zinc-800'
    }`}
  >
    {type === 'success' ? <CheckCircle2 size={20} /> : type === 'error' ? <AlertCircle size={20} /> : <Bell size={20} />}
    <p className="text-sm font-bold flex-1">{message}</p>
    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
      <Plus size={16} className="rotate-45" />
    </button>
  </motion.div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button', loading = false }: any) => {
  const variants: any = {
    primary: 'bg-zinc-900 text-white hover:bg-black shadow-md shadow-zinc-200/50 active:scale-[0.98]',
    secondary: 'bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 shadow-sm active:scale-[0.98]',
    outline: 'border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 active:scale-[0.98]',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 active:scale-[0.98]',
    ghost: 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 active:scale-[0.98]'
  };
  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled || loading}
      className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : children}
    </button>
  );
};

const Card = ({ children, className = '' }: any) => (
  <div className={`bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm ${className}`}>
    {children}
  </div>
);

const Input = ({ label, ...props }: any) => (
  <div className="space-y-1.5">
    {label && <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{label}</label>}
    <input 
      {...props} 
      className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-100 focus:border-zinc-400 transition-all shadow-sm"
    />
  </div>
);

const Select = ({ label, options, ...props }: any) => (
  <div className="space-y-1.5">
    {label && <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{label}</label>}
    <div className="relative">
      <select 
        {...props} 
        className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-100 focus:border-zinc-400 transition-all appearance-none cursor-pointer shadow-sm pr-10"
      >
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
        <ChevronRight size={16} className="rotate-90" />
      </div>
    </div>
  </div>
);

const Toggle = ({ label, checked, onChange }: any) => (
  <div className="flex items-center justify-between py-2">
    {label && <span className="text-sm font-bold text-zinc-700">{label}</span>}
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-zinc-900' : 'bg-zinc-200'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  </div>
);

const Modal = ({ isOpen, onClose, title, children }: any) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <div className="p-6 border-bottom border-zinc-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <Plus className="w-5 h-5 rotate-45 text-zinc-500" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Excluir', cancelText = 'Cancelar', variant = 'danger' }: any) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title}>
    <div className="space-y-6">
      <p className="text-zinc-600 font-medium">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>{cancelText}</Button>
        <Button variant={variant} onClick={() => { onConfirm(); onClose(); }}>{confirmText}</Button>
      </div>
    </div>
  </Modal>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  // Data States
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'equipment' | 'part' | 'plan' | 'record' | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [allPlans, setAllPlans] = useState<MaintenancePlan[]>([]);
  const [initialEquipId, setInitialEquipId] = useState<string | null>(null);
  const [qrEquipId, setQrEquipId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    variant?: 'primary' | 'danger';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const sendAlert = async (description: string, title: string, type: 'new' | 'maintenance' | 'alert' = 'alert') => {
    try {
      console.log('Sending alert:', { title, description, type });
      const whatsappMessage = encodeURIComponent(`*${title}*\n\n${description}\n\n_Enviado via GIGA Plan_`);
      await addDoc(collection(db, 'notifications'), {
        title,
        description,
        type,
        date: new Date().toISOString(),
        readBy: [],
        whatsappMessage,
        creatorUid: user?.uid || 'system'
      });
    } catch (err) {
      console.error('Error sending alert:', err);
    }
  };

  const markNotificationsAsRead = async () => {
    if (!user || notifications.length === 0) return;
    const unread = notifications.filter(n => !n.readBy?.includes(user.uid));
    if (unread.length === 0) return;

    try {
      const batch = unread.map(n => 
        updateDoc(doc(db, 'notifications', n.id), {
          readBy: [...(n.readBy || []), user.uid]
        })
      );
      await Promise.all(batch);
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  // Auth Form States
  const [authError, setAuthError] = useState('');

  // Auth Effect
  useEffect(() => {
    // Tenta recuperar sessão salva localmente
    const savedUser = localStorage.getItem('giga_plan_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('giga_plan_user');
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          // Update username for Igon if necessary
          if (firebaseUser.email === 'igonaugustobarbosa@gmail.com' && userData.username !== 'igon') {
            userData.username = 'igon';
            try {
              await updateDoc(doc(db, 'users', firebaseUser.uid), { username: 'igon' });
            } catch (err) {
              console.error('Error updating Igon username:', err);
            }
          }
          setUser(userData);
          localStorage.setItem('giga_plan_user', JSON.stringify(userData));
        } else {
          const newUser: UserProfile = {
            uid: firebaseUser.uid,
            username: firebaseUser.email === 'igonaugustobarbosa@gmail.com' ? 'igon' : (firebaseUser.email || ''),
            name: firebaseUser.displayName || 'Usuário',
            role: firebaseUser.email === 'igonaugustobarbosa@gmail.com' ? 'admin' : 'operator'
          };
          try {
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
            localStorage.setItem('giga_plan_user', JSON.stringify(newUser));
          } catch (err) {
            console.error('Error creating user document:', err);
            setUser(newUser);
          }
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Handle Query Parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const equipId = params.get('equipId');
    if (equipId) {
      setInitialEquipId(equipId);
      setActiveTab('equipment');
      // Clear the param from URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Data Sync Effect
  useEffect(() => {
    if (!user) return;

    console.log('Fetching data for user:', user.username, 'Role:', user.role);

    const qEquip = query(collection(db, 'equipment'));
    const unsubEquip = onSnapshot(qEquip, (snapshot) => {
      console.log('Equipment snapshot received. Count:', snapshot.size);
      setEquipment(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Equipment)));
    }, (error) => {
      console.error('Error fetching equipment:', error);
      handleFirestoreError(error, OperationType.LIST, 'equipment');
    });

    const qRecords = query(collection(db, 'maintenance_records'));
    const unsubRecords = onSnapshot(qRecords, (snapshot) => {
      console.log('Records snapshot received. Count:', snapshot.size);
      setMaintenanceRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceRecord)));
    }, (error) => {
      console.error('Error fetching records:', error);
      handleFirestoreError(error, OperationType.LIST, 'maintenance_records');
    });

    const qCustomers = query(collection(db, 'customers'));
    const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
      console.log('Customers snapshot received. Count:', snapshot.size);
      setCustomers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    }, (error) => {
      console.error('Error fetching customers:', error);
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    return () => {
      unsubEquip();
      unsubRecords();
      unsubCustomers();
    };
  }, [user]);

  // Fetch all plans
  useEffect(() => {
    if (!user || equipment.length === 0) return;
    
    console.log('Setting up collectionGroup listener for plans...');
    let unsubGroup: (() => void) | null = null;
    let unsubFallbacks: (() => void)[] = [];

    try {
      unsubGroup = onSnapshot(collectionGroup(db, 'plans'), (snapshot) => {
        console.log('Plans snapshot received via collectionGroup. Count:', snapshot.size);
        if (snapshot.size > 0) {
          setAllPlans(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaintenancePlan)));
        } else {
          console.log('collectionGroup(plans) returned empty. Trying fallback...');
          setupFallbackListeners();
        }
      }, (error) => {
        console.error('Error in collectionGroup(plans):', error);
        setupFallbackListeners();
      });
    } catch (e) {
      console.error('Failed to setup collectionGroup listener:', e);
      setupFallbackListeners();
    }

    function setupFallbackListeners() {
      console.log('Setting up fallback listeners for each equipment plans...');
      // Clear previous fallback listeners
      unsubFallbacks.forEach(unsub => unsub());
      unsubFallbacks = [];

      const allFetchedPlans: Record<string, MaintenancePlan[]> = {};

      equipment.forEach(equip => {
        const q = query(collection(db, 'equipment', equip.id, 'plans'));
        const unsub = onSnapshot(q, (snapshot) => {
          allFetchedPlans[equip.id] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaintenancePlan));
          
          // Flatten and update state
          const flattened = Object.values(allFetchedPlans).flat();
          setAllPlans(flattened);
        });
        unsubFallbacks.push(unsub);
      });
    }

    return () => {
      if (unsubGroup) unsubGroup();
      unsubFallbacks.forEach(unsub => unsub());
    };
  }, [user, equipment]);

  // Notifications Listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notifications'), orderBy('date', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
      console.log('Notifications received:', data.length);
      setNotifications(data);
    });
    return () => unsubscribe();
  }, [user]);

  // Toast for new notifications
  useEffect(() => {
    if (!user || notifications.length === 0) return;
    const latest = notifications[0];
    const isNew = (new Date().getTime() - new Date(latest.date).getTime()) < 5000;
    
    if (isNew && latest.creatorUid !== user.uid && !latest.readBy?.includes(user.uid)) {
      showToast(`${latest.title}`, 'info');
    }
  }, [notifications, user]);  const generateServiceOrderPDF = (record: MaintenanceRecord) => {
    const doc = new jsPDF();
    const equip = equipment.find(e => e.id === record.equipmentId);
    const plan = allPlans.find(p => p.id === record.planId);
    const isOperator = user?.role === 'operator';

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40);
    doc.text('GIGA Plan Promaq - Ordem de Serviço', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`OS ID: ${record.id}`, 14, 30);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 35);

    // Equipment Info
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Informações do Equipamento', 14, 45);
    doc.setFontSize(10);
    doc.text(`Nome: ${record.equipmentName}`, 14, 52);
    doc.text(`Modelo: ${equip?.model || 'N/A'}`, 14, 57);
    doc.text(`Série: ${equip?.serialNumber || 'N/A'}`, 14, 62);
    doc.text(`Horímetro: ${equip?.currentHours || 0}h`, 14, 67);
    doc.text(`KM: ${equip?.currentKm || 0}km`, 14, 72);

    let currentY = 77;

    // Company Info
    const company = customers.find(c => c.id === equip?.customerId);
    if (company) {
      doc.text(`Empresa: ${company.name}`, 14, currentY);
      doc.text(`Contato: ${company.phone}`, 14, currentY + 5);
      currentY += 15;
    } else {
      currentY += 5;
    }

    // Add Equipment Image if available
    if (equip?.photoUrl) {
      try {
        const format = equip.photoUrl.includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(equip.photoUrl, format, 140, 35, 50, 35);
      } catch (e) {
        console.warn('Could not add equipment image to PDF:', e);
      }
    }

    // Maintenance Info
    doc.setFontSize(14);
    doc.text('Detalhes da Manutenção', 14, currentY);
    doc.setFontSize(10);
    doc.text(`Plano: ${record.planDescription}`, 14, currentY + 7);
    
    let maintenanceY = currentY + 12;
    if (record.criticality) {
      doc.text(`Criticidade: ${record.criticality === 'high' ? 'Alta' : record.criticality === 'medium' ? 'Média' : 'Baixa'}`, 14, maintenanceY);
      doc.text(`Status: ${record.status === 'in-progress' ? 'Em Andamento' : record.status === 'completed' ? 'Concluída' : 'Programada'}`, 14, maintenanceY + 5);
      doc.text(`Data de Início: ${format(parseISO(record.startDate), 'dd/MM/yyyy HH:mm')}`, 14, maintenanceY + 10);
      maintenanceY += 15;
    } else {
      doc.text(`Status: ${record.status === 'in-progress' ? 'Em Andamento' : record.status === 'completed' ? 'Concluída' : 'Programada'}`, 14, maintenanceY);
      doc.text(`Data de Início: ${format(parseISO(record.startDate), 'dd/MM/yyyy HH:mm')}`, 14, maintenanceY + 5);
      maintenanceY += 10;
    }
    
    if (record.scheduledStartDate) {
      doc.text(`Programado para: ${format(parseISO(record.scheduledStartDate + 'T00:00:00'), 'dd/MM/yyyy')}`, 14, maintenanceY);
      maintenanceY += 7;
    }

    currentY = maintenanceY;

    // Work Description from Plan
    if (plan?.workDescription) {
      currentY += 5;
      doc.setFontSize(14);
      doc.text('Trabalhos a serem Realizados', 14, currentY);
      doc.setFontSize(10);
      const splitWork = doc.splitTextToSize(plan.workDescription, 180);
      doc.text(splitWork, 14, currentY + 7);
      currentY += 10 + (splitWork.length * 5);
    } else {
      currentY += 5;
    }

    // Parts
    if (record.usedParts && record.usedParts.length > 0) {
      doc.setFontSize(14);
      doc.text('Peças Utilizadas', 14, currentY);
      
      const partsHead = isOperator 
        ? [['Peça', 'Quantidade']]
        : [['Peça', 'Quantidade', 'Custo Unit.', 'Total']];
      
      const partsBody = record.usedParts.map(p => {
        const base = [p.name, p.quantity.toString()];
        if (isOperator) return base;
        return [...base, `R$ ${p.unitCost.toFixed(2)}`, `R$ ${(p.unitCost * p.quantity).toFixed(2)}` ];
      });

      autoTable(doc, {
        startY: currentY + 5,
        head: partsHead,
        body: partsBody,
        theme: 'striped',
        headStyles: { fillColor: [0, 0, 0] },
        styles: { fontSize: 8 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    } else {
      currentY += 10;
    }

    // Costs Summary
    if (!isOperator) {
      doc.setFontSize(14);
      doc.text('Resumo de Custos', 14, currentY);
      doc.setFontSize(10);
      doc.text(`Custo de Peças: R$ ${(record.totalPartsCost || 0).toFixed(2)}`, 14, currentY + 7);
      doc.text(`Custo de Mão de Obra: R$ ${(record.totalLaborCost || 0).toFixed(2)}`, 14, currentY + 12);
      doc.setFontSize(12);
      doc.text(`TOTAL GERAL: R$ ${((record.totalPartsCost || 0) + (record.totalLaborCost || 0)).toFixed(2)}`, 14, currentY + 20);
      currentY += 30;
    }

    // Notes
    if (record.notes) {
      doc.setFontSize(14);
      doc.text('Observações Técnicas', 14, currentY);
      doc.setFontSize(10);
      const splitNotes = doc.splitTextToSize(record.notes, 180);
      doc.text(splitNotes, 14, currentY + 7);
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      const footerText = 'Desenvolvedor: Giga Elétrica | Contato: 43 996118806 | Joaquim Távora - PR';
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
      doc.text(footerText, 14, pageHeight - 10);
    }

    doc.save(`OS-${record.id}-${record.equipmentName}.pdf`);
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Google Auth error:', error);
      let message = error.message;
      if (error.code === 'auth/popup-closed-by-user') message = 'Login cancelado pelo usuário.';
      if (error.code === 'auth/cancelled-popup-request') message = 'Solicitação de login cancelada.';
      setAuthError(message);
    }
  };

  const handleDeleteMaintenance = async (id: string) => {
    if (user?.role === 'supervisor') {
      showToast("Supervisores não têm permissão para excluir registros de manutenção.", "error");
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Registro',
      message: 'Tem certeza que deseja excluir este registro de manutenção?',
      onConfirm: async () => {
        try {
          const record = maintenanceRecords.find(r => r.id === id);
          await deleteDoc(doc(db, 'maintenance_records', id));
          if (record) {
            await sendAlert(`Manutenção excluída: ${record.planDescription} para ${record.equipmentName}`, '🗑️ MANUTENÇÃO EXCLUÍDA', 'alert');
          }
          showToast('Registro excluído com sucesso.', 'success');
        } catch (err: any) {
          handleFirestoreError(err, OperationType.DELETE, 'maintenance_records');
        }
      }
    });
  };

  const handleTestLogin = (role: UserRole) => {
    const mockUser: UserProfile = {
      uid: `test-${role}`,
      username: `test-${role}`,
      name: `Usuário Teste (${role === 'admin' ? 'Admin' : role === 'supervisor' ? 'Supervisor' : role === 'gestor' ? 'Gestor' : 'Operador'})`,
      role: role
    };
    setUser(mockUser);
  };

  const [showPassword, setShowPassword] = useState(false);

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    const username = loginForm.username.trim().toLowerCase();
    const password = loginForm.password.trim();
    
    if (username === 'administrador' && password === '123456') {
      const adminUser: UserProfile = {
        uid: 'local-admin',
        username: 'administrador',
        name: 'Administrador GIGA',
        role: 'admin'
      };
      setUser(adminUser);
      localStorage.setItem('giga_plan_user', JSON.stringify(adminUser));
      return;
    }

    if (username === 'gestor' && password === 'gestor2026') {
      const gestorUser: UserProfile = {
        uid: 'local-gestor',
        username: 'gestor',
        name: 'Gestor GIGA',
        role: 'gestor'
      };
      setUser(gestorUser);
      localStorage.setItem('giga_plan_user', JSON.stringify(gestorUser));
      return;
    }

    try {
      const q = query(collection(db, 'users'), where('username', '==', username));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        throw new Error('Usuário não encontrado.');
      }

      const userData = snapshot.docs[0].data() as UserProfile;
      
      if (userData.password !== password) {
        throw new Error('Senha incorreta.');
      }

      setUser(userData);
      localStorage.setItem('giga_plan_user', JSON.stringify(userData));
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao realizar login.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('giga_plan_user');
    if (user?.uid.startsWith('local-') || user?.uid.startsWith('test-')) {
      setUser(null);
    } else {
      signOut(auth);
      setUser(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-zinc-200 border-t-black rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-medium animate-pulse">GIGA Plan Promaq carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 space-y-8">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mx-auto shadow-xl rotate-3">
              <Wrench className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">GIGA Plan Promaq</h1>
              <p className="text-zinc-500 font-medium">Desenvolvedor: 43 996118806</p>
            </div>
          </div>

          <form onSubmit={handleCustomLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Usuário</label>
              <Input 
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                placeholder="Digite o usuário" 
                className="py-6"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Senha</label>
              <div className="relative">
                <Input 
                  type={showPassword ? "text" : "password"}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  placeholder="Digite a senha" 
                  className="py-6 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            {authError && (
              <p className="text-red-500 text-xs font-medium text-center bg-red-50 p-3 rounded-xl border border-red-100">
                {authError}
              </p>
            )}

            <Button type="submit" className="w-full py-6 text-lg bg-black text-white hover:bg-zinc-800 shadow-lg">
              Entrar no Sistema
            </Button>
            <p className="text-[10px] text-zinc-400 text-center italic">
              Dica: "administrador" (123456) ou "gestor" (gestor2026)
            </p>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 text-zinc-300 font-bold tracking-widest">Ou</span>
            </div>
          </div>

          <Button onClick={handleGoogleLogin} variant="outline" className="w-full py-6 flex items-center justify-center gap-3 border-zinc-200 hover:bg-zinc-50">
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Entrar com Google
          </Button>

          <p className="text-[10px] text-zinc-300 text-center mt-8 uppercase tracking-tighter font-bold">
            GIGA Plan Promaq v2.0 • 2026
          </p>
        </Card>
      </div>
    );
  }

  // Acesso direto habilitado
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex overflow-x-hidden">
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-zinc-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-screen
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight leading-tight">GIGA Plan</span>
              <span className="text-[10px] text-zinc-400 font-medium">Promaq v2.0</span>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
          />
          <NavItem 
            active={activeTab === 'equipment'} 
            onClick={() => { setActiveTab('equipment'); setIsSidebarOpen(false); }} 
            icon={<HardHat size={20} />} 
            label="Equipamentos" 
          />
          <NavItem 
            active={activeTab === 'customers'} 
            onClick={() => { setActiveTab('customers'); setIsSidebarOpen(false); }} 
            icon={<Users size={20} />} 
            label="Empresas" 
          />
          <NavItem 
            active={activeTab === 'maintenance'} 
            onClick={() => { setActiveTab('maintenance'); setIsSidebarOpen(false); }} 
            icon={<Clock size={20} />} 
            label="Manutenções" 
          />
          <NavItem 
            active={activeTab === 'parts'} 
            onClick={() => { setActiveTab('parts'); setIsSidebarOpen(false); }} 
            icon={<Package size={20} />} 
            label="Peças" 
          />
          <NavItem 
            active={activeTab === 'reports'} 
            onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }} 
            icon={<FileText size={20} />} 
            label="Relatórios" 
          />
          {(user.role === 'admin' || user.role === 'gestor') && (
            <NavItem 
              active={activeTab === 'users'} 
              onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }} 
              icon={<UserIcon size={20} />} 
              label="Usuários" 
            />
          )}
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 mb-3">
            <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center overflow-hidden">
              <UserIcon className="text-zinc-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user.name}</p>
              <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">{user.role}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-red-500 hover:bg-red-50 hover:text-red-600" onClick={handleLogout}>
            <LogOut size={18} /> Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <header className="h-16 bg-white border-b border-zinc-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg lg:hidden"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-bold text-zinc-900">
              {activeTab === 'dashboard' ? 'Dashboard' :
               activeTab === 'equipment' ? 'Equipamentos' :
               activeTab === 'customers' ? 'Empresas' :
               activeTab === 'maintenance' ? 'Manutenções' :
               activeTab === 'parts' ? 'Peças' :
               activeTab === 'reports' ? 'Relatórios' : 'Usuários'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-zinc-100 border-none rounded-full text-sm focus:ring-2 focus:ring-black/5 w-64"
              />
            </div>

            <div className="relative">
              <button 
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  if (!isNotificationsOpen) markNotificationsAsRead();
                }}
                className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg relative group"
              >
                <Bell size={20} className={notifications.filter(n => !n.readBy?.includes(user.uid)).length > 0 ? 'text-zinc-900' : 'text-zinc-500'} />
                {notifications.filter(n => !n.readBy?.includes(user.uid)).length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsNotificationsOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-zinc-100 z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                        <h3 className="font-bold text-zinc-900">Notificações</h3>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          {notifications.length} Total
                        </span>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <Bell className="mx-auto text-zinc-200 mb-2" size={32} />
                            <p className="text-sm text-zinc-500">Nenhuma notificação</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div 
                              key={n.id}
                              className={`p-4 border-b border-zinc-50 hover:bg-zinc-50 transition-colors relative group ${!n.readBy?.includes(user.uid) ? 'bg-zinc-50/50' : ''}`}
                            >
                              <div className="flex gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                  n.type === 'new' ? 'bg-emerald-100 text-emerald-600' :
                                  n.type === 'maintenance' ? 'bg-blue-100 text-blue-600' :
                                  'bg-amber-100 text-amber-600'
                                }`}>
                                  {n.type === 'new' ? <Plus size={14} /> : 
                                   n.type === 'maintenance' ? <Wrench size={14} /> : 
                                   <AlertCircle size={14} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-zinc-900">{n.title}</p>
                                  <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{n.description}</p>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-[10px] text-zinc-400 font-medium">
                                      {format(new Date(n.date), 'dd/MM/yyyy HH:mm')}
                                    </span>
                                    <a 
                                      href={`https://wa.me/?text=${n.whatsappMessage}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm"
                                      title="Enviar via WhatsApp"
                                    >
                                      <MessageCircle size={12} />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard equipment={equipment} records={maintenanceRecords} user={user} onDeleteRecord={handleDeleteMaintenance} allPlans={allPlans} searchTerm={searchTerm} showToast={showToast} notifications={notifications} onGeneratePDF={generateServiceOrderPDF} />}
          {activeTab === 'equipment' && <EquipmentSection equipment={equipment} records={maintenanceRecords} user={user} initialEquipId={initialEquipId} onClearInitialId={() => setInitialEquipId(null)} searchTerm={searchTerm} showToast={showToast} setConfirmModal={setConfirmModal} sendAlert={sendAlert} onGeneratePDF={generateServiceOrderPDF} customers={customers} />}
          {activeTab === 'customers' && <CustomersSection customers={customers} user={user} searchTerm={searchTerm} showToast={showToast} setConfirmModal={setConfirmModal} sendAlert={sendAlert} />}
          {activeTab === 'maintenance' && <MaintenanceSection equipment={equipment} records={maintenanceRecords} user={user} onDeleteRecord={handleDeleteMaintenance} searchTerm={searchTerm} sendAlert={sendAlert} onGeneratePDF={generateServiceOrderPDF} qrEquipId={qrEquipId} onClearQrFilter={() => setQrEquipId(null)} />}
          {activeTab === 'parts' && <PartsSection equipment={equipment} user={user} searchTerm={searchTerm} />}
          {activeTab === 'reports' && <ReportsSection equipment={equipment} records={maintenanceRecords} user={user} onDeleteRecord={handleDeleteMaintenance} searchTerm={searchTerm} customers={customers} />}
          {activeTab === 'users' && <UsersSection user={user} searchTerm={searchTerm} showToast={showToast} setConfirmModal={setConfirmModal} sendAlert={sendAlert} />}
        </div>

        <AnimatePresence>
          {toast && (
            <Toast 
              message={toast.message} 
              type={toast.type} 
              onClose={() => setToast(null)} 
            />
          )}
        </AnimatePresence>

        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
          confirmText={confirmModal.confirmText}
          variant={confirmModal.variant}
        />
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
        active 
          ? 'bg-black text-white shadow-lg shadow-black/10 translate-x-1' 
          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// --- Sections ---

function Dashboard({ equipment, records, user, onDeleteRecord, allPlans, searchTerm, showToast, notifications, onGeneratePDF }: { equipment: Equipment[], records: MaintenanceRecord[], user: UserProfile, onDeleteRecord: (id: string) => void, allPlans: MaintenancePlan[], searchTerm: string, showToast: (m: string, t?: any) => void, notifications: AppNotification[], onGeneratePDF: (r: MaintenanceRecord) => void }) {
  const activeMaintenances = records.filter(r => r.status === 'in-progress');
  
  // Calculate due maintenances
  const dueMaintenances = equipment.flatMap(equip => {
    const equipPlans = allPlans.filter(p => p.equipmentId === equip.id);
    return equipPlans.map(plan => {
      const planRecords = records.filter(r => r.planId === plan.id && r.status === 'completed');
      const lastRecord = planRecords.sort((a, b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime())[0];
      const lastHourMeter = lastRecord?.hourMeter || 0;
      const nextMaintenanceHour = lastHourMeter + plan.intervalHours;
      const remainingHours = nextMaintenanceHour - (equip.currentHours || 0);
      
      let isDue = false;
      let daysRemaining = null;

      if (equip.avgHoursPerDay && equip.avgHoursPerDay > 0) {
        daysRemaining = Math.ceil(remainingHours / equip.avgHoursPerDay);
        isDue = daysRemaining <= 7;
      } else {
        isDue = remainingHours <= plan.intervalHours * 0.1 || remainingHours <= 10;
      }
      
      return {
        equip,
        equipName: equip.name,
        equipModel: equip.model,
        equipSerial: equip.serialNumber,
        planDescription: plan.description,
        remainingHours,
        daysRemaining,
        isDue
      };
    }).filter(d => d.isDue);
  }).filter(d => 
    d.equipName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.planDescription.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Equipamentos" value={equipment.length} icon={<HardHat className="text-blue-500" />} />
        <StatCard label="Em Manutenção" value={activeMaintenances.length} icon={<Clock className="text-orange-500" />} />
        <StatCard label="Concluídas (Mês)" value={records.filter(r => r.status === 'completed').length} icon={<CheckCircle2 className="text-emerald-500" />} />
      </div>

      {dueMaintenances.length > 0 && (
        <Card className="p-6 border-red-100 bg-red-50/30">
          <div className="flex items-center gap-2 text-red-600 mb-4">
            <AlertCircle size={20} />
            <h3 className="font-bold">Atenção: Vencimentos Próximos</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dueMaintenances.map((d, i) => (
              <div key={i} className="p-3 bg-white rounded-lg border border-red-100 shadow-sm">
                <p className="font-bold text-zinc-900 text-sm">{d.equipName}</p>
                <p className="text-xs text-zinc-500">{d.planDescription}</p>
                <p className="text-xs font-bold text-red-600 mt-1">
                  {d.daysRemaining !== null 
                    ? `${d.daysRemaining <= 0 ? 'ATRASADA' : `Vence em ~${d.daysRemaining} dias`}` 
                    : `${d.remainingHours.toFixed(1)}h para o limite`}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-zinc-900">Manutenções em Andamento</h3>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Tempo Real</span>
          </div>
          <div className="space-y-4">
            {activeMaintenances.length > 0 ? activeMaintenances.map(record => (
              <div key={record.id} className="flex items-center gap-4 p-4 rounded-xl bg-orange-50 border border-orange-100">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  <Clock className="text-orange-600" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-zinc-900 truncate">{record.equipmentName}</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-xs text-orange-600 font-medium truncate flex-1 min-w-0">{record.planDescription}</p>
                    {record.criticality && (
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0 ${
                        record.criticality === 'high' ? 'text-red-600 bg-red-50 border-red-100' : 
                        record.criticality === 'medium' ? 'text-orange-600 bg-orange-50 border-orange-100' : 
                        'text-blue-600 bg-blue-50 border-blue-100'
                      }`}>
                        {record.criticality === 'high' ? 'Alta' : record.criticality === 'medium' ? 'Média' : 'Baixa'}
                      </span>
                    )}
                  </div>
                </div>
                  <div className="text-right flex items-center gap-3 shrink-0">
                    <div className="flex gap-4">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">Programado</p>
                        <p className="text-sm font-bold text-zinc-600">
                          {record.scheduledStartDate ? format(parseISO(record.scheduledStartDate + 'T00:00:00'), 'dd/MM/yyyy') : '--/--/----'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">Início</p>
                        <p className="text-sm font-bold">{format(parseISO(record.startDate), 'HH:mm')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <button 
                        onClick={() => onGeneratePDF(record)}
                        className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Gerar PDF Ordem de Serviço"
                      >
                        <FileText size={18} />
                      </button>
                      {user.role !== 'operator' && user.role !== 'supervisor' && (
                        <button 
                          onClick={() => onDeleteRecord(record.id)}
                          className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir Manutenção"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
              </div>
            )) : (
              <div className="py-12 text-center text-zinc-400">
                <Info className="mx-auto mb-2 opacity-20" size={32} />
                <p>Nenhuma manutenção em andamento.</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-zinc-900">Notificações Recentes</h3>
            <Bell className="text-zinc-300" size={20} />
          </div>
          <div className="space-y-4">
            {notifications.slice(0, 5).map(n => (
              <div key={n.id} className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${n.type === 'alert' ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{n.title}</p>
                </div>
                <p className="text-xs text-zinc-600 line-clamp-2">{n.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-zinc-400">{format(parseISO(n.date), 'dd/MM HH:mm')}</p>
                  {n.whatsappMessage && (
                    <a 
                      href={`https://wa.me/?text=${n.whatsappMessage}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-500 hover:text-emerald-600"
                    >
                      <MessageCircle size={14} />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <p className="text-center py-8 text-zinc-400 text-sm">Sem notificações</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-zinc-900">Equipamentos Críticos</h3>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Status</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipment.slice(0, 6).map(item => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-zinc-100 hover:border-zinc-200 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-zinc-100 flex items-center justify-center overflow-hidden">
                    {item.photoUrl ? <img src={item.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <HardHat className="text-zinc-400" />}
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900">{item.name}</p>
                    <p className="text-xs text-zinc-500">{item.model} • {item.serialNumber}</p>
                  </div>
                </div>
                <ChevronRight className="text-zinc-300" size={20} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: any) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-zinc-50">{icon}</div>
      </div>
      <p className="text-3xl font-bold text-zinc-900">{value}</p>
      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">{label}</p>
    </Card>
  );
}

function EquipmentSection({ equipment, records, user, initialEquipId, onClearInitialId, searchTerm, showToast, setConfirmModal, sendAlert, onGeneratePDF, customers }: { equipment: Equipment[], records: MaintenanceRecord[], user: UserProfile, initialEquipId?: string | null, onClearInitialId?: () => void, searchTerm: string, showToast: (m: string, t?: any) => void, setConfirmModal: any, sendAlert: any, onGeneratePDF: (r: MaintenanceRecord) => void, customers: Customer[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [viewingItem, setViewingItem] = useState<Equipment | null>(null);
  const [qrCodeItem, setQrCodeItem] = useState<Equipment | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  
  const [photoSource, setPhotoSource] = useState<'url' | 'file'>('url');
  const [manualSource, setManualSource] = useState<'url' | 'file'>('url');
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [manualBase64, setManualBase64] = useState<string>('');

  const filteredEquipment = equipment.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.model && item.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.serialNumber && item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    if (initialEquipId && equipment.length > 0) {
      const equip = equipment.find(e => e.id === initialEquipId);
      if (equip) {
        setViewingItem(equip);
        onClearInitialId?.();
      }
    }
  }, [initialEquipId, equipment]);

  useEffect(() => {
    if (isModalOpen) {
      const isPhotoBase64 = editingItem?.photoUrl?.startsWith('data:');
      const isManualBase64 = editingItem?.manualUrl?.startsWith('data:');
      
      setPhotoSource(isPhotoBase64 ? 'file' : 'url');
      setManualSource(isManualBase64 ? 'file' : 'url');
      setPhotoBase64(editingItem?.photoUrl || '');
      setManualBase64(editingItem?.manualUrl || '');
    }
  }, [isModalOpen, editingItem]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'manual') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) {
        showToast("Arquivo muito grande. O limite é de aproximadamente 800KB.", "error");
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'photo') setPhotoBase64(reader.result as string);
        else setManualBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      model: formData.get('model') as string,
      serialNumber: formData.get('serialNumber') as string,
      technicalInfo: formData.get('technicalInfo') as string,
      customerId: formData.get('customerId') as string || null,
      photoUrl: photoSource === 'file' ? photoBase64 : formData.get('photoUrl') as string,
      manualUrl: manualSource === 'file' ? manualBase64 : formData.get('manualUrl') as string,
      currentHours: Number(formData.get('currentHours')),
      avgHoursPerDay: Number(formData.get('avgHoursPerDay')),
      currentKm: Number(formData.get('currentKm')),
      avgKmPerDay: Number(formData.get('avgKmPerDay')),
      createdAt: editingItem?.createdAt || new Date().toISOString()
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'equipment', editingItem.id), data);
        await sendAlert(`Equipamento atualizado: ${data.name} (${data.model})`, '🚜 EQUIPAMENTO ATUALIZADO', 'new');
      } else {
        await addDoc(collection(db, 'equipment'), data);
        await sendAlert(`Novo equipamento cadastrado: ${data.name} (${data.model})`, '🚜 NOVO EQUIPAMENTO', 'new');
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error: any) {
      const msg = handleFirestoreError(error, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'equipment');
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Equipamento',
      message: 'Tem certeza que deseja excluir este equipamento?',
      onConfirm: async () => {
        try {
          const equip = equipment.find(e => e.id === id);
          await deleteDoc(doc(db, 'equipment', id));
          if (equip) {
            await sendAlert(`Equipamento excluído: ${equip.name} (${equip.model})`, '🗑️ EQUIPAMENTO EXCLUÍDO', 'alert');
          }
          showToast('Equipamento excluído com sucesso.', 'success');
        } catch (error) {
          console.error('Error deleting equipment:', error);
          showToast('Erro ao excluir equipamento.', 'error');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-zinc-900">Cadastro de Equipamentos</h3>
          <p className="text-zinc-500">Gerencie o inventário de máquinas e ativos industriais.</p>
        </div>
        {user.role !== 'operator' && (
          <Button onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
            <Plus size={20} /> Novo Equipamento
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEquipment.map(item => (
          <Card key={item.id} className="group">
            <div className="h-48 bg-zinc-100 relative overflow-hidden">
              {item.photoUrl ? (
                <img src={item.photoUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-300">
                  <HardHat size={48} />
                </div>
              )}
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button 
                  onClick={() => setViewingItem(item)}
                  className="p-2 bg-white/90 backdrop-blur rounded-lg shadow-lg text-zinc-700 hover:bg-white transition-all hover:scale-110"
                  title="Ver Detalhes"
                >
                  <Eye size={16} />
                </button>
                <button 
                  onClick={() => setQrCodeItem(item)}
                  className="p-2 bg-white/90 backdrop-blur rounded-lg shadow-lg text-zinc-700 hover:bg-white transition-all hover:scale-110"
                  title="Gerar QR Code"
                >
                  <QrCode size={16} />
                </button>
                {user.role !== 'operator' && (
                  <>
                    <button 
                      onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                      className="p-2 bg-white/90 backdrop-blur rounded-lg shadow-lg text-zinc-700 hover:bg-white transition-all hover:scale-110"
                      title="Editar"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 bg-white/90 backdrop-blur rounded-lg shadow-lg text-red-600 hover:bg-white transition-all hover:scale-110"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-zinc-900 text-lg">{item.name}</h4>
                <span className="px-2 py-1 bg-zinc-100 text-zinc-500 text-[10px] font-bold rounded uppercase tracking-wider">{item.model}</span>
              </div>
              <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{item.technicalInfo || 'Sem informações técnicas cadastradas.'}</p>
              <div className="flex items-center justify-between pt-4 border-t border-zinc-100 gap-4">
                <div className="flex items-center gap-2 text-zinc-400 min-w-0">
                  <Package size={14} className="shrink-0" />
                  <span className="text-xs font-medium truncate">S/N: {item.serialNumber}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400 shrink-0">
                  <Clock size={14} />
                  <span className="text-xs font-medium">{item.currentHours || 0}h</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400 shrink-0">
                  <Navigation size={14} />
                  <span className="text-xs font-medium">{item.currentKm || 0}km</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingItem ? 'Editar Equipamento' : 'Novo Equipamento'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nome da Máquina" name="name" defaultValue={editingItem?.name} required />
            <Input label="Modelo" name="model" defaultValue={editingItem?.model} />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Select 
              label="Empresa" 
              name="customerId" 
              defaultValue={editingItem?.customerId || ''}
              options={[
                { value: '', label: 'Nenhuma Empresa' },
                ...customers.map(c => ({ value: c.id, label: c.name }))
              ]}
            />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Input label="Número de Série" name="serialNumber" defaultValue={editingItem?.serialNumber} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Horímetro Atual (h)" name="currentHours" type="number" defaultValue={editingItem?.currentHours || 0} required />
            <Input label="Média de Uso (h/dia)" name="avgHoursPerDay" type="number" step="0.1" defaultValue={editingItem?.avgHoursPerDay || 0} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="KM Atual" name="currentKm" type="number" defaultValue={editingItem?.currentKm || 0} />
            <Input label="Média de Uso (km/dia)" name="avgKmPerDay" type="number" step="0.1" defaultValue={editingItem?.avgKmPerDay || 0} />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Foto do Equipamento</label>
              <div className="flex bg-zinc-100 p-1 rounded-lg">
                <button 
                  type="button"
                  onClick={() => setPhotoSource('url')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${photoSource === 'url' ? 'bg-white shadow-sm text-black' : 'text-zinc-500'}`}
                >URL</button>
                <button 
                  type="button"
                  onClick={() => setPhotoSource('file')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${photoSource === 'file' ? 'bg-white shadow-sm text-black' : 'text-zinc-500'}`}
                >ARQUIVO</button>
              </div>
            </div>
            {photoSource === 'url' ? (
              <Input name="photoUrl" defaultValue={editingItem?.photoUrl} placeholder="https://..." />
            ) : (
              <div className="space-y-2">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'photo')}
                  className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
                />
                {photoBase64 && (
                  <div className="h-20 w-20 rounded-lg overflow-hidden border border-zinc-200">
                    <img src={photoBase64} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Manual Técnico (PDF)</label>
              <div className="flex bg-zinc-100 p-1 rounded-lg">
                <button 
                  type="button"
                  onClick={() => setManualSource('url')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${manualSource === 'url' ? 'bg-white shadow-sm text-black' : 'text-zinc-500'}`}
                >URL</button>
                <button 
                  type="button"
                  onClick={() => setManualSource('file')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${manualSource === 'file' ? 'bg-white shadow-sm text-black' : 'text-zinc-500'}`}
                >ARQUIVO</button>
              </div>
            </div>
            {manualSource === 'url' ? (
              <Input name="manualUrl" defaultValue={editingItem?.manualUrl} placeholder="https://..." />
            ) : (
              <div className="space-y-2">
                <input 
                  type="file" 
                  accept=".pdf"
                  onChange={(e) => handleFileChange(e, 'manual')}
                  className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
                />
                {manualBase64 && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 size={14} /> PDF Carregado
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Informações Técnicas</label>
            <textarea 
              name="technicalInfo" 
              defaultValue={editingItem?.technicalInfo}
              rows={4}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
            />
          </div>

          {saveError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium">
              Erro ao salvar: {saveError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Equipamento'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        isOpen={!!qrCodeItem}
        onClose={() => setQrCodeItem(null)}
        title={`QR Code - ${qrCodeItem?.name}`}
      >
        <div className="flex flex-col items-center justify-center p-8 space-y-6">
          <div className="p-4 bg-white rounded-2xl shadow-xl border border-zinc-100">
            {qrCodeItem && (
              <QRCodeSVG 
                id="equipment-qrcode"
                value={`${window.location.origin}?equipId=${qrCodeItem.id}`}
                size={256}
                level="H"
                includeMargin={true}
              />
            )}
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-zinc-600">Escaneie para acessar os dados do equipamento</p>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{qrCodeItem?.serialNumber}</p>
          </div>
          <div className="flex gap-3 w-full">
            <Button 
              variant="secondary" 
              className="flex-1"
              onClick={() => {
                const svg = document.getElementById('equipment-qrcode');
                if (svg) {
                  const svgData = new XMLSerializer().serializeToString(svg);
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  const img = new Image();
                  img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx?.drawImage(img, 0, 0);
                    const pngFile = canvas.toDataURL('image/png');
                    const downloadLink = document.createElement('a');
                    downloadLink.download = `qrcode-${qrCodeItem?.name}.png`;
                    downloadLink.href = pngFile;
                    downloadLink.click();
                  };
                  img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                }
              }}
            >
              <Download size={16} /> Baixar
            </Button>
            <Button 
              className="flex-1 bg-black text-white hover:bg-zinc-800"
              onClick={() => {
                const svg = document.getElementById('equipment-qrcode');
                if (svg) {
                  const svgData = new XMLSerializer().serializeToString(svg);
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Imprimir QR Code - ${qrCodeItem?.name}</title>
                          <style>
                            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; }
                            .container { text-align: center; border: 1px solid #eee; padding: 40px; border-radius: 20px; }
                            h1 { margin-bottom: 10px; font-size: 24px; }
                            p { color: #666; margin-bottom: 30px; }
                            .serial { font-weight: bold; color: #999; text-transform: uppercase; letter-spacing: 2px; font-size: 12px; }
                            @media print {
                              button { display: none; }
                            }
                          </style>
                        </head>
                        <body>
                          <div class="container">
                            <h1>${qrCodeItem?.name}</h1>
                            <p>${qrCodeItem?.model || ''}</p>
                            ${svgData}
                            <div style="margin-top: 20px;" class="serial">${qrCodeItem?.serialNumber || ''}</div>
                          </div>
                          <script>
                            setTimeout(() => {
                              window.print();
                              window.close();
                            }, 500);
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }
                }
              }}
            >
              <Printer size={16} /> Imprimir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Detail View Modal */}
      <Modal 
        isOpen={!!viewingItem} 
        onClose={() => setViewingItem(null)} 
        title="Detalhes do Equipamento"
      >
        {viewingItem && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-zinc-900">{viewingItem.name}</h4>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">{viewingItem.model}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => setQrCodeItem(viewingItem)}
              >
                <QrCode size={14} /> QR Code
              </Button>
            </div>
            <div className="aspect-video bg-zinc-100 rounded-xl overflow-hidden">
              {viewingItem.photoUrl ? (
                <img src={viewingItem.photoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-300">
                  <HardHat size={64} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Horímetro Atual</h5>
                <p className="font-medium">{viewingItem.currentHours || 0} horas</p>
              </div>
              <div>
                <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Média de Uso</h5>
                <p className="font-medium">{viewingItem.avgHoursPerDay || 0} h/dia</p>
              </div>
              <div>
                <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Modelo</h5>
                <p className="font-medium">{viewingItem.model || 'N/A'}</p>
              </div>
              <div>
                <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">S/N</h5>
                <p className="font-medium">{viewingItem.serialNumber || 'N/A'}</p>
              </div>
              <div>
                <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Manual</h5>
                {viewingItem.manualUrl ? (
                  <a href={viewingItem.manualUrl} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">
                    Ver PDF <Download size={14} />
                  </a>
                ) : <p className="text-zinc-400">Não disponível</p>}
              </div>
            </div>
            <div>
              <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Informações Técnicas</h5>
              <div className="p-4 bg-zinc-50 rounded-xl text-sm text-zinc-700 whitespace-pre-wrap">
                {viewingItem.technicalInfo || 'Nenhuma informação técnica.'}
              </div>
            </div>

            {/* Ongoing Maintenance Section */}
            {records.filter(r => r.equipmentId === viewingItem.id && r.status === 'in-progress').length > 0 && (
              <div className="space-y-4 border-t border-zinc-100 pt-6">
                <h5 className="text-xs font-bold text-orange-600 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={14} /> Manutenção em Andamento
                </h5>
                <div className="space-y-3">
                  {records.filter(r => r.equipmentId === viewingItem.id && r.status === 'in-progress').map(record => (
                    <div key={record.id} className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-orange-900">{record.planDescription}</p>
                        <p className="text-[10px] text-orange-700">Iniciado em: {format(parseISO(record.startDate), 'dd/MM/yyyy HH:mm')}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-white border-orange-200 text-orange-600 hover:bg-orange-100"
                        onClick={() => onGeneratePDF(record)}
                      >
                        <FileText size={14} /> PDF
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <PartsList equipmentId={viewingItem.id} equipmentName={viewingItem.name} user={user} searchTerm={searchTerm} />
            <PlansList equipment={viewingItem} user={user} showToast={showToast} setConfirmModal={setConfirmModal} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function PartsList({ equipmentId, equipmentName, user, searchTerm }: { equipmentId: string, equipmentName: string, user: UserProfile, searchTerm: string }) {
  const [parts, setParts] = useState<Part[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'equipment', equipmentId, 'parts'));
    return onSnapshot(q, (snapshot) => {
      setParts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Part)));
    });
  }, [equipmentId]);

  const filteredParts = parts.filter(part => 
    part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddPart = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      equipmentId,
      name: formData.get('name') as string,
      code: formData.get('code') as string,
      cost: Number(formData.get('cost'))
    };
    await addDoc(collection(db, 'equipment', equipmentId, 'parts'), data);
    setIsAdding(false);
  };

  return (
    <div className="space-y-4 border-t border-zinc-100 pt-6">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Peças e Componentes</h5>
        {user.role !== 'operator' && (
          <button onClick={() => setIsAdding(true)} className="text-xs font-bold text-black hover:underline flex items-center gap-1">
            <Plus size={12} /> Adicionar Peça
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleAddPart} className="p-4 bg-zinc-50 rounded-xl grid grid-cols-3 gap-3">
          <Input label="Nome" name="name" required />
          <Input label="Código" name="code" required />
          <Input label="Custo (R$)" name="cost" type="number" step="0.01" required />
          <div className="col-span-3 flex justify-end gap-2">
            <Button variant="ghost" className="text-xs" onClick={() => setIsAdding(false)}>Cancelar</Button>
            <Button type="submit" className="text-xs">Salvar</Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {filteredParts.map(part => (
          <div key={part.id} className="flex items-center justify-between p-3 bg-white border border-zinc-100 rounded-lg text-sm">
            <div>
              <p className="font-bold">{part.name}</p>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">CÓD: {part.code}</p>
            </div>
            <div className="text-right">
              {!user.role || user.role !== 'operator' ? (
                <p className="font-bold text-zinc-900">R$ {part.cost.toFixed(2)}</p>
              ) : (
                <p className="text-[10px] text-zinc-400 italic italic">Valor restrito</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlansList({ equipment, user, showToast, setConfirmModal }: { equipment: Equipment, user: UserProfile, showToast: (m: string, t?: any) => void, setConfirmModal: any }) {
  const equipmentId = equipment.id;
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [lastRecords, setLastRecords] = useState<Record<string, MaintenanceRecord>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MaintenancePlan | null>(null);
  const [selectedParts, setSelectedParts] = useState<{ partId: string, quantity: number }[]>([]);

  useEffect(() => {
    const qPlans = query(collection(db, 'equipment', equipmentId, 'plans'));
    const unsubPlans = onSnapshot(qPlans, (snapshot) => {
      setPlans(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaintenancePlan)));
    });

    const qParts = query(collection(db, 'equipment', equipmentId, 'parts'));
    const unsubParts = onSnapshot(qParts, (snapshot) => {
      setParts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Part)));
    });

    const qRecords = query(
      collection(db, 'maintenance_records'), 
      where('equipmentId', '==', equipmentId),
      where('status', '==', 'completed'),
      orderBy('endDate', 'desc')
    );
    const unsubRecords = onSnapshot(qRecords, (snapshot) => {
      const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceRecord));
      const latest: Record<string, MaintenanceRecord> = {};
      records.forEach(r => {
        if (!latest[r.planId]) latest[r.planId] = r;
      });
      setLastRecords(latest);
    });

    return () => {
      unsubPlans();
      unsubParts();
      unsubRecords();
    };
  }, [equipmentId]);

  const calculateDaysRemaining = (plan: MaintenancePlan) => {
    const lastRecord = lastRecords[plan.id];
    const lastHourMeter = lastRecord?.hourMeter || 0;
    const nextMaintenanceHour = lastHourMeter + plan.intervalHours;
    const remainingHours = nextMaintenanceHour - (equipment.currentHours || 0);
    
    if (!equipment.avgHoursPerDay || equipment.avgHoursPerDay <= 0) return null;
    
    const days = Math.ceil(remainingHours / equipment.avgHoursPerDay);
    return days;
  };

  const handleAddPlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (user.role === 'operator') {
      showToast("Você não tem permissão para realizar esta ação.", "error");
      return;
    }
    const formData = new FormData(e.currentTarget);
    const data = {
      equipmentId,
      description: formData.get('description') as string,
      workDescription: formData.get('workDescription') as string,
      intervalHours: Number(formData.get('intervalHours')),
      criticality: formData.get('criticality') as 'low' | 'medium' | 'high',
      partsRequired: selectedParts.filter(p => p.quantity > 0)
    };
    try {
      if (editingPlan) {
        await updateDoc(doc(db, 'equipment', equipmentId, 'plans', editingPlan.id), data);
        showToast("Plano atualizado com sucesso.", "success");
      } else {
        await addDoc(collection(db, 'equipment', equipmentId, 'plans'), data);
        showToast("Plano adicionado com sucesso.", "success");
      }
      setIsAdding(false);
      setEditingPlan(null);
      setSelectedParts([]);
    } catch (error) {
      console.error("Erro ao salvar plano:", error);
      showToast("Erro ao salvar o plano. Verifique os campos e tente novamente.", "error");
    }
  };

  const handlePartToggle = (partId: string, quantity: number) => {
    setSelectedParts(prev => {
      const existing = prev.find(p => p.partId === partId);
      if (existing) {
        if (quantity <= 0) return prev.filter(p => p.partId !== partId);
        return prev.map(p => p.partId === partId ? { ...p, quantity } : p);
      }
      if (quantity <= 0) return prev;
      return [...prev, { partId, quantity }];
    });
  };

  return (
    <div className="space-y-4 border-t border-zinc-100 pt-6">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Planos de Manutenção</h5>
        {user.role !== 'operator' && (
          <button 
            onClick={() => {
              setIsAdding(true);
              setEditingPlan(null);
              setSelectedParts([]);
            }} 
            className="text-xs font-bold text-black hover:underline flex items-center gap-1"
          >
            <Plus size={12} /> Novo Plano
          </button>
        )}
      </div>

      {(isAdding || editingPlan) && (
        <form onSubmit={handleAddPlan} className="p-4 bg-zinc-50 rounded-xl space-y-4 border border-zinc-200">
          <Input 
            label="Descrição da Manutenção" 
            name="description" 
            placeholder="Ex: Revisão de 500h" 
            defaultValue={editingPlan?.description || ''}
            required 
          />
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Trabalhos a serem Realizados</label>
            <textarea 
              name="workDescription" 
              placeholder="Descreva detalhadamente os itens a serem revisados..."
              rows={3}
              defaultValue={editingPlan?.workDescription || ''}
              className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-100 focus:border-zinc-400 transition-all shadow-sm"
            />
          </div>
          <Input 
            label="Intervalo (Horas)" 
            name="intervalHours" 
            type="number" 
            placeholder="500" 
            defaultValue={editingPlan?.intervalHours || ''}
            required 
          />
          
          <Select 
            label="Nível de Criticidade" 
            name="criticality" 
            defaultValue={editingPlan?.criticality || 'medium'}
            required
            options={[
              { value: 'low', label: 'Baixa' },
              { value: 'medium', label: 'Média' },
              { value: 'high', label: 'Alta' }
            ]}
          />
          
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Peças Necessárias para este Plano</p>
            {parts.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2">
                {parts.map(part => {
                  const existingPart = selectedParts.find(p => p.partId === part.id);
                  return (
                    <div key={part.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-zinc-100">
                      <span className="text-xs font-medium">{part.name}</span>
                      <input 
                        type="number" 
                        min="0"
                        placeholder="Qtd"
                        defaultValue={existingPart?.quantity || ''}
                        className="w-16 px-2 py-1 text-xs border border-zinc-200 rounded"
                        onChange={(e) => handlePartToggle(part.id, Number(e.target.value))}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-zinc-400 italic">Cadastre peças primeiro para selecioná-las no plano.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="ghost" 
              className="text-xs" 
              onClick={() => {
                setIsAdding(false);
                setEditingPlan(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" className="text-xs">
              {editingPlan ? 'Atualizar Plano' : 'Salvar Plano'}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {plans.length > 0 ? plans.map(plan => (
          <div key={plan.id} className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-zinc-900 truncate">{plan.description}</p>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest shrink-0">Intervalo: {plan.intervalHours}h</p>
                  <p className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 ${
                    plan.criticality === 'high' ? 'text-red-600 bg-red-50 border-red-100' : 
                    plan.criticality === 'medium' ? 'text-orange-600 bg-orange-50 border-orange-100' : 
                    'text-blue-600 bg-blue-50 border-blue-100'
                  }`}>
                    Criticidade: {plan.criticality === 'high' ? 'Alta' : plan.criticality === 'medium' ? 'Média' : 'Baixa'}
                  </p>
                  {calculateDaysRemaining(plan) !== null && (
                    <p className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border truncate ${
                      (calculateDaysRemaining(plan) || 0) <= 7 ? 'text-red-600 bg-red-50 border-red-100' : 
                      (calculateDaysRemaining(plan) || 0) <= 15 ? 'text-orange-600 bg-orange-50 border-orange-100' : 
                      'text-emerald-600 bg-emerald-50 border-emerald-100'
                    }`}>
                      Próxima em: {calculateDaysRemaining(plan)} dias
                    </p>
                  )}
                </div>
                {plan.workDescription && (
                  <p className="text-xs text-zinc-600 mt-2 bg-white/50 p-2 rounded-lg border border-zinc-100 italic">
                    {plan.workDescription}
                  </p>
                )}
              </div>
              {user.role !== 'operator' && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setEditingPlan(plan);
                      setSelectedParts(plan.partsRequired || []);
                      setIsAdding(false);
                    }}
                    className="text-zinc-300 hover:text-blue-500 transition-colors"
                    title="Editar Plano"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button 
                    onClick={async () => {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Excluir Plano',
                        message: 'Deseja excluir este plano?',
                        onConfirm: async () => {
                          try {
                            await deleteDoc(doc(db, 'equipment', equipmentId, 'plans', plan.id));
                            showToast('Plano excluído com sucesso.', 'success');
                          } catch (err) {
                            showToast('Erro ao excluir plano.', 'error');
                          }
                        }
                      });
                    }}
                    className="text-zinc-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
            {plan.partsRequired && plan.partsRequired.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-200/50">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Peças do Plano:</p>
                <div className="flex flex-wrap gap-2">
                  {plan.partsRequired.map(pr => {
                    const part = parts.find(p => p.id === pr.partId);
                    return (
                      <span key={pr.partId} className="px-2 py-1 bg-white border border-zinc-100 rounded text-[10px] font-medium text-zinc-600">
                        {part?.name || 'Peça excluída'} ({pr.quantity})
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )) : (
          <div className="text-center py-6 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
            <p className="text-xs text-zinc-400">Nenhum plano cadastrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MaintenanceSection({ equipment, records, user, onDeleteRecord, searchTerm, sendAlert, onGeneratePDF, qrEquipId, onClearQrFilter }: { equipment: Equipment[], records: MaintenanceRecord[], user: UserProfile, onDeleteRecord: (id: string) => void, searchTerm: string, sendAlert: any, onGeneratePDF: (r: MaintenanceRecord) => void, qrEquipId?: string | null, onClearQrFilter?: () => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [completingRecord, setCompletingRecord] = useState<MaintenanceRecord | null>(null);
  const [selectedEquipId, setSelectedEquipId] = useState(qrEquipId || '');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [equipmentParts, setEquipmentParts] = useState<Part[]>([]);
  const [selectedParts, setSelectedParts] = useState<{ partId: string, quantity: number }[]>([]);
  const [calculatedStartDate, setCalculatedStartDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'planned' | 'in-progress' | 'completed'>(qrEquipId ? 'in-progress' : 'all');
  const [criticalityFilter, setCriticalityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  useEffect(() => {
    if (qrEquipId) {
      setSelectedEquipId(qrEquipId);
      setStatusFilter('in-progress');
    }
  }, [qrEquipId]);

  useEffect(() => {
    if (selectedEquipId) {
      const qPlans = query(collection(db, 'equipment', selectedEquipId, 'plans'));
      const unsubPlans = onSnapshot(qPlans, (snapshot) => {
        setPlans(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaintenancePlan)));
      });

      const qParts = query(collection(db, 'equipment', selectedEquipId, 'parts'));
      const unsubParts = onSnapshot(qParts, (snapshot) => {
        setEquipmentParts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Part)));
      });

      return () => {
        unsubPlans();
        unsubParts();
      };
    } else {
      setPlans([]);
      setEquipmentParts([]);
    }
  }, [selectedEquipId]);

  useEffect(() => {
    if (selectedEquipId && selectedPlanId) {
      const equip = equipment.find(e => e.id === selectedEquipId);
      const plan = plans.find(p => p.id === selectedPlanId);
      
      if (equip && plan) {
        // Find latest completed record for this plan
        const planRecords = records.filter(r => r.planId === selectedPlanId && r.status === 'completed');
        const lastRecord = planRecords[0]; // records are ordered by startDate desc
        
        const lastHourMeter = lastRecord?.hourMeter || 0;
        const nextMaintenanceHour = lastHourMeter + plan.intervalHours;
        const remainingHours = nextMaintenanceHour - (equip.currentHours || 0);
        
        if (equip.avgHoursPerDay && equip.avgHoursPerDay > 0) {
          const days = Math.ceil(remainingHours / equip.avgHoursPerDay);
          const date = new Date();
          date.setDate(date.getDate() + days);
          setCalculatedStartDate(format(date, 'yyyy-MM-dd'));
        } else {
          setCalculatedStartDate(format(new Date(), 'yyyy-MM-dd'));
        }
      }
    }
  }, [selectedEquipId, selectedPlanId, equipment, plans, records]);

  const handleStartMaintenance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const equip = equipment.find(e => e.id === selectedEquipId);
    const plan = plans.find(p => p.id === selectedPlanId);
    
    if (!equip || !plan) return;

    const usedParts = selectedParts.map(sp => {
      const part = equipmentParts.find(p => p.id === sp.partId);
      return {
        partId: sp.partId,
        name: part?.name || '',
        quantity: sp.quantity,
        unitCost: part?.cost || 0
      };
    }).filter(p => p.quantity > 0);

    const totalPartsCost = usedParts.reduce((acc, p) => acc + (p.quantity * p.unitCost), 0);
    const totalLaborCost = Number(formData.get('totalLaborCost'));
    const notes = formData.get('notes') as string;

    const data: any = {
      equipmentId: selectedEquipId,
      equipmentName: equip.name,
      planId: selectedPlanId,
      planDescription: plan.description,
      criticality: (formData.get('criticality') as any) || plan.criticality || 'medium',
      status: 'in-progress',
      startDate: new Date().toISOString(),
      scheduledStartDate: formData.get('scheduledStartDate') as string,
      hoursPerDay: Number(formData.get('hoursPerDay')),
      avgHoursPerDay: Number(formData.get('avgHoursPerDay')),
      avgKmPerDay: Number(formData.get('avgKmPerDay')),
      scheduledStartTime: formData.get('scheduledStartTime') as string,
      scheduledEndTime: formData.get('scheduledEndTime') as string,
      totalPartsCost,
      totalLaborCost,
      usedParts,
      notes
    };

    await addDoc(collection(db, 'maintenance_records'), data);
    await sendAlert(`Manutenção iniciada: ${data.planDescription} para ${data.equipmentName}`, '🛠️ MANUTENÇÃO INICIADA', 'maintenance');
    
    setIsModalOpen(false);
    setSelectedParts([]);
  };

  const handleEditMaintenance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingRecord) return;

    const formData = new FormData(e.currentTarget);
    
    const usedParts = selectedParts.map(sp => {
      const part = equipmentParts.find(p => p.id === sp.partId);
      return {
        partId: sp.partId,
        name: part?.name || '',
        quantity: sp.quantity,
        unitCost: part?.cost || 0
      };
    }).filter(p => p.quantity > 0);

    const totalPartsCost = usedParts.reduce((acc, p) => acc + (p.quantity * p.unitCost), 0);
    const totalLaborCost = Number(formData.get('totalLaborCost'));

    const update: any = {
      criticality: formData.get('criticality') as any,
      scheduledStartDate: formData.get('scheduledStartDate') as string,
      hoursPerDay: Number(formData.get('hoursPerDay')),
      avgHoursPerDay: Number(formData.get('avgHoursPerDay')),
      avgKmPerDay: Number(formData.get('avgKmPerDay')),
      scheduledStartTime: formData.get('scheduledStartTime') as string,
      scheduledEndTime: formData.get('scheduledEndTime') as string,
      totalPartsCost,
      totalLaborCost,
      usedParts,
      notes: formData.get('notes') as string
    };

    await updateDoc(doc(db, 'maintenance_records', editingRecord.id), update);
    setIsEditModalOpen(false);
    setEditingRecord(null);
    setSelectedParts([]);
  };

  const openEditModal = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setSelectedEquipId(record.equipmentId);
    setSelectedParts(record.usedParts?.map(p => ({ partId: p.partId, quantity: p.quantity })) || []);
    setIsEditModalOpen(true);
  };

  const handlePartQuantityChange = (partId: string, quantity: number) => {
    setSelectedParts(prev => {
      const existing = prev.find(p => p.partId === partId);
      if (existing) {
        return prev.map(p => p.partId === partId ? { ...p, quantity } : p);
      }
      return [...prev, { partId, quantity }];
    });
  };

  const handleUpdateStatus = async (record: MaintenanceRecord, nextStatus: MaintenanceStatus) => {
    if (nextStatus === 'completed') {
      setCompletingRecord(record);
      setIsCompleteModalOpen(true);
      return;
    }
    const update: any = { status: nextStatus };
    await updateDoc(doc(db, 'maintenance_records', record.id), update);
  };

  const handleFinishMaintenance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!completingRecord) return;

    const formData = new FormData(e.currentTarget);
    const hourMeter = Number(formData.get('hourMeter'));
    const kmMeter = Number(formData.get('kmMeter'));
    const notes = formData.get('notes') as string;

    const update: any = { 
      status: 'completed',
      endDate: new Date().toISOString(),
      hourMeter,
      kmMeter,
      notes: notes || completingRecord.notes || ''
    };

    // Update record
    await updateDoc(doc(db, 'maintenance_records', completingRecord.id), update);
    
    // Update equipment current hours and km
    await updateDoc(doc(db, 'equipment', completingRecord.equipmentId), {
      currentHours: hourMeter,
      currentKm: kmMeter
    });

    await sendAlert(`Manutenção concluída: ${completingRecord.planDescription} para ${completingRecord.equipmentName}. Horímetro: ${hourMeter}`, '✅ MANUTENÇÃO CONCLUÍDA', 'maintenance');

    setIsCompleteModalOpen(false);
    setCompletingRecord(null);
  };

  const handleRepeatMaintenance = (record: MaintenanceRecord) => {
    setSelectedEquipId(record.equipmentId);
    setSelectedPlanId(record.planId);
    setIsModalOpen(true);
  };

  const filteredRecords = records.filter(record => {
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchesEquip = !qrEquipId || record.equipmentId === qrEquipId;
    const matchesCriticality = criticalityFilter === 'all' || record.criticality === criticalityFilter;
    const matchesSearch = 
      (record.equipmentName && record.equipmentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (record.planDescription && record.planDescription.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (record.notes && record.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch && matchesEquip && matchesCriticality;
  });

  return (
    <div className="space-y-6">
      {qrEquipId && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <QrCode size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-900">Filtrado por QR Code</p>
              <p className="text-xs text-blue-700">Mostrando ordens abertas para: <strong>{equipment.find(e => e.id === qrEquipId)?.name}</strong></p>
            </div>
          </div>
          <button 
            onClick={onClearQrFilter}
            className="px-4 py-2 bg-white text-blue-600 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-50 transition-all"
          >
            Limpar Filtro
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-zinc-900">Controle de Manutenções</h3>
          <p className="text-zinc-500">Acompanhe e execute as manutenções preventivas.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-40">
            <Select 
              value={criticalityFilter}
              onChange={(e: any) => setCriticalityFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Todas Criticidades' },
                { value: 'low', label: 'Baixa' },
                { value: 'medium', label: 'Média' },
                { value: 'high', label: 'Alta' }
              ]}
            />
          </div>
          <div className="w-40">
            <Select 
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Todos Status' },
                { value: 'in-progress', label: 'Em Andamento' },
                { value: 'completed', label: 'Concluídas' }
              ]}
            />
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Play size={20} /> Iniciar Manutenção
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredRecords.map(record => (
          <Card key={record.id} className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-6 min-w-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  record.status === 'in-progress' ? 'bg-orange-100 text-orange-600' : 
                  record.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 
                  'bg-zinc-100 text-zinc-400'
                }`}>
                  {record.status === 'in-progress' ? <Clock /> : record.status === 'completed' ? <CheckCircle2 /> : <AlertCircle />}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-zinc-900 truncate">{record.equipmentName}</h4>
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm text-zinc-500 truncate flex-1 min-w-0">{record.planDescription}</p>
                    {record.criticality && (
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0 ${
                        record.criticality === 'high' ? 'text-red-600 bg-red-50 border-red-100' : 
                        record.criticality === 'medium' ? 'text-orange-600 bg-orange-50 border-orange-100' : 
                        'text-blue-600 bg-blue-50 border-blue-100'
                      }`}>
                        {record.criticality === 'high' ? 'Alta' : record.criticality === 'medium' ? 'Média' : 'Baixa'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 md:gap-8 shrink-0">
                <div className="text-right min-w-[100px]">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</p>
                  <p className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border inline-block mt-1 ${
                    record.status === 'in-progress' ? 'text-orange-600 bg-orange-50 border-orange-100' : 
                    record.status === 'completed' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 
                    'text-zinc-500 bg-zinc-50 border-zinc-100'
                  }`}>
                    {record.status === 'in-progress' ? 'Em Andamento' : record.status === 'completed' ? 'Concluída' : 'Programada'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Programação</p>
                  <p className="text-sm font-bold">
                    {record.scheduledStartDate ? format(parseISO(record.scheduledStartDate + 'T00:00:00'), 'dd/MM/yyyy') : '--/--/----'}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {record.hoursPerDay ? `${record.hoursPerDay}h/dia` : record.scheduledStartTime ? `${record.scheduledStartTime} - ${record.scheduledEndTime}` : '--:--'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Início Real</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{format(parseISO(record.startDate), 'dd/MM/yyyy HH:mm')}</p>
                    {record.status === 'planned' && isAfter(new Date(), parseISO(record.startDate)) && (
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Atrasada"></span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onGeneratePDF(record)}
                    className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="Gerar PDF Ordem de Serviço"
                  >
                    <FileText size={18} />
                  </button>
                  {record.status === 'completed' && (
                    <button 
                      onClick={() => handleRepeatMaintenance(record)}
                      className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                      title="Repetir Manutenção"
                    >
                      <RotateCcw size={18} />
                    </button>
                  )}
                  {record.status === 'in-progress' && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => openEditModal(record)}>
                        <Edit3 size={18} /> Editar
                      </Button>
                      <Button variant="primary" onClick={() => handleUpdateStatus(record, 'completed')}>
                        <StopCircle size={18} /> Finalizar
                      </Button>
                    </div>
                  )}
                  {user.role !== 'operator' && user.role !== 'supervisor' && (
                    <button 
                      onClick={() => onDeleteRecord(record.id)}
                      className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                      title="Excluir Manutenção"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEquipId('');
          setSelectedPlanId('');
          setSelectedParts([]);
        }} 
        title="Iniciar Nova Manutenção"
      >
        <form onSubmit={handleStartMaintenance} className="space-y-6">
          <Select 
            label="Equipamento" 
            value={selectedEquipId} 
            onChange={(e: any) => setSelectedEquipId(e.target.value)}
            options={[
              { value: '', label: 'Selecione um equipamento' },
              ...equipment.map(e => ({ value: e.id, label: e.name }))
            ]}
            required
          />
          <Select 
            label="Plano de Manutenção" 
            value={selectedPlanId} 
            onChange={(e: any) => setSelectedPlanId(e.target.value)}
            disabled={!selectedEquipId}
            options={[
              { value: '', label: 'Selecione um plano' },
              ...plans.map(p => ({ value: p.id, label: p.description }))
            ]}
            required
          />

          <Select 
            label="Nível de Criticidade" 
            name="criticality" 
            key={`start-crit-${selectedPlanId}`}
            defaultValue={plans.find(p => p.id === selectedPlanId)?.criticality || 'medium'}
            required
            options={[
              { value: 'low', label: 'Baixa' },
              { value: 'medium', label: 'Média' },
              { value: 'high', label: 'Alta' }
            ]}
          />
          
          {selectedEquipId && plans.length === 0 && (
            <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-3">
              <AlertCircle className="text-orange-600 shrink-0" size={18} />
              <div>
                <p className="text-xs font-bold text-orange-900">Nenhum plano cadastrado</p>
                <p className="text-[10px] text-orange-700 mt-1">
                  Você precisa cadastrar um plano de manutenção para este equipamento antes de iniciar. 
                  Vá na aba <strong>Equipamentos</strong>, clique no ícone de olho e adicione um plano.
                </p>
              </div>
            </div>
          )}
          
          <div className="space-y-4 border-t border-zinc-100 pt-4">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Programação</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Data Início" 
                name="scheduledStartDate" 
                type="date" 
                defaultValue={calculatedStartDate} 
                required 
              />
              <Input 
                label="Horas por Dia" 
                name="hoursPerDay" 
                type="number" 
                step="0.5" 
                min="0" 
                defaultValue={equipment.find(e => e.id === selectedEquipId)?.avgHoursPerDay || 0}
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Média Hora/Dia" 
                name="avgHoursPerDay" 
                type="number" 
                step="0.1" 
                min="0" 
                defaultValue={equipment.find(e => e.id === selectedEquipId)?.avgHoursPerDay || 0}
                required 
              />
              <Input 
                label="Média KM/Dia" 
                name="avgKmPerDay" 
                type="number" 
                step="0.1" 
                min="0" 
                defaultValue={equipment.find(e => e.id === selectedEquipId)?.avgKmPerDay || 0}
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Hora Início" name="scheduledStartTime" type="time" required />
              <Input label="Hora Fim" name="scheduledEndTime" type="time" required />
            </div>
          </div>

          <div className="space-y-4 border-t border-zinc-100 pt-4">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Peças e Custos</h4>
            {user.role !== 'operator' && (
              <Input label="Valor Mão de Obra (R$)" name="totalLaborCost" type="number" step="0.01" defaultValue="0" />
            )}
            
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Peças Cadastradas</p>
              {equipmentParts.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {equipmentParts.map(part => (
                    <div key={part.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                      <div className="flex-1">
                        <p className="text-sm font-bold">{part.name}</p>
                        {user.role !== 'operator' && (
                          <p className="text-[10px] text-zinc-400 uppercase font-bold">R$ {part.cost.toFixed(2)}/un</p>
                        )}
                      </div>
                      <div className="w-24">
                        <Input 
                          type="number" 
                          min="0" 
                          placeholder="Qtd" 
                          value={selectedParts.find(p => p.partId === part.id)?.quantity ?? ''}
                          onChange={(e: any) => handlePartQuantityChange(part.id, Number(e.target.value))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic">Nenhuma peça cadastrada para este equipamento.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Observações / Descrição</label>
              <textarea 
                name="notes" 
                rows={3}
                placeholder="Descreva detalhes da manutenção..."
                className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-100 focus:border-zinc-400 transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit">Iniciar Agora</Button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={isCompleteModalOpen} 
        onClose={() => {
          setIsCompleteModalOpen(false);
          setCompletingRecord(null);
        }} 
        title="Finalizar Manutenção"
      >
        {completingRecord && (
          <form onSubmit={handleFinishMaintenance} className="space-y-6">
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Equipamento</p>
              <p className="font-bold text-zinc-900">{completingRecord.equipmentName}</p>
              <p className="text-sm text-zinc-500">{completingRecord.planDescription}</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Horímetro Final (h)" 
                  name="hourMeter" 
                  type="number" 
                  required 
                  defaultValue={equipment.find(e => e.id === completingRecord.equipmentId)?.currentHours}
                  placeholder="Ex: 1250"
                />
                <Input 
                  label="KM Final" 
                  name="kmMeter" 
                  type="number" 
                  required 
                  defaultValue={equipment.find(e => e.id === completingRecord.equipmentId)?.currentKm}
                  placeholder="Ex: 50000"
                />
              </div>
              <p className="text-[10px] text-zinc-500 italic">
                O horímetro e KM do equipamento serão atualizados automaticamente com estes valores.
              </p>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Observações Finais</label>
                <textarea 
                  name="notes" 
                  rows={3}
                  defaultValue={completingRecord.notes}
                  placeholder="Relate o que foi feito..."
                  className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-100 focus:border-zinc-400 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => {
                setIsCompleteModalOpen(false);
                setCompletingRecord(null);
              }}>Cancelar</Button>
              <Button type="submit">Confirmar e Finalizar</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRecord(null);
          setSelectedParts([]);
        }} 
        title="Editar Manutenção em Progresso"
      >
        {editingRecord && (
          <form onSubmit={handleEditMaintenance} className="space-y-6">
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Equipamento / Plano</p>
              <p className="font-bold text-zinc-900">{editingRecord.equipmentName}</p>
              <p className="text-sm text-zinc-500">{editingRecord.planDescription}</p>
            </div>

            <Select 
              label="Nível de Criticidade" 
              name="criticality" 
              defaultValue={editingRecord.criticality || 'medium'}
              required
              options={[
                { value: 'low', label: 'Baixa' },
                { value: 'medium', label: 'Média' },
                { value: 'high', label: 'Alta' }
              ]}
            />

            <div className="space-y-4 border-t border-zinc-100 pt-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Programação</h4>
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Data Início" 
                  name="scheduledStartDate" 
                  type="date" 
                  defaultValue={editingRecord.scheduledStartDate} 
                  required 
                />
                <Input 
                  label="Horas por Dia" 
                  name="hoursPerDay" 
                  type="number" 
                  step="0.5"
                  min="0"
                  defaultValue={editingRecord.hoursPerDay} 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Média Hora/Dia" 
                  name="avgHoursPerDay" 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  defaultValue={editingRecord.avgHoursPerDay || equipment.find(e => e.id === editingRecord.equipmentId)?.avgHoursPerDay || 0}
                  required 
                />
                <Input 
                  label="Média KM/Dia" 
                  name="avgKmPerDay" 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  defaultValue={editingRecord.avgKmPerDay || equipment.find(e => e.id === editingRecord.equipmentId)?.avgKmPerDay || 0}
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Hora Início" 
                  name="scheduledStartTime" 
                  type="time" 
                  defaultValue={editingRecord.scheduledStartTime} 
                  required 
                />
                <Input 
                  label="Hora Fim" 
                  name="scheduledEndTime" 
                  type="time" 
                  defaultValue={editingRecord.scheduledEndTime} 
                  required 
                />
              </div>
            </div>

            <div className="space-y-4 border-t border-zinc-100 pt-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Peças e Custos</h4>
              {user.role !== 'operator' && (
                <Input 
                  label="Valor Mão de Obra (R$)" 
                  name="totalLaborCost" 
                  type="number" 
                  step="0.01" 
                  defaultValue={editingRecord.totalLaborCost || 0} 
                />
              )}
              
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Peças Utilizadas</p>
                {equipmentParts.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {equipmentParts.map(part => (
                      <div key={part.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                        <div className="flex-1">
                          <p className="text-sm font-bold">{part.name}</p>
                          {user.role !== 'operator' && (
                            <p className="text-[10px] text-zinc-400 uppercase font-bold">R$ {part.cost.toFixed(2)}/un</p>
                          )}
                        </div>
                        <div className="w-24">
                          <Input 
                            type="number" 
                            min="0" 
                            placeholder="Qtd" 
                            value={selectedParts.find(p => p.partId === part.id)?.quantity ?? ''}
                            onChange={(e: any) => handlePartQuantityChange(part.id, Number(e.target.value))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">Nenhuma peça cadastrada para este equipamento.</p>
                )}
              </div>
            </div>

            <div className="space-y-4 border-t border-zinc-100 pt-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Observações</h4>
              <textarea 
                name="notes"
                defaultValue={editingRecord.notes}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all min-h-[100px]"
                placeholder="Adicione observações técnicas aqui..."
              ></textarea>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => {
                setIsEditModalOpen(false);
                setEditingRecord(null);
                setSelectedParts([]);
              }}>Cancelar</Button>
              <Button type="submit">Salvar Alterações</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function PartsSection({ equipment, user, searchTerm }: { equipment: Equipment[], user: UserProfile, searchTerm: string }) {
  const filteredEquipment = equipment.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const [selectedEquipId, setSelectedEquipId] = useState(filteredEquipment[0]?.id || equipment[0]?.id || '');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-zinc-900">Cadastro de Peças</h3>
          <p className="text-zinc-500">Gerencie o estoque e valores das peças por equipamento.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-2">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Equipamentos</h4>
          {filteredEquipment.map(item => (
            <button
              key={item.id}
              onClick={() => setSelectedEquipId(item.id)}
              className={`w-full text-left p-3 rounded-xl text-sm font-medium transition-all ${
                selectedEquipId === item.id 
                  ? 'bg-black text-white shadow-md' 
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="lg:col-span-3">
          {selectedEquipId ? (
            <Card className="p-6">
              <PartsList 
                equipmentId={selectedEquipId} 
                equipmentName={equipment.find(e => e.id === selectedEquipId)?.name || ''} 
                user={user} 
                searchTerm={searchTerm} 
              />
            </Card>
          ) : (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-zinc-200 rounded-2xl text-zinc-400">
              Selecione um equipamento para gerenciar as peças.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportsSection({ equipment, records, user, onDeleteRecord, searchTerm, customers }: { equipment: Equipment[], records: MaintenanceRecord[], user: UserProfile, onDeleteRecord: (id: string) => void, searchTerm: string, customers: Customer[] }) {
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedEquipId, setSelectedEquipId] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'planned' | 'in-progress' | 'completed'>('all');
  
  const filteredRecords = records.filter(r => {
    const matchesDate = r.startDate.startsWith(filterDate);
    const matchesEquip = selectedEquipId === 'all' || r.equipmentId === selectedEquipId;
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch = 
      (r.equipmentName && r.equipmentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.planDescription && r.planDescription.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesDate && matchesEquip && matchesStatus && matchesSearch;
  });
  
  const totalCost = filteredRecords.reduce((acc, r) => acc + (r.totalPartsCost || 0) + (r.totalLaborCost || 0), 0);
  const isOperator = user.role === 'operator';

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const equipName = selectedEquipId === 'all' ? 'Todos' : equipment.find(e => e.id === selectedEquipId)?.name || 'N/A';
    
    let companyName = 'N/A';
    let companyPhone = 'N/A';
    if (selectedEquipId !== 'all') {
      const equip = equipment.find(e => e.id === selectedEquipId);
      const company = customers.find(c => c.id === equip?.customerId);
      if (company) {
        companyName = company.name;
        companyPhone = company.phone;
      }
    } else if (filteredRecords.length > 0) {
      const firstEquip = equipment.find(e => e.id === filteredRecords[0].equipmentId);
      const firstCompanyId = firstEquip?.customerId;
      const allSameCompany = filteredRecords.every(r => {
        const eq = equipment.find(e => e.id === r.equipmentId);
        return eq?.customerId === firstCompanyId;
      });
      if (allSameCompany && firstCompanyId) {
        const company = customers.find(c => c.id === firstCompanyId);
        if (company) {
          companyName = company.name;
          companyPhone = company.phone;
        }
      } else {
        companyName = 'Várias';
      }
    }

    // Header
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text('GIGA Plan Promaq - Relatório de Manutenção', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Equipamento: ${equipName}`, 14, 30);
    doc.text(`Empresa: ${companyName}`, 14, 35);
    if (companyPhone !== 'N/A') {
      doc.text(`Contato: ${companyPhone}`, 14, 40);
      doc.text(`Período: ${filterDate}`, 14, 45);
      doc.text(`Status: ${statusFilter === 'all' ? 'Todos' : statusFilter}`, 14, 50);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 55);
    } else {
      doc.text(`Período: ${filterDate}`, 14, 40);
      doc.text(`Status: ${statusFilter === 'all' ? 'Todos' : statusFilter}`, 14, 45);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 50);
    }
    
    // Summary
    doc.setFontSize(12);
    doc.setTextColor(0);
    const summaryY = companyPhone !== 'N/A' ? 65 : 60;
    doc.text(isOperator ? 'Resumo da Operação' : 'Resumo Financeiro', 14, summaryY);
    doc.setFontSize(10);
    doc.text(`Total de Intervenções: ${filteredRecords.length}`, 14, summaryY + 7);
    if (!isOperator) {
      doc.text(`Custo Total: R$ ${totalCost.toLocaleString()}`, 14, summaryY + 12);
    }
    
    const tableHead = isOperator 
      ? [['Data Real', 'Programado', 'Equipamento', 'Manutenção', 'Status', 'Peças Utilizadas']]
      : [['Data Real', 'Programado', 'Equipamento', 'Manutenção', 'Status', 'Peças Utilizadas', 'Mão de Obra', 'Custo Peças Detalhado', 'Total Geral']];

    const tableBody = filteredRecords.map(r => {
      const base = [
        format(parseISO(r.startDate), 'dd/MM/yyyy'),
        r.scheduledStartDate ? format(parseISO(r.scheduledStartDate + 'T00:00:00'), 'dd/MM/yyyy') : '--/--/----',
        r.equipmentName || 'N/A',
        r.planDescription || 'N/A',
        r.status,
        r.usedParts?.map(p => `${p.name} (x${p.quantity})`).join('\n') || 'Nenhuma',
      ];
      if (isOperator) return base;
      return [
        ...base,
        `R$ ${(r.totalLaborCost || 0).toFixed(2)}`,
        r.usedParts?.map(p => `R$ ${(p.unitCost * p.quantity).toFixed(2)} (${p.quantity}x R$ ${p.unitCost.toFixed(2)})`).join('\n') + 
        (r.usedParts && r.usedParts.length > 0 ? `\n----------------\nTotal Peças: R$ ${r.totalPartsCost?.toFixed(2)}` : '\nR$ 0.00'),
        `R$ ${((r.totalLaborCost || 0) + (r.totalPartsCost || 0)).toFixed(2)}`
      ];
    });

    autoTable(doc, {
      startY: summaryY + (isOperator ? 15 : 25),
      head: tableHead,
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [0, 0, 0] },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: isOperator ? {
        5: { cellWidth: 80 }
      } : {
        5: { cellWidth: 35 }, // Peças Utilizadas
        7: { cellWidth: 45 }, // Custo Peças Detalhado
      }
    });

    // Add footer to all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      const footerText = 'Desenvolvedor: Giga Elétrica | Contato: 43 996118806 | Joaquim Távora - PR';
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
      const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();
      
      doc.text(footerText, 14, pageHeight - 10);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 30, pageHeight - 10);
    }

    doc.save(`relatorio-manutencao-${selectedEquipId}-${filterDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-zinc-900">Relatórios de Manutenção</h3>
          <p className="text-zinc-500">Visualize custos e histórico de intervenções.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48">
            <Select 
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Todos Status' },
                { value: 'in-progress', label: 'Em Andamento' },
                { value: 'completed', label: 'Concluídas' }
              ]}
            />
          </div>
          <div className="w-48">
            <Select 
              value={selectedEquipId} 
              onChange={(e: any) => setSelectedEquipId(e.target.value)}
              options={[
                { value: 'all', label: 'Todos Equipamentos' },
                ...equipment.map(e => ({ value: e.id, label: e.name }))
              ]}
            />
          </div>
          <Input type="month" value={filterDate} onChange={(e: any) => setFilterDate(e.target.value)} />
          <Button variant="outline" onClick={handleExportPDF}>
            <Download size={20} /> Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Intervenções" value={filteredRecords.length} icon={<Wrench className="text-zinc-500" />} />
        {!isOperator && (
          <>
            <StatCard label="Custo Total" value={`R$ ${totalCost.toLocaleString()}`} icon={<Clock className="text-emerald-500" />} />
            <StatCard label="Média por Máquina" value={`R$ ${filteredRecords.length ? (totalCost / filteredRecords.length).toFixed(2) : 0}`} icon={<Filter className="text-blue-500" />} />
          </>
        )}
      </div>

      <Card>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Data Real</th>
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Programado</th>
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Equipamento</th>
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Manutenção</th>
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Peças Detalhadas</th>
              {!isOperator && (
                <>
                  <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Mão de Obra</th>
                  <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Peças (R$)</th>
                  <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Total</th>
                </>
              )}
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map(record => (
              <tr key={record.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                <td className="p-4 text-sm font-medium">{format(parseISO(record.startDate), 'dd/MM/yyyy')}</td>
                <td className="p-4 text-sm font-medium text-zinc-500">
                  {record.scheduledStartDate ? format(parseISO(record.scheduledStartDate + 'T00:00:00'), 'dd/MM/yyyy') : '--/--/----'}
                </td>
                <td className="p-4 text-sm font-bold">{record.equipmentName}</td>
                <td className="p-4 text-sm text-zinc-500">{record.planDescription}</td>
                <td className="p-4 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    record.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                    record.status === 'in-progress' ? 'bg-orange-100 text-orange-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {record.status}
                  </span>
                </td>
                <td className="p-4 text-sm">
                  {record.usedParts && record.usedParts.length > 0 ? (
                    <div className="space-y-1">
                      {record.usedParts.map((p, idx) => (
                        <div key={idx} className="text-[10px] text-zinc-600 flex justify-between gap-2 border-b border-zinc-50 last:border-0 pb-1 last:pb-0">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-zinc-400">x{p.quantity}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-400 italic">Nenhuma</span>
                  )}
                </td>
                {!isOperator && (
                  <>
                    <td className="p-4 text-sm">R$ {record.totalLaborCost?.toFixed(2) || '0.00'}</td>
                    <td className="p-4 text-sm">
                      {record.usedParts && record.usedParts.length > 0 ? (
                        <div className="space-y-1">
                          {record.usedParts.map((p, idx) => (
                            <div key={idx} className="text-[10px] text-zinc-600 flex flex-col items-end border-b border-zinc-50 last:border-0 pb-1 last:pb-0">
                              <span className="font-bold">R$ {(p.unitCost * p.quantity).toFixed(2)}</span>
                              <span className="text-[8px] text-zinc-400">({p.quantity}x R$ {p.unitCost.toFixed(2)})</span>
                            </div>
                          ))}
                          <div className="pt-1 mt-1 border-t border-zinc-200 font-bold text-right">
                            Total: R$ {record.totalPartsCost?.toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <span>R$ 0.00</span>
                      )}
                    </td>
                    <td className="p-4 text-sm font-bold text-right">R$ {((record.totalLaborCost || 0) + (record.totalPartsCost || 0)).toFixed(2)}</td>
                  </>
                )}
                <td className="p-4 text-center">
                  {user.role !== 'operator' && user.role !== 'supervisor' && (
                    <button 
                      onClick={() => onDeleteRecord(record.id)}
                      className="text-zinc-300 hover:text-red-500 transition-colors"
                      title="Excluir Registro"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {!isOperator && (
            <tfoot>
              <tr className="bg-zinc-50 font-bold">
                <td colSpan={9} className="p-4 text-right text-zinc-500 uppercase tracking-widest text-[10px]">Soma Total</td>
                <td className="p-4 text-right text-lg">R$ {totalCost.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </div>
  );
}

function UsersSection({ user, searchTerm, showToast, setConfirmModal, sendAlert }: { user: UserProfile, searchTerm: string, showToast: (m: string, t?: any) => void, setConfirmModal: any, sendAlert: any }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'operator' as UserRole, phoneNumber: '' });
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.phoneNumber && u.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    console.log('UsersSection mounted, setting up snapshot listener');
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(d => d.data() as UserProfile);
      console.log('Users snapshot received:', usersData.length, 'users');
      setUsers(usersData);
    }, (err) => {
      console.error('Error in users snapshot:', err);
      setError('Erro ao carregar lista de usuários: ' + err.message);
    });
    return () => {
      console.log('UsersSection unmounting, cleaning up listener');
      unsubscribe();
    };
  }, []);

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    if (user.role !== 'admin' && user.role !== 'gestor' && user.role !== 'supervisor') {
      showToast('Você não tem permissão para alterar níveis de acesso.', 'error');
      return;
    }
    if (uid === user.uid) {
      showToast('Você não pode alterar seu próprio nível de acesso.', 'error');
      return;
    }
    const targetUser = users.find(u => u.uid === uid);
    if (user.role !== 'admin' && (targetUser?.role === 'admin' || newRole === 'admin')) {
      showToast('Somente administradores podem gerenciar o nível de acesso de administrador.', 'error');
      return;
    }
    if (user.role === 'supervisor' && (targetUser?.role !== 'operator' || newRole !== 'operator')) {
      showToast('Supervisores só podem gerenciar operadores.', 'error');
      return;
    }
    await updateDoc(doc(db, 'users', uid), { role: newRole });
  };

  const handleDeleteUser = async (uid: string) => {
    if (user.role !== 'admin' && user.role !== 'gestor' && user.role !== 'supervisor') {
      showToast('Você não tem permissão para excluir usuários.', 'error');
      return;
    }
    if (uid === user.uid) {
      showToast('Você não pode excluir seu próprio usuário.', 'error');
      return;
    }
    const userToDelete = users.find(u => u.uid === uid);
    if (user.role !== 'admin' && userToDelete?.role === 'admin') {
      showToast('Somente administradores podem excluir outros administradores.', 'error');
      return;
    }
    if (user.role === 'supervisor' && userToDelete?.role !== 'operator') {
      showToast('Supervisores só podem excluir operadores.', 'error');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Usuário',
      message: 'Tem certeza que deseja excluir este usuário?',
      onConfirm: async () => {
        try {
          const userToDelete = users.find(u => u.uid === uid);
          await deleteDoc(doc(db, 'users', uid));
          if (userToDelete) {
            await sendAlert(`Usuário excluído: ${userToDelete.name} (@${userToDelete.username})`, '🗑️ USUÁRIO EXCLUÍDO', 'alert');
          }
          showToast('Usuário excluído com sucesso.', 'success');
        } catch (err) {
          showToast('Erro ao excluir usuário.', 'error');
        }
      }
    });
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role !== 'admin' && user.role !== 'gestor' && user.role !== 'supervisor') {
      showToast('Você não tem permissão para cadastrar usuários.', 'error');
      return;
    }
    if (user.role !== 'admin' && newUser.role === 'admin') {
      showToast('Somente administradores podem cadastrar outros administradores.', 'error');
      return;
    }
    if (user.role === 'supervisor' && newUser.role !== 'operator') {
      showToast('Supervisores só podem cadastrar operadores.', 'error');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const username = newUser.username.toLowerCase().trim();
      console.log('Attempting to register user:', username);
      
      if (!username || !newUser.password || !newUser.name) {
        throw new Error('Preencha todos os campos.');
      }

      // Check if user already exists
      const existingUser = users.find(u => (u.username || '').toLowerCase() === username);
      if (existingUser) {
        throw new Error('Este nome de usuário já está cadastrado.');
      }

      const userData = {
        uid: username, // Use username as UID for simplicity and uniqueness
        username: username,
        password: newUser.password,
        name: newUser.name.trim(),
        role: newUser.role,
        phoneNumber: newUser.phoneNumber
      };

      console.log('Saving user to Firestore with ID:', username, userData);
      
      await setDoc(doc(db, 'users', username), userData);
      await sendAlert(`Novo usuário cadastrado: ${userData.name} (@${userData.username})`, '👤 NOVO USUÁRIO', 'new');
      console.log('User saved successfully');
      setIsModalOpen(false);
      setNewUser({ name: '', username: '', password: '', role: 'operator' });
    } catch (err: any) {
      console.error('Error registering user:', err);
      const errorMessage = handleFirestoreError(err, OperationType.WRITE, 'users');
      setError(errorMessage || err.message || 'Erro desconhecido ao cadastrar usuário.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (user.role !== 'admin' && user.role !== 'gestor' && user.role !== 'supervisor') {
      showToast('Você não tem permissão para atualizar usuários.', 'error');
      return;
    }
    if (user.role !== 'admin' && editingUser.role === 'admin') {
      showToast('Somente administradores podem editar outros administradores.', 'error');
      return;
    }
    if (user.role === 'supervisor' && editingUser.role !== 'operator') {
      showToast('Supervisores só podem editar operadores.', 'error');
      return;
    }
    setLoading(true);
    setError('');

    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        name: editingUser.name,
        role: editingUser.role,
        password: editingUser.password,
        phoneNumber: editingUser.phoneNumber || ''
      });
      setIsEditModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      console.error('Error updating user:', err);
      setError('Erro ao atualizar usuário: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-zinc-900">Gestão de Usuários</h3>
          <p className="text-zinc-500">Controle quem tem acesso ao sistema e seus níveis de permissão.</p>
        </div>
        {(user.role === 'admin' || user.role === 'gestor' || user.role === 'supervisor') && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={20} />
            Cadastrar Usuário
          </Button>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Cadastrar Novo Usuário"
      >
        <form onSubmit={handleRegisterUser} className="space-y-4">
          <Input 
            label="Nome Completo"
            placeholder="Ex: João Silva"
            value={newUser.name}
            onChange={(e: any) => setNewUser({ ...newUser, name: e.target.value })}
            required
          />
          <Input 
            label="Nome de Usuário"
            placeholder="usuario.exemplo"
            value={newUser.username}
            onChange={(e: any) => setNewUser({ ...newUser, username: e.target.value })}
            required
          />
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Senha</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                placeholder="******"
                value={newUser.password}
                onChange={(e: any) => setNewUser({ ...newUser, password: e.target.value })}
                required
                className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-100 focus:border-zinc-400 transition-all shadow-sm pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <Select 
            label="Nível de Acesso"
            value={newUser.role}
            onChange={(e: any) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
            options={[
              { value: 'admin', label: 'Administrador' },
              { value: 'supervisor', label: 'Supervisor' },
              { value: 'gestor', label: 'Gestor' },
              { value: 'operator', label: 'Operador' }
            ].filter(opt => {
              if (user.role === 'admin') return true;
              if (user.role === 'gestor') return opt.value !== 'admin';
              if (user.role === 'supervisor') return opt.value === 'operator';
              return false;
            })}
          />
          <Input 
            label="Telefone (WhatsApp)"
            placeholder="Ex: 43999999999"
            value={newUser.phoneNumber}
            onChange={(e: any) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
          />
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        title="Editar Usuário"
      >
        {editingUser && (
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <Input 
              label="Nome Completo"
              value={editingUser.name}
              onChange={(e: any) => setEditingUser({ ...editingUser, name: e.target.value })}
              required
            />
            <Input 
              label="Nome de Usuário"
              value={editingUser.username}
              disabled
            />
            {!(user.role !== 'admin' && editingUser.role === 'admin') && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Senha</label>
                <div className="relative">
                  <input 
                    type={showEditPassword ? "text" : "password"}
                    value={editingUser.password || ''}
                    onChange={(e: any) => setEditingUser({ ...editingUser, password: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-100 focus:border-zinc-400 transition-all shadow-sm pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}
            <Select 
              label="Nível de Acesso"
              value={editingUser.role}
              onChange={(e: any) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
              options={[
                { value: 'admin', label: 'Administrador' },
                { value: 'supervisor', label: 'Supervisor' },
                { value: 'gestor', label: 'Gestor' },
                { value: 'operator', label: 'Operador' }
              ].filter(opt => {
                if (user.role === 'admin') return true;
                if (user.role === 'gestor') return opt.value !== 'admin';
                if (user.role === 'supervisor') return opt.value === 'operator';
                return false;
              })}
              disabled={user.role !== 'admin' && editingUser.role === 'admin'}
            />
            <Input 
              label="Telefone (WhatsApp)"
              placeholder="Ex: 43999999999"
              value={editingUser.phoneNumber || ''}
              onChange={(e: any) => setEditingUser({ ...editingUser, phoneNumber: e.target.value })}
            />
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium">
                {error}
              </div>
            )}

            <div className="pt-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map(u => (
          <Card key={u.uid} className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                u.role === 'admin' ? 'bg-zinc-900 text-white' : 
                u.role === 'supervisor' ? 'bg-blue-100 text-blue-600' : 
                'bg-zinc-100 text-zinc-500'
              }`}>
                {u.role === 'admin' ? <Shield size={24} /> : <UserIcon size={24} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-zinc-900 truncate">{u.name}</p>
                <p className="text-xs text-zinc-500 truncate">{u.username ? `@${u.username}` : 'Sem usuário'}</p>
                {u.phoneNumber && (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] text-zinc-400 font-bold truncate">
                      {u.phoneNumber}
                    </p>
                  </div>
                )}
              </div>
              {(user.role === 'admin' || (user.role === 'gestor' && u.role !== 'admin') || (user.role === 'supervisor' && u.role === 'operator')) && (
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      setEditingUser(u);
                      setIsEditModalOpen(true);
                    }}
                    className="p-2 text-zinc-300 hover:text-blue-500 transition-colors"
                    title="Editar Usuário"
                  >
                    <Edit3 size={18} />
                  </button>
                  {u.uid !== user.uid && (
                    <button 
                      onClick={() => handleDeleteUser(u.uid)}
                      className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                      title="Excluir Usuário"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-zinc-100">
              <Select 
                label="Nível de Acesso"
                value={u.role} 
                onChange={(e: any) => handleRoleChange(u.uid, e.target.value)}
                options={[
                  { value: 'admin', label: 'Administrador' },
                  { value: 'supervisor', label: 'Supervisor' },
                  { value: 'gestor', label: 'Gestor' },
                  { value: 'operator', label: 'Operador' }
                ].filter(opt => {
                  if (user.role === 'admin') return true;
                  if (user.role === 'gestor') return opt.value !== 'admin';
                  if (user.role === 'supervisor') return opt.value === 'operator';
                  return false;
                })}
                disabled={u.uid === user.uid || (user.role !== 'admin' && user.role !== 'gestor' && user.role !== 'supervisor') || (user.role !== 'admin' && u.role === 'admin') || (user.role === 'supervisor' && u.role !== 'operator')}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CustomersSection({ customers, user, searchTerm, showToast, setConfirmModal, sendAlert }: { customers: Customer[], user: UserProfile, searchTerm: string, showToast: (m: string, t?: any) => void, setConfirmModal: any, sendAlert: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.taxId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      taxId: formData.get('taxId') as string,
      address: formData.get('address') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      website: formData.get('website') as string,
      createdAt: editingCustomer?.createdAt || new Date().toISOString()
    };

    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), data);
        showToast('Empresa atualizada com sucesso.', 'success');
      } else {
        await addDoc(collection(db, 'customers'), data);
        await sendAlert(`Nova empresa cadastrada: ${data.name}`, '🤝 NOVA EMPRESA', 'new');
        showToast('Empresa cadastrada com sucesso.', 'success');
      }
      setIsModalOpen(false);
      setEditingCustomer(null);
    } catch (err: any) {
      console.error('Error saving customer:', err);
      setSaveError(handleFirestoreError(err, OperationType.WRITE, 'customers'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Empresa',
      message: 'Tem certeza que deseja excluir esta empresa? Isso não removerá o vínculo com equipamentos já cadastrados, mas eles ficarão sem referência.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'customers', id));
          showToast('Empresa excluída com sucesso.', 'success');
        } catch (err) {
          showToast('Erro ao excluir empresa.', 'error');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-zinc-900">Gestão de Empresas</h3>
          <p className="text-zinc-500">Cadastre e gerencie suas empresas.</p>
        </div>
        <Button onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}>
          <Plus size={20} /> Nova Empresa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => (
          <Card key={customer.id} className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-bold text-zinc-900 text-lg">{customer.name}</h4>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{customer.taxId}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setEditingCustomer(customer); setIsModalOpen(true); }}
                  className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                >
                  <Edit3 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(customer.id)}
                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <AlertCircle size={14} className="text-zinc-400" />
                <span>{customer.address}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <MessageCircle size={14} className="text-zinc-400" />
                <span>{customer.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <Bell size={14} className="text-zinc-400" />
                <span>{customer.email}</span>
              </div>
              {customer.website && (
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <LayoutDashboard size={14} className="text-zinc-400" />
                  <a href={customer.website.startsWith('http') ? customer.website : `https://${customer.website}`} target="_blank" className="text-blue-600 hover:underline truncate">
                    {customer.website}
                  </a>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingCustomer ? 'Editar Empresa' : 'Nova Empresa'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nome / Razão Social" name="name" defaultValue={editingCustomer?.name} required />
          <Input label="CNPJ / CPF" name="taxId" defaultValue={editingCustomer?.taxId} required />
          <Input label="Endereço Completo" name="address" defaultValue={editingCustomer?.address} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Telefone" name="phone" defaultValue={editingCustomer?.phone} required />
            <Input label="E-mail" name="email" type="email" defaultValue={editingCustomer?.email} required />
          </div>
          <Input label="Site" name="website" defaultValue={editingCustomer?.website} placeholder="https://..." />

          {saveError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium">
              {saveError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Empresa'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
