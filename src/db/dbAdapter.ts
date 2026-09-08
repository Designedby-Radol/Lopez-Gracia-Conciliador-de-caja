import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  doc, 
  deleteDoc, 
  query, 
  orderBy,
  getDoc
} from "firebase/firestore";
import { db, isFirebaseAvailable } from "./firebaseConfig";
import { CierreCaja } from "../types";

// Enumeraciones y funciones de manejo de errores solicitadas por las guías de integración de Firebase
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
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: "local-user-or-auth", // Simplificado para adaptabilidad de roles
      email: "user@lopezygracia.com"
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Datos semilla para el modo de demostración local (LocalStorage)
const SEED_CIERRES: CierreCaja[] = [
  {
    id: "cierre-seed-1",
    fecha: "2026-07-15",
    efectivoCierre: 1250000,
    datafonoCierre: 3400000,
    justoCierre: 450000,
    rappiCierre: 850000,
    transferenciasCierre: 350000,
    propinas: 280000,
    novedades: "Turno tranquilo. Excelente flujo de clientes en la tarde. Propinas repartidas en efectivo.",
    estado: "Cuadrado",
    createdAt: "2026-07-15T21:30:00.000Z",
    efectivoPOS: 1250000,
    tarjetasPOS: 3400000,
    justoPOS: 450000,
    rappiPOS: 850000,
    transferenciasPOS: 350000,
    difEfectivo: 0,
    difTarjetas: 0,
    difJusto: 0,
    difRappi: 0,
    difTransferencias: 0,
    auditadoPor: "Gerente Chapinero",
    auditadoAt: "2026-07-15T22:15:00.000Z"
  },
  {
    id: "cierre-seed-2",
    fecha: "2026-07-16",
    efectivoCierre: 980000,
    datafonoCierre: 2150000,
    justoCierre: 320000,
    rappiCierre: 540000,
    transferenciasCierre: 180000,
    propinas: 195000,
    novedades: "Fallas leves en el datáfono durante el mediodía, se reportó a soporte. Cliente dejó propina alta por servicio.",
    estado: "Pendiente por Cuadrar",
    createdAt: "2026-07-16T21:45:00.000Z"
  },
  {
    id: "cierre-seed-3",
    fecha: "2026-07-14",
    efectivoCierre: 1100000,
    datafonoCierre: 2950000,
    justoCierre: 400000,
    rappiCierre: 720000,
    transferenciasCierre: 220000,
    propinas: 240000,
    novedades: "Sin novedades especiales. Todo fluyó perfectamente.",
    estado: "Cuadrado",
    createdAt: "2026-07-14T21:10:00.000Z",
    efectivoPOS: 1080000, // Sobraron 20,000 en caja física
    tarjetasPOS: 2950000,
    justoPOS: 400000,
    rappiPOS: 730000, // Faltaron 10,000 en Rappi
    transferenciasPOS: 220000,
    difEfectivo: 20000,
    difTarjetas: 0,
    difJusto: 0,
    difRappi: -10000,
    difTransferencias: 0,
    auditadoPor: "Gerente Chapinero",
    auditadoAt: "2026-07-14T22:00:00.000Z"
  }
];

// Inicializar localStorage si está vacío
function initializeLocalDB() {
  if (!localStorage.getItem("lopez_gracia_cierres")) {
    localStorage.setItem("lopez_gracia_cierres", JSON.stringify(SEED_CIERRES));
  }
}

export const dbAdapter = {
  async getCierres(): Promise<CierreCaja[]> {
    if (isFirebaseAvailable && db) {
      const path = "cierres_caja";
      try {
        const q = query(collection(db, path), orderBy("fecha", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CierreCaja[];
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
        return []; // Nunca llegará aquí por el throw, pero silencia TS
      }
    } else {
      initializeLocalDB();
      const localData = localStorage.getItem("lopez_gracia_cierres");
      const list: CierreCaja[] = localData ? JSON.parse(localData) : [];
      // Ordenar por fecha desc, luego por createdAt desc
      return list.sort((a, b) => b.fecha.localeCompare(a.fecha));
    }
  },

  async saveCierre(cierre: Omit<CierreCaja, "id" | "createdAt">): Promise<CierreCaja> {
    const nuevoCierre: Omit<CierreCaja, "id"> = {
      ...cierre,
      createdAt: new Date().toISOString()
    };

    if (isFirebaseAvailable && db) {
      const path = "cierres_caja";
      try {
        const docRef = await addDoc(collection(db, path), nuevoCierre);
        return {
          id: docRef.id,
          ...nuevoCierre
        } as CierreCaja;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
        throw error;
      }
    } else {
      initializeLocalDB();
      const localData = localStorage.getItem("lopez_gracia_cierres");
      const list: CierreCaja[] = localData ? JSON.parse(localData) : [];
      
      const completeCierre: CierreCaja = {
        id: "local-" + Math.random().toString(36).substring(2, 9),
        ...nuevoCierre
      };

      list.push(completeCierre);
      localStorage.setItem("lopez_gracia_cierres", JSON.stringify(list));
      return completeCierre;
    }
  },

  async updateCierre(id: string, updates: Partial<CierreCaja>): Promise<void> {
    if (isFirebaseAvailable && db) {
      const path = `cierres_caja/${id}`;
      try {
        const docRef = doc(db, "cierres_caja", id);
        await updateDoc(docRef, updates as any);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } else {
      initializeLocalDB();
      const localData = localStorage.getItem("lopez_gracia_cierres");
      let list: CierreCaja[] = localData ? JSON.parse(localData) : [];
      
      list = list.map(item => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      });

      localStorage.setItem("lopez_gracia_cierres", JSON.stringify(list));
    }
  },

  async deleteCierre(id: string): Promise<void> {
    if (isFirebaseAvailable && db) {
      const path = `cierres_caja/${id}`;
      try {
        const docRef = doc(db, "cierres_caja", id);
        await deleteDoc(docRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    } else {
      initializeLocalDB();
      const localData = localStorage.getItem("lopez_gracia_cierres");
      let list: CierreCaja[] = localData ? JSON.parse(localData) : [];
      
      list = list.filter(item => item.id !== id);
      localStorage.setItem("lopez_gracia_cierres", JSON.stringify(list));
    }
  }
};
