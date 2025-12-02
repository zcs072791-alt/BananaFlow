import { AppNode, AppEdge } from '../types';

const DB_NAME = 'BananaFlowDB';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;
const MAX_SNAPSHOTS = 3;

export interface WorkflowSnapshot {
  id: string; // Timestamp as ID
  timestamp: number;
  dateStr: string;
  flow: {
    nodes: AppNode[];
    edges: AppEdge[];
  };
}

// Open Database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// Helper to remove functions from node data for storage
const sanitizeNodes = (nodes: AppNode[]): AppNode[] => {
  return nodes.map(node => {
    const cleanData: any = {};
    // Iterate over data properties and keep only serializable ones (non-functions)
    Object.keys(node.data).forEach(key => {
      const value = (node.data as any)[key];
      if (typeof value !== 'function') {
        cleanData[key] = value;
      }
    });

    return {
      ...node,
      data: cleanData
    };
  });
};

// Save a snapshot (Rolling logic)
export const saveAutoSnapshot = async (nodes: AppNode[], edges: AppEdge[]): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const cleanNodes = sanitizeNodes(nodes);

    const keysRequest = store.getAllKeys();
    
    keysRequest.onsuccess = async () => {
      const keys = keysRequest.result as string[];
      
      const now = Date.now();
      const snapshot: WorkflowSnapshot = {
        id: now.toString(),
        timestamp: now,
        dateStr: new Date(now).toLocaleString(),
        flow: { nodes: cleanNodes, edges }
      };

      store.add(snapshot);

      if (keys.length >= MAX_SNAPSHOTS) {
        keys.sort(); 
        const deleteCount = (keys.length + 1) - MAX_SNAPSHOTS;
        for (let i = 0; i < deleteCount; i++) {
           store.delete(keys[i]);
        }
      }
    };
  } catch (error) {
    console.error("Failed to save snapshot to IndexedDB:", error);
  }
};

// Get all snapshots (sorted new to old)
export const getSnapshots = async (): Promise<WorkflowSnapshot[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as WorkflowSnapshot[];
        if (results && results.length > 0) {
            results.sort((a, b) => b.timestamp - a.timestamp);
        }
        resolve(results || []);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to load snapshots:", error);
    return [];
  }
};

// Clear all snapshots
export const clearSnapshots = async (): Promise<void> => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
    } catch (error) {
        console.error("Failed to clear snapshots:", error);
    }
};

// --- FILE OPERATIONS ---

export const saveWorkflowToFile = (nodes: AppNode[], edges: AppEdge[]) => {
    const cleanNodes = sanitizeNodes(nodes);
    const flow = { nodes: cleanNodes, edges };
    
    const jsonString = JSON.stringify(flow, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `bananaflow-workflow-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const parseWorkflowFile = (file: File): Promise<{ nodes: AppNode[], edges: AppEdge[] }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (Array.isArray(json.nodes) && Array.isArray(json.edges)) {
                    resolve(json);
                } else {
                    reject(new Error("Invalid workflow file format: Missing nodes or edges array"));
                }
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
};