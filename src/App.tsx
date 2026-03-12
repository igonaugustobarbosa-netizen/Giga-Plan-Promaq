import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  auth, db 
} from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  getAuth,
  signOut as secondarySignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  Timestamp
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
  AlertCircle,
  CheckCircle2,
  Play,
  StopCircle,
  Download,
  Eye,
  Trash2,
  Edit3,
  User as UserIcon,
  Shield,
  HardHat,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addHours, isAfter, parseISO } from 'date-fns';
import { UserProfile, Equipment, Part, MaintenancePlan, MaintenanceRecord, UserRole, MaintenanceStatus } from './types';

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }: any) => {
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
      disabled={disabled}
      className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
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

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data States
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'equipment' | 'part' | 'plan' | 'record' | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);

  // Auth Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as UserProfile);
        } else {
          // New user default to operator or admin if it's the first user
          const newUser: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'Usuário',
            role: firebaseUser.email === 'igonaugustobarbosa@gmail.com' ? 'admin' : 'operator'
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          setUser(newUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Sync Effect
  useEffect(() => {
    if (!user) return;

    const qEquip = query(collection(db, 'equipment'), orderBy('createdAt', 'desc'));
    const unsubEquip = onSnapshot(qEquip, (snapshot) => {
      setEquipment(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Equipment)));
    });

    const qRecords = query(collection(db, 'maintenance_records'), orderBy('startDate', 'desc'));
    const unsubRecords = onSnapshot(qRecords, (snapshot) => {
      setMaintenanceRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceRecord)));
    });

    return () => {
      unsubEquip();
      unsubRecords();
    };
  }, [user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    try {
      if (isForgotPassword) {
        await sendPasswordResetEmail(auth, email);
        setAuthSuccess('E-mail de redefinição enviado! Verifique sua caixa de entrada.');
        setIsForgotPassword(false);
      } else if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      let message = error.message;
      if (error.code === 'auth/user-not-found') message = 'Usuário não encontrado.';
      if (error.code === 'auth/wrong-password') message = 'Senha incorreta.';
      if (error.code === 'auth/invalid-email') message = 'E-mail inválido.';
      if (error.code === 'auth/popup-closed-by-user') message = 'Login cancelado.';
      setAuthError(message);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Google Auth error:', error);
      setAuthError(error.message);
    }
  };

  const handleLogout = () => signOut(auth);

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
        <Card className="max-w-md w-full p-8 space-y-6">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mx-auto shadow-xl rotate-3">
              <Wrench className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">GIGA Plan Promaq</h1>
              <p className="text-zinc-500 font-medium">Desenvolvedor: 43 996118806</p>
              <p className="text-zinc-400 text-sm">Sistema de Gestão de Manutenção Industrial</p>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <Input 
              label="E-mail" 
              type="email" 
              value={email} 
              onChange={(e: any) => setEmail(e.target.value)} 
              required 
            />
            {!isForgotPassword && (
              <Input 
                label="Senha" 
                type="password" 
                value={password} 
                onChange={(e: any) => setPassword(e.target.value)} 
                required 
              />
            )}
            
            {authError && (
              <p className="text-red-500 text-xs font-medium text-center bg-red-50 p-2 rounded-lg border border-red-100">
                {authError}
              </p>
            )}

            {authSuccess && (
              <p className="text-emerald-500 text-xs font-medium text-center bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                {authSuccess}
              </p>
            )}

            <Button type="submit" className="w-full py-4 text-lg">
              {isForgotPassword ? 'Enviar E-mail de Recuperação' : isRegistering ? 'Criar Conta' : 'Entrar'}
            </Button>
          </form>

          {!isForgotPassword && !isRegistering && (
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-zinc-400 font-bold">Ou continue com</span>
                </div>
              </div>

              <Button variant="secondary" onClick={handleGoogleLogin} className="w-full py-3">
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                Entrar com Google
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-3 text-center">
            {!isForgotPassword && (
              <button 
                onClick={() => {
                  setIsForgotPassword(true);
                  setAuthError('');
                  setAuthSuccess('');
                }}
                className="text-xs text-zinc-400 hover:text-zinc-600 font-medium transition-colors"
              >
                Esqueceu sua senha?
              </button>
            )}
            
            <button 
              onClick={() => {
                if (isForgotPassword) {
                  setIsForgotPassword(false);
                } else {
                  setIsRegistering(!isRegistering);
                }
                setAuthError('');
                setAuthSuccess('');
              }}
              className="text-sm text-zinc-500 hover:text-black font-medium transition-colors"
            >
              {isForgotPassword ? 'Voltar para o Login' : isRegistering ? 'Já tem uma conta? Entre aqui' : 'Não tem uma conta? Cadastre-se'}
            </button>
          </div>

          <p className="text-xs text-zinc-400 text-center">
            Acesso restrito a pessoal autorizado.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight leading-tight">GIGA Plan Promaq</span>
            <span className="text-[10px] text-zinc-400 font-medium">Dev: 43 996118806</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
          />
          <NavItem 
            active={activeTab === 'equipment'} 
            onClick={() => setActiveTab('equipment')} 
            icon={<HardHat size={20} />} 
            label="Equipamentos" 
          />
          <NavItem 
            active={activeTab === 'maintenance'} 
            onClick={() => setActiveTab('maintenance')} 
            icon={<Clock size={20} />} 
            label="Manutenções" 
          />
          <NavItem 
            active={activeTab === 'parts'} 
            onClick={() => setActiveTab('parts')} 
            icon={<Package size={20} />} 
            label="Peças" 
          />
          <NavItem 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')} 
            icon={<FileText size={20} />} 
            label="Relatórios" 
          />
          {user.role === 'admin' && (
            <NavItem 
              active={activeTab === 'users'} 
              onClick={() => setActiveTab('users')} 
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
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-zinc-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-lg font-bold text-zinc-900 capitalize">{activeTab}</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="pl-10 pr-4 py-2 bg-zinc-100 border-none rounded-full text-sm focus:ring-2 focus:ring-black/5 w-64"
              />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && <Dashboard equipment={equipment} records={maintenanceRecords} />}
          {activeTab === 'equipment' && <EquipmentSection equipment={equipment} user={user} />}
          {activeTab === 'maintenance' && <MaintenanceSection equipment={equipment} records={maintenanceRecords} user={user} />}
          {activeTab === 'parts' && <PartsSection equipment={equipment} user={user} />}
          {activeTab === 'reports' && <ReportsSection equipment={equipment} records={maintenanceRecords} />}
          {activeTab === 'users' && <UsersSection user={user} />}
        </div>
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

function Dashboard({ equipment, records }: { equipment: Equipment[], records: MaintenanceRecord[] }) {
  const activeMaintenances = records.filter(r => r.status === 'in-progress');
  const plannedMaintenances = records.filter(r => r.status === 'planned');
  
  // Simple overdue logic: if an equipment has a plan but no completed record in the last X hours
  const overdueEquip = equipment.filter(equip => {
    const lastRecord = records.find(r => r.equipmentId === equip.id && r.status === 'completed');
    if (!lastRecord) return false; // Or true if we want to flag new equipment?
    // This is a placeholder for more complex logic involving plan intervals
    return false; 
  });
  
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Equipamentos" value={equipment.length} icon={<HardHat className="text-blue-500" />} />
        <StatCard label="Em Manutenção" value={activeMaintenances.length} icon={<Clock className="text-orange-500" />} />
        <StatCard label="Planejadas" value={plannedMaintenances.length} icon={<AlertCircle className="text-zinc-500" />} />
        <StatCard label="Concluídas (Mês)" value={records.filter(r => r.status === 'completed').length} icon={<CheckCircle2 className="text-emerald-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-zinc-900">Manutenções em Andamento</h3>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Tempo Real</span>
          </div>
          <div className="space-y-4">
            {activeMaintenances.length > 0 ? activeMaintenances.map(record => (
              <div key={record.id} className="flex items-center gap-4 p-4 rounded-xl bg-orange-50 border border-orange-100">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Clock className="text-orange-600" size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-zinc-900">{record.equipmentName}</p>
                  <p className="text-xs text-orange-600 font-medium">{record.planDescription}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-zinc-400 uppercase">Início</p>
                  <p className="text-sm font-bold">{format(parseISO(record.startDate), 'HH:mm')}</p>
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
            <h3 className="font-bold text-zinc-900">Equipamentos Críticos</h3>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Status</span>
          </div>
          <div className="space-y-4">
            {equipment.slice(0, 5).map(item => (
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

function EquipmentSection({ equipment, user }: { equipment: Equipment[], user: UserProfile }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [viewingItem, setViewingItem] = useState<Equipment | null>(null);
  
  const [photoSource, setPhotoSource] = useState<'url' | 'file'>('url');
  const [manualSource, setManualSource] = useState<'url' | 'file'>('url');
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [manualBase64, setManualBase64] = useState<string>('');

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
        alert("Arquivo muito grande. O limite é de aproximadamente 800KB.");
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
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      model: formData.get('model') as string,
      serialNumber: formData.get('serialNumber') as string,
      technicalInfo: formData.get('technicalInfo') as string,
      photoUrl: photoSource === 'file' ? photoBase64 : formData.get('photoUrl') as string,
      manualUrl: manualSource === 'file' ? manualBase64 : formData.get('manualUrl') as string,
      currentHours: Number(formData.get('currentHours')),
      avgHoursPerDay: Number(formData.get('avgHoursPerDay')),
      createdAt: editingItem?.createdAt || new Date().toISOString()
    };

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'equipment', editingItem.id), data);
      } else {
        await addDoc(collection(db, 'equipment'), data);
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving equipment:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este equipamento?')) return;
    try {
      await deleteDoc(doc(db, 'equipment', id));
    } catch (error) {
      console.error('Error deleting equipment:', error);
    }
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
        {equipment.map(item => (
          <Card key={item.id} className="group">
            <div className="h-48 bg-zinc-100 relative overflow-hidden">
              {item.photoUrl ? (
                <img src={item.photoUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-300">
                  <HardHat size={48} />
                </div>
              )}
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setViewingItem(item)}
                  className="p-2 bg-white/90 backdrop-blur rounded-lg shadow-lg text-zinc-700 hover:bg-white"
                >
                  <Eye size={16} />
                </button>
                {user.role !== 'operator' && (
                  <>
                    <button 
                      onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                      className="p-2 bg-white/90 backdrop-blur rounded-lg shadow-lg text-zinc-700 hover:bg-white"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 bg-white/90 backdrop-blur rounded-lg shadow-lg text-red-600 hover:bg-white"
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
              <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Package size={14} />
                  <span className="text-xs font-medium">S/N: {item.serialNumber}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <Clock size={14} />
                  <span className="text-xs font-medium">{item.currentHours || 0}h</span>
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
            <Input label="Número de Série" name="serialNumber" defaultValue={editingItem?.serialNumber} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Horímetro Atual (h)" name="currentHours" type="number" defaultValue={editingItem?.currentHours || 0} required />
            <Input label="Média de Uso (h/dia)" name="avgHoursPerDay" type="number" step="0.1" defaultValue={editingItem?.avgHoursPerDay || 0} required />
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
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit">Salvar Equipamento</Button>
          </div>
        </form>
      </Modal>

      {/* Detail View Modal */}
      <Modal 
        isOpen={!!viewingItem} 
        onClose={() => setViewingItem(null)} 
        title={viewingItem?.name || ''}
      >
        {viewingItem && (
          <div className="space-y-6">
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
            
            <PartsList equipmentId={viewingItem.id} user={user} />
            <PlansList equipment={viewingItem} user={user} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function PartsList({ equipmentId, user }: { equipmentId: string, user: UserProfile }) {
  const [parts, setParts] = useState<Part[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'equipment', equipmentId, 'parts'));
    return onSnapshot(q, (snapshot) => {
      setParts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Part)));
    });
  }, [equipmentId]);

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
        {parts.map(part => (
          <div key={part.id} className="flex items-center justify-between p-3 bg-white border border-zinc-100 rounded-lg text-sm">
            <div>
              <p className="font-bold">{part.name}</p>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">CÓD: {part.code}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-zinc-900">R$ {part.cost.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlansList({ equipment, user }: { equipment: Equipment, user: UserProfile }) {
  const equipmentId = equipment.id;
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [lastRecords, setLastRecords] = useState<Record<string, MaintenanceRecord>>({});
  const [isAdding, setIsAdding] = useState(false);
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
    const formData = new FormData(e.currentTarget);
    const data = {
      equipmentId,
      description: formData.get('description') as string,
      intervalHours: Number(formData.get('intervalHours')),
      partsRequired: selectedParts.filter(p => p.quantity > 0)
    };
    try {
      await addDoc(collection(db, 'equipment', equipmentId, 'plans'), data);
      setIsAdding(false);
      setSelectedParts([]);
    } catch (error) {
      console.error("Erro ao adicionar plano:", error);
      alert("Erro ao salvar o plano. Verifique os campos e tente novamente.");
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
          <button onClick={() => setIsAdding(true)} className="text-xs font-bold text-black hover:underline flex items-center gap-1">
            <Plus size={12} /> Novo Plano
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleAddPlan} className="p-4 bg-zinc-50 rounded-xl space-y-4 border border-zinc-200">
          <Input label="Descrição da Manutenção" name="description" placeholder="Ex: Revisão de 500h" required />
          <Input label="Intervalo (Horas)" name="intervalHours" type="number" placeholder="500" required />
          
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Peças Necessárias para este Plano</p>
            {parts.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2">
                {parts.map(part => (
                  <div key={part.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-zinc-100">
                    <span className="text-xs font-medium">{part.name}</span>
                    <input 
                      type="number" 
                      min="0"
                      placeholder="Qtd"
                      className="w-16 px-2 py-1 text-xs border border-zinc-200 rounded"
                      onChange={(e) => handlePartToggle(part.id, Number(e.target.value))}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-zinc-400 italic">Cadastre peças primeiro para selecioná-las no plano.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" className="text-xs" onClick={() => setIsAdding(false)}>Cancelar</Button>
            <Button type="submit" className="text-xs">Salvar Plano</Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {plans.length > 0 ? plans.map(plan => (
          <div key={plan.id} className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-bold text-zinc-900">{plan.description}</p>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Intervalo: {plan.intervalHours}h</p>
                  {calculateDaysRemaining(plan) !== null && (
                    <p className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                      (calculateDaysRemaining(plan) || 0) <= 7 ? 'text-red-600 bg-red-50 border-red-100' : 
                      (calculateDaysRemaining(plan) || 0) <= 15 ? 'text-orange-600 bg-orange-50 border-orange-100' : 
                      'text-emerald-600 bg-emerald-50 border-emerald-100'
                    }`}>
                      Próxima em: {calculateDaysRemaining(plan)} dias
                    </p>
                  )}
                </div>
              </div>
              <button 
                onClick={async () => {
                  if(confirm('Deseja excluir este plano?')) {
                    await deleteDoc(doc(db, 'equipment', equipmentId, 'plans', plan.id));
                  }
                }}
                className="text-zinc-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
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

function MaintenanceSection({ equipment, records, user }: { equipment: Equipment[], records: MaintenanceRecord[], user: UserProfile }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [completingRecord, setCompletingRecord] = useState<MaintenanceRecord | null>(null);
  const [selectedEquipId, setSelectedEquipId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [equipmentParts, setEquipmentParts] = useState<Part[]>([]);
  const [selectedParts, setSelectedParts] = useState<{ partId: string, quantity: number }[]>([]);
  const [calculatedStartDate, setCalculatedStartDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'planned' | 'in-progress' | 'completed'>('all');

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

    const data: any = {
      equipmentId: selectedEquipId,
      equipmentName: equip.name,
      planId: selectedPlanId,
      planDescription: plan.description,
      status: 'in-progress',
      startDate: new Date().toISOString(),
      scheduledStartDate: formData.get('scheduledStartDate') as string,
      hoursPerDay: Number(formData.get('hoursPerDay')),
      scheduledStartTime: formData.get('scheduledStartTime') as string,
      scheduledEndTime: formData.get('scheduledEndTime') as string,
      totalPartsCost,
      totalLaborCost,
      usedParts
    };

    await addDoc(collection(db, 'maintenance_records'), data);
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
      scheduledStartDate: formData.get('scheduledStartDate') as string,
      hoursPerDay: Number(formData.get('hoursPerDay')),
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

    const update: any = { 
      status: 'completed',
      endDate: new Date().toISOString(),
      hourMeter
    };

    // Update record
    await updateDoc(doc(db, 'maintenance_records', completingRecord.id), update);
    
    // Update equipment current hours
    await updateDoc(doc(db, 'equipment', completingRecord.equipmentId), {
      currentHours: hourMeter
    });

    setIsCompleteModalOpen(false);
    setCompletingRecord(null);
  };

  const filteredRecords = records.filter(record => {
    if (statusFilter === 'all') return true;
    return record.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-zinc-900">Controle de Manutenções</h3>
          <p className="text-zinc-500">Acompanhe e execute as manutenções preventivas.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-48">
            <Select 
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Todos Status' },
                { value: 'in-progress', label: 'Em Andamento' },
                { value: 'completed', label: 'Completas' }
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  record.status === 'in-progress' ? 'bg-orange-100 text-orange-600' : 
                  record.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 
                  'bg-zinc-100 text-zinc-400'
                }`}>
                  {record.status === 'in-progress' ? <Clock /> : record.status === 'completed' ? <CheckCircle2 /> : <AlertCircle />}
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900">{record.equipmentName}</h4>
                  <p className="text-sm text-zinc-500">{record.planDescription}</p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</p>
                  <p className={`text-sm font-bold capitalize ${
                    record.status === 'in-progress' ? 'text-orange-600' : 
                    record.status === 'completed' ? 'text-emerald-600' : 
                    'text-zinc-500'
                  }`}>{record.status}</p>
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
              <Input label="Hora Início" name="scheduledStartTime" type="time" required />
              <Input label="Hora Fim" name="scheduledEndTime" type="time" required />
            </div>
          </div>

          <div className="space-y-4 border-t border-zinc-100 pt-4">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Peças e Custos</h4>
            <Input label="Valor Mão de Obra (R$)" name="totalLaborCost" type="number" step="0.01" defaultValue="0" />
            
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Peças Cadastradas</p>
              {equipmentParts.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {equipmentParts.map(part => (
                    <div key={part.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                      <div className="flex-1">
                        <p className="text-sm font-bold">{part.name}</p>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold">R$ {part.cost.toFixed(2)}/un</p>
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
              <Input 
                label="Horímetro Atual na Finalização (h)" 
                name="hourMeter" 
                type="number" 
                required 
                placeholder="Ex: 1250"
              />
              <p className="text-[10px] text-zinc-500 italic">
                O horímetro do equipamento será atualizado automaticamente com este valor.
              </p>
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
              <Input 
                label="Valor Mão de Obra (R$)" 
                name="totalLaborCost" 
                type="number" 
                step="0.01" 
                defaultValue={editingRecord.totalLaborCost || 0} 
              />
              
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Peças Utilizadas</p>
                {equipmentParts.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {equipmentParts.map(part => (
                      <div key={part.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                        <div className="flex-1">
                          <p className="text-sm font-bold">{part.name}</p>
                          <p className="text-[10px] text-zinc-400 uppercase font-bold">R$ {part.cost.toFixed(2)}/un</p>
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

function PartsSection({ equipment, user }: { equipment: Equipment[], user: UserProfile }) {
  const [selectedEquipId, setSelectedEquipId] = useState(equipment[0]?.id || '');

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
          {equipment.map(item => (
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
              <PartsList equipmentId={selectedEquipId} user={user} />
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

function ReportsSection({ equipment, records }: { equipment: Equipment[], records: MaintenanceRecord[] }) {
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedEquipId, setSelectedEquipId] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'planned' | 'in-progress' | 'completed'>('all');
  
  const filteredRecords = records.filter(r => {
    const matchesDate = r.startDate.startsWith(filterDate);
    const matchesEquip = selectedEquipId === 'all' || r.equipmentId === selectedEquipId;
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesDate && matchesEquip && matchesStatus;
  });
  
  const totalCost = filteredRecords.reduce((acc, r) => acc + (r.totalPartsCost || 0) + (r.totalLaborCost || 0), 0);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const equipName = selectedEquipId === 'all' ? 'Todos' : equipment.find(e => e.id === selectedEquipId)?.name || 'N/A';
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text('GIGA Plan Promaq - Relatório de Manutenção', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Equipamento: ${equipName}`, 14, 30);
    doc.text(`Período: ${filterDate}`, 14, 35);
    doc.text(`Status: ${statusFilter === 'all' ? 'Todos' : statusFilter}`, 14, 40);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 45);
    
    // Summary
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Resumo Financeiro', 14, 50);
    doc.setFontSize(10);
    doc.text(`Total de Intervenções: ${filteredRecords.length}`, 14, 57);
    doc.text(`Custo Total: R$ ${totalCost.toLocaleString()}`, 14, 62);
    
    autoTable(doc, {
      startY: 75,
      head: [['Data', 'Equipamento', 'Manutenção', 'Status', 'Peças Utilizadas', 'Mão de Obra', 'Custo Peças Detalhado', 'Total Geral']],
      body: filteredRecords.map(r => [
        format(parseISO(r.startDate), 'dd/MM/yyyy'),
        r.equipmentName || 'N/A',
        r.planDescription || 'N/A',
        r.status,
        r.usedParts?.map(p => `${p.name} (x${p.quantity})`).join('\n') || 'Nenhuma',
        `R$ ${(r.totalLaborCost || 0).toFixed(2)}`,
        r.usedParts?.map(p => `R$ ${(p.unitCost * p.quantity).toFixed(2)} (${p.quantity}x R$ ${p.unitCost.toFixed(2)})`).join('\n') + 
        (r.usedParts && r.usedParts.length > 0 ? `\n----------------\nTotal Peças: R$ ${r.totalPartsCost?.toFixed(2)}` : '\nR$ 0.00'),
        `R$ ${((r.totalLaborCost || 0) + (r.totalPartsCost || 0)).toFixed(2)}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [0, 0, 0] },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        4: { cellWidth: 35 }, // Peças Utilizadas
        6: { cellWidth: 45 }, // Custo Peças Detalhado
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
                { value: 'completed', label: 'Completas' }
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
        <StatCard label="Custo Total" value={`R$ ${totalCost.toLocaleString()}`} icon={<Clock className="text-emerald-500" />} />
        <StatCard label="Média por Máquina" value={`R$ ${filteredRecords.length ? (totalCost / filteredRecords.length).toFixed(2) : 0}`} icon={<Filter className="text-blue-500" />} />
      </div>

      <Card>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Data</th>
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Equipamento</th>
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Manutenção</th>
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Peças Detalhadas</th>
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Mão de Obra</th>
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Peças (R$)</th>
              <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map(record => (
              <tr key={record.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                <td className="p-4 text-sm font-medium">{format(parseISO(record.startDate), 'dd/MM/yyyy')}</td>
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
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-50 font-bold">
              <td colSpan={7} className="p-4 text-right text-zinc-500 uppercase tracking-widest text-[10px]">Soma Total</td>
              <td className="p-4 text-right text-lg">R$ {totalCost.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}

function UsersSection({ user }: { user: UserProfile }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'));
    return onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(d => d.data() as UserProfile));
    });
  }, []);

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    if (uid === user.uid) {
      alert('Você não pode alterar seu próprio nível de acesso.');
      return;
    }
    await updateDoc(doc(db, 'users', uid), { role: newRole });
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as UserRole;

    try {
      // Create a secondary app to create user without logging out current admin
      const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = userCredential.user.uid;
      
      await setDoc(doc(db, 'users', uid), {
        uid,
        email,
        name,
        role
      });

      await secondarySignOut(secondaryAuth);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error creating user:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (uid === user.uid) {
      alert('Você não pode excluir seu próprio usuário.');
      return;
    }
    if (confirm('Tem certeza que deseja excluir este usuário? O acesso será revogado, mas o registro no Firebase Auth permanecerá (exclusão manual necessária no console para remoção total).')) {
      await deleteDoc(doc(db, 'users', uid));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-zinc-900">Gestão de Usuários</h3>
          <p className="text-zinc-500">Controle quem tem acesso ao sistema e seus níveis de permissão.</p>
        </div>
        {user.role === 'admin' && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={20} /> Novo Usuário
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map(u => (
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
                <p className="text-xs text-zinc-500 truncate">{u.email}</p>
              </div>
              {user.role === 'admin' && u.uid !== user.uid && (
                <button 
                  onClick={() => handleDeleteUser(u.uid)}
                  className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
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
                  { value: 'operator', label: 'Operador' }
                ]}
                disabled={u.uid === user.uid || user.role !== 'admin'}
              />
            </div>
          </Card>
        ))}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Criar Novo Usuário"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input label="Nome Completo" name="name" required />
          <Input label="E-mail" name="email" type="email" required />
          <Input label="Senha" name="password" type="password" required minLength={6} />
          <Select 
            label="Nível de Acesso" 
            name="role" 
            options={[
              { value: 'operator', label: 'Operador (Apenas visualização e registros)' },
              { value: 'supervisor', label: 'Supervisor (Gestão de planos e peças)' },
              { value: 'admin', label: 'Administrador (Acesso total)' }
            ]} 
          />
          
          {error && (
            <p className="text-red-500 text-xs font-medium text-center bg-red-50 p-2 rounded-lg border border-red-100">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
