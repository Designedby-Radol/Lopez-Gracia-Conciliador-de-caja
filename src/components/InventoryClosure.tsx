import React, { useState, useEffect } from "react";
import { 
  Package, 
  Plus, 
  Trash2, 
  Calculator, 
  Save, 
  History, 
  CheckCircle2, 
  Search, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Sparkles,
  AlertCircle
} from "lucide-react";
import { todayBogota } from "../lib/dates";
import { operacionAdapter } from "../db/operacionAdapter";

export interface InsumoMaster {
  id: string;
  nombre: string;
  unidad: string; // "g", "kg", "ml", "L", "uds", "cajas", "paquetes"
  categoria: string;
}

export interface InsumoCountItem {
  insumoId: string;
  nombre: string;
  unidad: string;
  selected: boolean;
  entries: number[]; // e.g. [340, 250, 300]
  rawExpression: string; // e.g. "340+250+300"
  total: number; // 890
  notas?: string;
}

export interface InventoryClosureRecord {
  id: string;
  fecha: string; // YYYY-MM-DD
  createdAt: string;
  usuarioNombre: string;
  usuarioRole: string;
  local: string;
  observacionesGenerales: string;
  totalItemsCounted: number;
  items: InsumoCountItem[];
}

const DEFAULT_INSUMOS: InsumoMaster[] = [
  { id: "ins-1", nombre: "Harina de Trigo", unidad: "g", categoria: "Materia Prima" },
  { id: "ins-2", nombre: "Mantequilla Sin Sal", unidad: "g", categoria: "Materia Prima" },
  { id: "ins-3", nombre: "Azúcar Blanco", unidad: "g", categoria: "Materia Prima" },
  { id: "ins-4", nombre: "Leche Entera", unidad: "L", categoria: "Lácteos" },
  { id: "ins-5", nombre: "Café en Grano Especial", unidad: "g", categoria: "Barismo" },
  { id: "ins-6", nombre: "Huevos A/AA", unidad: "uds", categoria: "Materia Prima" },
  { id: "ins-7", nombre: "Chocolate 70%", unidad: "g", categoria: "Materia Prima" },
  { id: "ins-8", nombre: "Crema de Leche", unidad: "L", categoria: "Lácteos" },
  { id: "ins-9", nombre: "Cajas Torta Individual", unidad: "uds", categoria: "Empaques" },
  { id: "ins-10", nombre: "Servilletas de Servicio", unidad: "paquetes", categoria: "Insumos Varios" },
];

const LOCAL_STORAGE_CATALOG_KEY = "lopez_gracia_inventory_master";

interface InventoryClosureProps {
  username: string;
  userRole: string;
  localName?: string;
  isManagerView?: boolean;
}

export default function InventoryClosure({
  username,
  userRole,
  localName = "Chapinero",
  isManagerView = false,
}: InventoryClosureProps) {
  // Master catalog state
  const [catalog, setCatalog] = useState<InsumoMaster[]>([]);
  const [records, setRecords] = useState<InventoryClosureRecord[]>([]);

  // Navigation tab inside Inventory module
  const [activeTab, setActiveTab] = useState<"new" | "history" | "catalog">("new");

  // Form state for active count
  const [fecha, setFecha] = useState<string>(() => todayBogota());
  const [itemsState, setItemsState] = useState<InsumoCountItem[]>([]);
  const [observaciones, setObservaciones] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // New Insumo Modal / Form State
  const [newInsumoNombre, setNewInsumoNombre] = useState("");
  const [newInsumoUnidad, setNewInsumoUnidad] = useState("g");
  const [newInsumoCategoria, setNewInsumoCategoria] = useState("Materia Prima");

  // History search filter
  const [historySearch, setHistorySearch] = useState("");
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Load master catalog and records on mount
  useEffect(() => {
    loadMasterCatalog();
    loadHistoryRecords();
  }, []);

  const [loadError, setLoadError] = useState("");

  const loadMasterCatalog = async () => {
    try {
      const remote = await operacionAdapter.getCatalogoInventario<InsumoMaster>();
      if (remote && remote.length > 0) {
        setCatalog(remote);
        return;
      }
      // Primera vez: usar el catálogo que tenía este navegador (o el por defecto) como semilla.
      let seed = DEFAULT_INSUMOS;
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_CATALOG_KEY);
        if (saved) seed = JSON.parse(saved);
      } catch { /* sin catálogo local */ }
      setCatalog(seed);
      await operacionAdapter.saveCatalogoInventario(seed).catch(() => undefined);
    } catch (e: any) {
      console.error("Error cargando catálogo de insumos:", e);
      setCatalog(DEFAULT_INSUMOS);
      setLoadError(`No se pudo cargar el catálogo del servidor: ${e?.message || "error"}`);
    }
  };

  const loadHistoryRecords = async () => {
    try {
      setRecords(await operacionAdapter.getRegistros<InventoryClosureRecord>("inventario", localName));
    } catch (e: any) {
      console.error("Error cargando inventarios:", e);
      setLoadError(`No se pudo cargar el historial de inventarios: ${e?.message || "error"}`);
    }
  };

  const persistCatalog = async (updated: InsumoMaster[], previous: InsumoMaster[]) => {
    setCatalog(updated);
    try {
      await operacionAdapter.saveCatalogoInventario(updated);
    } catch (e: any) {
      setCatalog(previous);
      alert(`No se pudo guardar el catálogo: ${e?.message || "error"}`);
      return false;
    }
    return true;
  };

  // Sync count state when catalog changes or on initial setup
  useEffect(() => {
    if (catalog.length > 0) {
      setItemsState(prev => {
        return catalog.map(catItem => {
          const existing = prev.find(p => p.insumoId === catItem.id);
          if (existing) {
            return {
              ...existing,
              nombre: catItem.nombre,
              unidad: catItem.unidad,
            };
          }
          return {
            insumoId: catItem.id,
            nombre: catItem.nombre,
            unidad: catItem.unidad,
            selected: true,
            entries: [],
            rawExpression: "",
            total: 0,
            notas: ""
          };
        });
      });
    }
  }, [catalog]);

  // Helper to safely parse and calculate expressions like "340 + 250 + 300"
  const calculateExpression = (raw: string): number => {
    if (!raw.trim()) return 0;
    // Remueve caracteres no numéricos excepto operadores + y . y ,
    const cleaned = raw.replace(/,/g, ".").replace(/[^0-9+.]/g, "");
    if (!cleaned) return 0;

    const parts = cleaned.split("+");
    let sum = 0;
    for (const part of parts) {
      const num = parseFloat(part.trim());
      if (!isNaN(num)) {
        sum += num;
      }
    }
    return Math.round(sum * 100) / 100;
  };

  // Handle expression change
  const handleExpressionChange = (insumoId: string, value: string) => {
    const total = calculateExpression(value);
    setItemsState(prev => prev.map(item => {
      if (item.insumoId === insumoId) {
        return {
          ...item,
          rawExpression: value,
          total: total
        };
      }
      return item;
    }));
  };

  // Toggle item selected state
  const handleToggleSelect = (insumoId: string) => {
    setItemsState(prev => prev.map(item => {
      if (item.insumoId === insumoId) {
        return { ...item, selected: !item.selected };
      }
      return item;
    }));
  };

  // Add individual entry value (e.g. user clicks + Añadir pesado)
  const handleAddEntryValue = (insumoId: string, val: number) => {
    if (isNaN(val) || val <= 0) return;
    setItemsState(prev => prev.map(item => {
      if (item.insumoId === insumoId) {
        const newRaw = item.rawExpression ? `${item.rawExpression} + ${val}` : `${val}`;
        const total = calculateExpression(newRaw);
        return {
          ...item,
          rawExpression: newRaw,
          total: total
        };
      }
      return item;
    }));
  };

  // Add new item to Master Catalog
  const handleCreateInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInsumoNombre.trim()) return;

    const newItem: InsumoMaster = {
      id: `ins-${Date.now()}`,
      nombre: newInsumoNombre.trim(),
      unidad: newInsumoUnidad,
      categoria: newInsumoCategoria
    };

    if (!(await persistCatalog([...catalog, newItem], catalog))) return;

    setNewInsumoNombre("");
    setNewInsumoUnidad("g");
    setNewInsumoCategoria("Materia Prima");
    alert(`Insumo "${newItem.nombre}" creado exitosamente.`);
  };

  // Remove insumo from master catalog
  const handleDeleteInsumoFromCatalog = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el insumo "${nombre}" del catálogo maestro?`)) return;
    await persistCatalog(catalog.filter(c => c.id !== id), catalog);
  };

  // Save Inventory Closure
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmitClosure = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedItems = itemsState.filter(i => i.selected && i.total > 0);
    if (selectedItems.length === 0) {
      if (!confirm("No has ingresado cantidades mayores a 0 para los insumos. ¿Deseas guardar de todos modos?")) {
        return;
      }
    }

    const newRecord: InventoryClosureRecord = {
      id: `inv-${Date.now()}`,
      fecha,
      createdAt: new Date().toISOString(),
      usuarioNombre: username,
      usuarioRole: userRole,
      local: localName,
      observacionesGenerales: observaciones.trim(),
      totalItemsCounted: selectedItems.length,
      items: itemsState.filter(i => i.selected).map(i => ({
        insumoId: i.insumoId,
        nombre: i.nombre,
        unidad: i.unidad,
        selected: i.selected,
        entries: i.entries,
        rawExpression: i.rawExpression,
        total: i.total,
        notas: i.notas
      }))
    };

    if (isSaving) return;
    setIsSaving(true);
    try {
      const saved = await operacionAdapter.saveRegistro("inventario", newRecord, localName);
      setRecords(prev => [saved, ...prev]);
    } catch (err: any) {
      alert(`No se pudo guardar el inventario: ${err?.message || "error"}. Tus conteos siguen en pantalla; intenta de nuevo.`);
      return;
    } finally {
      setIsSaving(false);
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);

    // Reset current count
    setObservaciones("");
    setItemsState(prev => prev.map(item => ({
      ...item,
      rawExpression: "",
      total: 0,
      notas: ""
    })));
  };

  // Filtered categories
  const categories = ["todos", ...Array.from(new Set(catalog.map(c => c.categoria)))];

  const filteredItemsToCount = itemsState.filter(item => {
    const catMatch = catalog.find(c => c.id === item.insumoId);
    if (filterCategory !== "todos" && catMatch?.categoria !== filterCategory) {
      return false;
    }
    if (searchTerm.trim() && !item.nombre.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {loadError && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm font-bold p-3 rounded-xl">{loadError}</div>
      )}
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#1E3E30] flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Cierre de Inventario de Insumos
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Módulo para registrar pesajes y conteos acumulados de insumos por turno.
          </p>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === "new" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Nuevo Conteo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === "history" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial ({records.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === "catalog" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Catálogo Insumos</span>
          </button>
        </div>
      </div>

      {/* SUCCESS BANNER */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 shadow-xs flex items-center space-x-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <h4 className="font-bold text-xs">¡Cierre de Inventario Guardado Con Éxito!</h4>
            <p className="text-xs text-emerald-700 font-medium">
              El registro ha sido almacenado e integrado para la auditoría de gerencia.
            </p>
          </div>
        </div>
      )}

      {/* TAB 1: NUEVO CONTEO */}
      {activeTab === "new" && (
        <form onSubmit={handleSubmitClosure} className="space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Fecha del Cierre de Inventario
                </label>
                <input
                  type="date"
                  required
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl px-3 py-2 text-xs font-bold font-numeric text-slate-900 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Responsables
                </label>
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-800">
                  {username} <span className="text-[11px] font-semibold text-slate-400">({userRole})</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Punto de Venta
                </label>
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-800">
                  {localName}
                </div>
              </div>
            </div>

            {/* Filter controls */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar insumo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#1E3E30]/15 w-44"
                />
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500">Categoría:</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 outline-none cursor-pointer"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === "todos" ? "Todas las Categorías" : cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* List of Insumos for Additive Counting */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <Calculator className="w-4 h-4 text-slate-500" />
                <span>Ingreso de Pesajes y Suma Acumulada</span>
              </h3>
              <span className="text-xs font-medium text-slate-500">
                Puedes escribir sumas como: <code className="bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded font-numeric font-bold">340+250+300</code>
              </span>
            </div>

            <div className="space-y-2.5">
              {filteredItemsToCount.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 font-medium">
                  No hay insumos que coincidan con la búsqueda. Puedes agregar insumos en la pestaña "Catálogo Insumos".
                </div>
              ) : (
                filteredItemsToCount.map((item) => {
                  const masterInfo = catalog.find(c => c.id === item.insumoId);
                  return (
                    <div
                      key={item.insumoId}
                      className={`border rounded-xl p-3.5 transition-all ${
                        item.selected
                          ? "border-slate-200/80 bg-white hover:border-slate-300"
                          : "border-slate-200 bg-slate-100/60 opacity-60"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Checkbox and Insumo Name */}
                        <div className="flex items-center space-x-3 shrink-0">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleSelect(item.insumoId)}
                            className="w-4 h-4 text-[#1E3E30] rounded focus:ring-0 accent-[#1E3E30] cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-sm text-slate-900 block">
                              {item.nombre}
                            </span>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                                {masterInfo?.categoria || "General"}
                              </span>
                              <span className="text-xs text-slate-400 font-numeric font-medium">
                                Unidad: {item.unidad}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Expression Input & Calculated Total */}
                        {item.selected && (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 md:justify-end">
                            {/* Expression Field */}
                            <div className="relative flex-1 max-w-md">
                              <input
                                type="text"
                                placeholder={`Ej: 340 + 250 + 300 (${item.unidad})`}
                                value={item.rawExpression}
                                onChange={(e) => handleExpressionChange(item.insumoId, e.target.value)}
                                className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl px-3 py-2 text-xs font-bold font-numeric text-slate-900 outline-none placeholder:text-slate-400 transition-all"
                              />
                            </div>

                            {/* Quick add buttons */}
                            <div className="flex items-center space-x-1 shrink-0">
                              {[100, 250, 500, 1000].map(val => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => handleAddEntryValue(item.insumoId, val)}
                                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-bold font-numeric text-slate-700 transition-colors cursor-pointer"
                                  title={`Añadir +${val} ${item.unidad}`}
                                >
                                  +{val}
                                </button>
                              ))}
                            </div>

                            {/* Total Display */}
                            <div className="bg-slate-900 text-white px-3.5 py-2 rounded-xl text-right shrink-0 min-w-[120px]">
                              <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase block">
                                Total Calculado
                              </span>
                              <span className="text-sm font-extrabold font-numeric">
                                {item.total.toLocaleString("es-CO")} {item.unidad}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Observaciones generales */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              Observaciones o Novedades de Inventario
            </label>
            <textarea
              rows={2}
              placeholder="Escribe detalles sobre productos mermados, empaques rotos, o novedades del conteo..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none transition-all"
            />
          </div>

          {/* Submit Action */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-3 bg-[#1E3E30] text-white hover:bg-[#163025] font-bold text-xs rounded-xl flex items-center space-x-2 shadow-xs transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Cierre de Inventario</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: HISTORIAL */}
      {activeTab === "history" && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <History className="w-4 h-4 text-slate-500" />
              <span>Historial de Cierres de Inventario ({records.length})</span>
            </h3>

            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por fecha o usuario..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#1E3E30]/15"
              />
            </div>
          </div>

          {records.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-medium">
              No se han registrado cierres de inventario en el historial aún.
            </div>
          ) : (
            <div className="space-y-3">
              {records
                .filter(rec => 
                  rec.fecha.includes(historySearch) || 
                  rec.usuarioNombre.toLowerCase().includes(historySearch.toLowerCase()) ||
                  rec.local.toLowerCase().includes(historySearch.toLowerCase())
                )
                .map((record) => {
                  const isExpanded = expandedRecordId === record.id;
                  return (
                    <div 
                      key={record.id}
                      className="border border-slate-200/80 rounded-xl bg-white shadow-xs overflow-hidden"
                    >
                      <div 
                        onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                        className="p-4 bg-slate-50/50 flex flex-col sm:flex-row justify-between sm:items-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-xs text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-numeric">
                            {record.fecha}
                          </span>
                          <div>
                            <span className="font-bold text-xs text-slate-900 block">
                              {record.usuarioNombre} <span className="text-[11px] font-normal text-slate-500">({record.usuarioRole})</span>
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Local: {record.local} • {record.totalItemsCounted} Insumos Registrados
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-numeric text-slate-400">
                            {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button className="p-1 rounded-lg hover:bg-slate-200 text-slate-500">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="p-4 border-t border-slate-100 bg-white space-y-4">
                          {record.observacionesGenerales && (
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium">
                              <strong>Novedades:</strong> {record.observacionesGenerales}
                            </div>
                          )}

                          <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500">
                                  <th className="p-3">Insumo</th>
                                  <th className="p-3">Expresión de Suma</th>
                                  <th className="p-3 text-right">Total Contado</th>
                                </tr>
                              </thead>
                              <tbody>
                                {record.items.map((item, i) => (
                                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/60">
                                    <td className="p-3 font-bold text-slate-900">{item.nombre}</td>
                                    <td className="p-3 font-numeric text-slate-600">{item.rawExpression || `${item.total}`}</td>
                                    <td className="p-3 text-right font-numeric font-bold text-slate-900">
                                      {item.total.toLocaleString("es-CO")} {item.unidad}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CATÁLOGO DE INSUMOS */}
      {activeTab === "catalog" && (
        <div className="space-y-6">
          {/* Form para agregar insumo al catálogo */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Agregar Nuevo Insumo al Catálogo Maestro</span>
            </h3>

            <form onSubmit={handleCreateInsumo} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Nombre del Insumo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Harina de Almendras"
                  value={newInsumoNombre}
                  onChange={(e) => setNewInsumoNombre(e.target.value)}
                  className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Unidad de Medida
                </label>
                <select
                  value={newInsumoUnidad}
                  onChange={(e) => setNewInsumoUnidad(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="g">Gramos (g)</option>
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="L">Litros (L)</option>
                  <option value="uds">Unidades (uds)</option>
                  <option value="paquetes">Paquetes</option>
                  <option value="cajas">Cajas</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Categoría
                </label>
                <input
                  type="text"
                  placeholder="Ej. Materia Prima / Lácteos"
                  value={newInsumoCategoria}
                  onChange={(e) => setNewInsumoCategoria(e.target.value)}
                  className="w-full bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 focus:border-[#1E3E30] focus:ring-2 focus:ring-[#1E3E30]/15 rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                className="bg-[#1E3E30] text-white hover:bg-[#163025] font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer shadow-xs transition-all"
              >
                + Crear Insumo
              </button>
            </form>
          </div>

          {/* List catalog */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900">
              Listado del Catálogo Maestro ({catalog.length} Insumos)
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500">
                    <th className="p-3">Insumo</th>
                    <th className="p-3">Unidad</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3 text-center w-16">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map(item => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/60 font-medium">
                      <td className="p-3 font-bold text-slate-900">{item.nombre}</td>
                      <td className="p-3 font-numeric text-slate-600">{item.unidad}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-medium rounded-md">
                          {item.categoria}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteInsumoFromCatalog(item.id, item.nombre)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar del catálogo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
