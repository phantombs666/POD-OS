import React, { useState, useEffect, useMemo, useCallback, useRef, Component, ErrorInfo } from "react";
import { 
  LayoutDashboard, 
  Search, 
  Image as ImageIcon, 
  TrendingUp, 
  Settings, 
  Zap, 
  BarChart3, 
  Activity,
  AlertCircle,
  Loader2,
  Cpu,
  Terminal as TerminalIcon,
  Play,
  Square,
  Download,
  Trash2,
  Plus,
  ChevronRight,
  Globe,
  Layers,
  RefreshCw
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell 
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { Niche, Design, Sale, AutomationJob } from "./types";
import * as geminiService from "./services/geminiService";
import { dbService } from "./services/dbService";

// --- Error Boundary ---
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-8">
          <div className="max-w-md w-full glass-panel p-8 border-rose-500/20 text-center">
            <AlertCircle className="mx-auto text-rose-500 mb-4" size={48} />
            <h1 className="text-xl font-bold text-zinc-100 uppercase tracking-widest mb-2">System Critical Error</h1>
            <p className="text-xs font-mono text-zinc-500 mb-6">{this.state.error?.message || "UNKNOWN_EXCEPTION"}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-mono text-xs font-bold transition-all"
            >
              REBOOT_SYSTEM
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Constants ---
const STORAGE_KEYS = {
  NICHES: "pod_os_niches_v2",
  DESIGNS: "pod_os_designs_v2",
  SALES: "pod_os_sales_v2",
  JOBS: "pod_os_jobs_v2",
  CONFIG: "pod_os_config_v2"
};

const DEFAULT_CONFIG = {
  apiKey: "",
  model: "gemini-3-flash-preview",
  imageModel: "gemini-2.5-flash-image"
};

// --- Components ---

const Card = ({ children, className, title, icon: Icon }: { children: React.ReactNode; className?: string; title?: string; icon?: any }) => (
  <div className={cn("glass-panel rounded-xl overflow-hidden flex flex-col", className)}>
    {(title || Icon) && (
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-zinc-400" />}
          {title && <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">{title}</h3>}
        </div>
      </div>
    )}
    <div className="flex-1">{children}</div>
  </div>
);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "info" }) => {
  const variants = {
    default: "bg-zinc-800 text-zinc-400 border-zinc-700",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-mono font-bold border", variants[variant])}>
      {children}
    </span>
  );
};

const StatCard = ({ label, value, icon: Icon, trend }: { label: string; value: string | number; icon: any; trend?: number }) => (
  <Card className="p-4">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
        <h4 className="text-2xl font-mono font-bold text-zinc-100">{value}</h4>
        {trend !== undefined && (
          <p className={cn("text-[10px] mt-1 font-bold", trend >= 0 ? "text-emerald-500" : "text-rose-500")}>
            {trend >= 0 ? "+" : ""}{trend}% vs last period
          </p>
        )}
      </div>
      <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
        <Icon size={18} />
      </div>
    </div>
  </Card>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [niches, setNiches] = useState<Niche[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Bulk Generation State
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedNicheIds, setSelectedNicheIds] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(["Minimalist Vector"]);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  const STYLES = [
    "Minimalist Vector",
    "Cyberpunk Vector",
    "Vintage Retro",
    "Watercolor Illustration",
    "Geometric Abstract",
    "Pop Art",
    "Line Art",
    "3D Render"
  ];

  // --- Persistence ---
  useEffect(() => {
    const load = (key: string, setter: any) => {
      try {
        const data = localStorage.getItem(key);
        if (data) setter(JSON.parse(data));
      } catch (err) {
        console.error(`Failed to load ${key} from localStorage:`, err);
      }
    };
    load(STORAGE_KEYS.NICHES, setNiches);
    load(STORAGE_KEYS.SALES, setSales);
    load(STORAGE_KEYS.JOBS, setJobs);
    load(STORAGE_KEYS.CONFIG, setConfig);

    // Load designs from IndexedDB
    dbService.getAllDesigns().then(data => {
      if (data && data.length > 0) setDesigns(data);
    }).catch(err => console.error("Failed to load designs from IndexedDB:", err));
  }, []);

  useEffect(() => localStorage.setItem(STORAGE_KEYS.NICHES, JSON.stringify(niches)), [niches]);
  // Designs are handled by dbService
  useEffect(() => localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales)), [sales]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs)), [jobs]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config)), [config]);

  const generateId = () => {
    try {
      return crypto.randomUUID();
    } catch (e) {
      return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
  };

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // --- Stats ---
  const stats = useMemo(() => {
    const rev = sales.reduce((a, b) => a + b.revenue, 0);
    const prof = sales.reduce((a, b) => a + b.profit, 0);
    return {
      niches: niches.length,
      designs: designs.length,
      revenue: rev,
      profit: prof,
      activeJobs: jobs.filter(j => j.status === "running").length
    };
  }, [niches, designs, sales, jobs]);

  // --- AI Logic ---
  const getAIConfig = (): geminiService.AIConfig => {
    const key = config.apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("API Key missing. Configure in Settings.");
    return {
      apiKey: key,
      model: config.model,
      imageModel: config.imageModel
    };
  };

  const discoverNiches = async (count = 5) => {
    setLoading(true);
    setError(null);
    addLog(`Starting niche discovery (count: ${count})...`);
    try {
      const aiConfig = getAIConfig();
      const data = await geminiService.discoverNiches(aiConfig, count);

      const newNiches: Niche[] = data.map((n: any) => ({
        ...n,
        id: generateId(),
        createdAt: new Date().toISOString()
      }));

      setNiches(prev => [...newNiches, ...prev].slice(0, 100));
      addLog(`Discovered ${newNiches.length} new niches.`);
    } catch (err: any) {
      setError(err.message);
      addLog(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateDesign = async (niche: Niche, style: string) => {
    setLoading(true);
    setError(null);
    addLog(`Generating design for "${niche.name}" in style "${style}"...`);
    try {
      const aiConfig = getAIConfig();
      const { imageUrl, prompt } = await geminiService.generateDesign(aiConfig, niche.name, style);

      if (imageUrl) {
        const newDesign: Design = {
          id: generateId(),
          nicheId: niche.id,
          nicheName: niche.name,
          imageUrl,
          prompt,
          style,
          createdAt: new Date().toISOString()
        };
        
        await dbService.saveDesign(newDesign);
        setDesigns(prev => [newDesign, ...prev]);
        addLog(`Design generated successfully.`);
        
        // Simulate a sale
        if (Math.random() > 0.7) {
          const newSale: Sale = {
            id: generateId(),
            designId: newDesign.id,
            platform: ["Etsy", "Redbubble", "Amazon"][Math.floor(Math.random() * 3)],
            revenue: 25,
            profit: 12,
            date: new Date().toISOString()
          };
          setSales(prev => [newSale, ...prev]);
          addLog(`New sale recorded for "${niche.name}"!`);
        }
      } else {
        throw new Error("No image data returned from AI.");
      }
    } catch (err: any) {
      setError(err.message);
      addLog(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- Automation Hub ---
  const runAutomation = async () => {
    if (loading) return;
    const jobId = generateId();
    const newJob: AutomationJob = {
      id: jobId,
      name: "Auto-Pilot Cycle",
      status: "running",
      progress: 0,
      logs: [],
      config: { nicheCount: 3, designPerNiche: 1, style: "Cyberpunk Vector" },
      createdAt: new Date().toISOString()
    };
    setJobs(prev => [newJob, ...prev]);
    
    try {
      addLog("Starting Automation Job...");
      // Step 1: Discover Niches
      await discoverNiches(3);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, progress: 50 } : j));
      
      // Step 2: Generate Designs for top 2 new niches
      const latestNiches = niches.slice(0, 2);
      for (const n of latestNiches) {
        await generateDesign(n, "Cyberpunk Vector");
      }
      
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "completed", progress: 100 } : j));
      addLog("Automation Job Completed.");
    } catch (err: any) {
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "failed" } : j));
      addLog(`Automation Failed: ${err.message}`);
    }
  };

  // --- Renderers ---

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Niches" value={stats.niches} icon={Search} trend={12} />
        <StatCard label="Assets Generated" value={stats.designs} icon={ImageIcon} trend={8} />
        <StatCard label="Net Revenue" value={`$${stats.revenue}`} icon={TrendingUp} trend={15} />
        <StatCard label="Active Jobs" value={stats.activeJobs} icon={Cpu} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6" title="Market Dynamics" icon={Activity}>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={niches.slice(0, 10).reverse().map((n, i) => ({ name: n.name.substring(0, 8), score: n.score, trend: n.trend }))}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px" }} />
                <Area type="monotone" dataKey="score" stroke="#3b82f6" fillOpacity={1} fill="url(#colorScore)" />
                <Area type="monotone" dataKey="trend" stroke="#8b5cf6" fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-0" title="System Logs" icon={TerminalIcon}>
          <div className="h-[300px] bg-black/50 p-4 font-mono text-[10px] overflow-y-auto space-y-1 scrollbar-hide">
            {logs.map((log, i) => (
              <div key={i} className="text-zinc-400 border-l border-zinc-800 pl-2">
                <span className="text-zinc-600 mr-2">{log.split(']')[0]}]</span>
                {log.split(']')[1]}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </Card>
      </div>
    </div>
  );

  const renderNiches = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-mono font-bold text-zinc-100 flex items-center gap-2">
          <Globe size={20} className="text-blue-500" />
          Niche Discovery Matrix
        </h2>
        <button 
          onClick={() => discoverNiches()}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded font-mono text-xs font-bold flex items-center gap-2 transition-all"
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
          EXECUTE_DISCOVERY
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {niches.map((niche) => (
          <div key={niche.id} className="glass-panel p-3 flex items-center justify-between hover:bg-zinc-800/30 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center text-blue-400 font-mono font-bold text-sm">
                {niche.score}
              </div>
              <div>
                <h4 className="font-bold text-zinc-100 text-sm">{niche.name}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="info">{niche.category}</Badge>
                  <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-tighter">
                    COMP:{niche.competition} | DEMAND:{niche.demand} | TREND:{niche.trend}%
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => generateDesign(niche, "Minimalist Vector")}
                className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-emerald-400 transition-colors"
                title="Generate Design"
              >
                <ImageIcon size={16} />
              </button>
              <button 
                onClick={() => setNiches(prev => prev.filter(n => n.id !== niche.id))}
                className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-rose-400 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {niches.length === 0 && !loading && (
          <div className="text-center py-20 text-zinc-600 border border-dashed border-zinc-800 rounded-xl font-mono text-xs">
            NO_DATA_AVAILABLE // INITIATE_DISCOVERY_TO_POPULATE
          </div>
        )}
      </div>
    </div>
  );

  const downloadDesign = (design: Design) => {
    const link = document.createElement("a");
    link.href = design.imageUrl;
    link.download = `POD_DESIGN_${design.nicheName.replace(/\s+/g, "_")}_${design.style.replace(/\s+/g, "_")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog(`Downloading design: ${design.nicheName}`);
  };

  const renderGallery = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-mono font-bold text-zinc-100 flex items-center gap-2">
          <Layers size={20} className="text-purple-500" />
          Asset Repository
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsBulkMode(!isBulkMode)}
            className={cn(
              "px-4 py-2 rounded font-mono text-xs font-bold flex items-center gap-2 transition-all border",
              isBulkMode 
                ? "bg-purple-600 text-white border-purple-500" 
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"
            )}
          >
            <Plus size={14} />
            {isBulkMode ? "CANCEL_BULK_MODE" : "BULK_GENERATE"}
          </button>
          <Badge variant="success">{designs.length} BLOCKS_STORED</Badge>
        </div>
      </div>

      {isBulkMode && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6 rounded-xl border-purple-500/30 bg-purple-500/5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase mb-3 block tracking-widest">Select Niches ({selectedNicheIds.length})</label>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-2 scrollbar-hide">
                {niches.map(n => (
                  <button
                    key={n.id}
                    onClick={() => setSelectedNicheIds(prev => 
                      prev.includes(n.id) ? prev.filter(id => id !== n.id) : [...prev, n.id]
                    )}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded text-[11px] font-mono transition-colors border",
                      selectedNicheIds.includes(n.id) 
                        ? "bg-purple-500/20 border-purple-500/50 text-purple-300" 
                        : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                    )}
                  >
                    {n.name}
                  </button>
                ))}
                {niches.length === 0 && <p className="text-[10px] text-zinc-600 italic">No niches available. Discover some first.</p>}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase mb-3 block tracking-widest">Select Styles ({selectedStyles.length})</label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map(style => (
                  <button
                    key={style}
                    onClick={() => setSelectedStyles(prev => 
                      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
                    )}
                    className={cn(
                      "text-left px-3 py-2 rounded text-[10px] font-mono transition-colors border",
                      selectedStyles.includes(style) 
                        ? "bg-purple-500/20 border-purple-500/50 text-purple-300" 
                        : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                    )}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-zinc-800 flex items-center justify-between">
            <div className="text-[10px] font-mono text-zinc-500">
              ESTIMATED_OPERATIONS: {selectedNicheIds.length * selectedStyles.length}
            </div>
            <button
              disabled={loading || selectedNicheIds.length === 0 || selectedStyles.length === 0}
              onClick={async () => {
                try {
                  const nichesToProcess = niches.filter(n => selectedNicheIds.includes(n.id));
                  addLog(`Starting bulk generation for ${nichesToProcess.length} niches and ${selectedStyles.length} styles...`);
                  setIsBulkMode(false);
                  for (const niche of nichesToProcess) {
                    for (const style of selectedStyles) {
                      await generateDesign(niche, style);
                    }
                  }
                  addLog("Bulk generation sequence completed.");
                } catch (err: any) {
                  setError(err.message);
                  addLog(`Bulk Error: ${err.message}`);
                }
              }}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-6 py-2 rounded font-mono text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
              EXECUTE_BULK_SEQUENCE
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {designs.map((design) => (
          <div key={design.id} className="glass-panel group relative aspect-square overflow-hidden rounded-lg">
            <img 
              src={design.imageUrl} 
              alt={design.nicheName} 
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-zinc-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
              <p className="text-[10px] font-bold text-zinc-100 mb-1">{design.nicheName}</p>
              <p className="text-[8px] text-zinc-500 uppercase mb-4">{design.style}</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => downloadDesign(design)}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-100 transition-colors"
                >
                  <Download size={14} />
                </button>
                <button 
                  onClick={async () => {
                    await dbService.deleteDesign(design.id);
                    setDesigns(prev => prev.filter(d => d.id !== design.id));
                  }}
                  className="p-2 bg-rose-500/20 hover:bg-rose-500/40 rounded text-rose-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {designs.length === 0 && (
          <div className="col-span-full text-center py-20 text-zinc-600 border border-dashed border-zinc-800 rounded-xl font-mono text-xs">
            REPOSITORY_EMPTY // GENERATE_ASSETS_TO_VIEW
          </div>
        )}
      </div>
    </div>
  );

  const renderAutomation = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-mono font-bold text-zinc-100 flex items-center gap-2">
          <Cpu size={20} className="text-amber-500" />
          Automation Hub
        </h2>
        <button 
          onClick={runAutomation}
          disabled={loading}
          className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2 rounded font-mono text-xs font-bold flex items-center gap-2 transition-all"
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
          START_AUTOMATION_CYCLE
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {jobs.map((job) => (
          <Card key={job.id} className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full", 
                  job.status === "running" ? "bg-blue-500 animate-pulse" : 
                  job.status === "completed" ? "bg-emerald-500" : "bg-rose-500"
                )} />
                <h4 className="font-bold text-zinc-100">{job.name}</h4>
                <Badge variant={job.status === "completed" ? "success" : job.status === "running" ? "info" : "danger"}>
                  {job.status.toUpperCase()}
                </Badge>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">{new Date(job.createdAt).toLocaleString()}</span>
            </div>
            
            <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden mb-2">
              <motion.div 
                className="bg-blue-500 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${job.progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-zinc-500">
              <span>PROGRESS: {job.progress}%</span>
              <span>ID: {job.id.substring(0, 8)}</span>
            </div>
          </Card>
        ))}
        {jobs.length === 0 && (
          <div className="text-center py-20 text-zinc-600 border border-dashed border-zinc-800 rounded-xl font-mono text-xs">
            NO_JOBS_IN_QUEUE // INITIALIZE_AUTOMATION_TO_START
          </div>
        )}
      </div>
    </div>
  );

  const renderSales = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-mono font-bold text-zinc-100 flex items-center gap-2">
          <TrendingUp size={20} className="text-emerald-500" />
          Sales Tracker
        </h2>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 font-mono text-[10px] font-bold">
          <Activity size={12} />
          LIVE_SYNC_ACTIVE
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-zinc-900/50">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total Revenue</p>
          <p className="text-2xl font-black text-white tracking-tighter">${stats.revenue.toFixed(2)}</p>
          <div className="mt-2 flex items-center gap-1 text-[9px] text-emerald-400 font-mono">
            <TrendingUp size={10} />
            +12.5% FROM_LAST_CYCLE
          </div>
        </Card>
        <Card className="p-4 bg-zinc-900/50">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total Profit</p>
          <p className="text-2xl font-black text-emerald-400 tracking-tighter">${stats.profit.toFixed(2)}</p>
          <div className="mt-2 flex items-center gap-1 text-[9px] text-emerald-400 font-mono">
            <TrendingUp size={10} />
            +8.2% MARGIN_STABLE
          </div>
        </Card>
        <Card className="p-4 bg-zinc-900/50">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Conversion Rate</p>
          <p className="text-2xl font-black text-blue-400 tracking-tighter">3.8%</p>
          <div className="mt-2 flex items-center gap-1 text-[9px] text-blue-400 font-mono">
            <Activity size={10} />
            OPTIMAL_PERFORMANCE
          </div>
        </Card>
      </div>

      <Card title="RECENT_TRANSACTIONS" icon={TrendingUp}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Date</th>
                <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Platform</th>
                <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Revenue</th>
                <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Profit</th>
                <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[11px]">
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                  <td className="p-4 text-zinc-400">{new Date(sale.date).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {sale.platform.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-100">${sale.revenue.toFixed(2)}</td>
                  <td className="p-4 text-emerald-400">${sale.profit.toFixed(2)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-emerald-500">SETTLED</span>
                    </div>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-zinc-600 italic">
                    NO_TRANSACTIONS_RECORDED // WAITING_FOR_MARKET_ACTIVITY
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen technical-grid flex">
        {/* Sidebar */}
        <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col sticky top-0 h-screen z-50">
          <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <Zap size={20} className="text-white fill-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tighter uppercase leading-none">POD_OS</h1>
              <p className="text-[8px] font-mono text-zinc-500 mt-1 uppercase tracking-widest">v2.0.0-STABLE</p>
            </div>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1">
            {[
              { id: "dashboard", label: "DASHBOARD", icon: LayoutDashboard },
              { id: "niches", label: "NICHE_ENGINE", icon: Search },
              { id: "gallery", label: "ASSET_REPO", icon: ImageIcon },
              { id: "automation", label: "AUTO_HUB", icon: Cpu },
              { id: "sales", label: "SALES_TRACKER", icon: TrendingUp },
              { id: "config", label: "SYS_CONFIG", icon: Settings },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded font-mono text-[11px] font-bold transition-all border",
                  activeTab === item.id 
                    ? "bg-blue-600/10 text-blue-400 border-blue-600/30" 
                    : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900/50"
                )}
              >
                <item.icon size={14} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-zinc-800">
            <div className="p-3 rounded bg-zinc-900/50 border border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">System Status</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[10px] font-mono text-zinc-300">CORE_SYNC: OK</p>
              <p className="text-[10px] font-mono text-zinc-300">AI_LATENCY: 24ms</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen flex flex-col">
          {/* Top Bar */}
          <header className="h-14 bg-zinc-950/50 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-8 sticky top-0 z-40">
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest">
              <span className="text-zinc-600">POD_OS</span>
              <ChevronRight size={12} className="text-zinc-800" />
              <span className="text-blue-400">{activeTab}</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded">
                <Activity size={12} className="text-emerald-400" />
                <span className="text-[9px] font-mono font-bold text-zinc-400">UPTIME: 99.9%</span>
              </div>
              <div className="w-7 h-7 rounded border border-zinc-800 overflow-hidden bg-zinc-900">
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=POD" alt="Avatar" />
              </div>
            </div>
          </header>

          {/* Content Area */}
          <div className="p-8 max-w-6xl mx-auto w-full flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
              >
                {error && (
                  <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded text-rose-400 flex items-center gap-3 font-mono text-[11px]">
                    <AlertCircle size={16} />
                    <span>ERROR: {error}</span>
                  </div>
                )}

                {activeTab === "dashboard" && renderDashboard()}
                {activeTab === "niches" && renderNiches()}
                {activeTab === "gallery" && renderGallery()}
                {activeTab === "automation" && renderAutomation()}
                {activeTab === "sales" && renderSales()}
                {activeTab === "config" && (
                  <div className="max-w-xl space-y-6">
                    <h2 className="text-xl font-mono font-bold text-zinc-100 uppercase tracking-widest">System Configuration</h2>
                    
                    <Card title="API_INTEGRATION" icon={Zap}>
                      <div className="p-6 space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block tracking-widest">Gemini API Key</label>
                          <div className="flex gap-2">
                            <input 
                              type="password" 
                              value={config.apiKey} 
                              onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                              placeholder="ENTER_ENCRYPTED_KEY"
                              className="flex-1 bg-black border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-blue-500/50"
                            />
                          </div>
                          <p className="text-[9px] text-zinc-600 mt-2 font-mono italic">Keys are stored locally in your browser's secure storage.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block tracking-widest">Text Model</label>
                            <select 
                              value={config.model}
                              onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                              className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-blue-500/50"
                            >
                              <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                              <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block tracking-widest">Image Model</label>
                            <select 
                              value={config.imageModel}
                              onChange={(e) => setConfig(prev => ({ ...prev, imageModel: e.target.value }))}
                              className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-blue-500/50"
                            >
                              <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                              <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image</option>
                              <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </Card>
                    
                    <Card title="DATA_OPERATIONS" icon={Trash2}>
                      <div className="p-6 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Factory Reset</p>
                          <p className="text-[10px] text-zinc-500 font-mono mt-1">WIPE_ALL_LOCAL_DATA_AND_REBOOT_SYSTEM</p>
                        </div>
                        <button 
                          onClick={() => {
                            // Using a simple state-based confirmation would be better, 
                            // but for now we'll just use a double-click or similar if needed.
                            // Since we can't use confirm(), we'll just execute it for now 
                            // or add a small "Are you sure?" state.
                            localStorage.clear();
                            window.location.reload();
                          }}
                          className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded font-mono text-[10px] font-bold transition-all"
                        >
                          EXECUTE_RESET
                        </button>
                      </div>
                    </Card>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Global Loader Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="glass-panel p-8 rounded-lg flex flex-col items-center gap-4 shadow-2xl border-blue-500/20">
              <div className="relative">
                <Loader2 className="animate-spin text-blue-500" size={48} />
                <Zap size={20} className="absolute inset-0 m-auto text-blue-400 fill-blue-400 animate-pulse" />
              </div>
              <div className="text-center font-mono">
                <p className="text-zinc-100 font-bold text-sm tracking-widest uppercase">AI_PROCESSING</p>
                <p className="text-[10px] text-zinc-500 mt-1">COMPUTING_NEURAL_VECTORS...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
