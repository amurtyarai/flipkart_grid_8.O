import { create } from 'zustand';
import { apiService } from '../services/api';
import type { Product } from '../types/product';
import { INITIAL_PRODUCTS } from '../data/productsData';

export type { Product };

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface LoggedEvent {
  sessionId: string;
  userId: string;
  timestamp: string;
  page: string;
  eventType: string;
  metadata: Record<string, any>;
}

export interface FeatureAttribution {
  feature: string;
  importance: number;
  direction: string;
}

export interface PredictionState {
  abandonmentProbability: number;
  prediction: boolean;
  rootCause: string;
  recommendedIntervention: string;
  multilingualNudge?: string;
  confidence: number;
  topFeatures: FeatureAttribution[];
}

interface StateStore {
  // Authentication & Sessions
  sessionId: string;
  userId: string;
  theme: 'dark' | 'light';
  language: string;
  
  // Product Catalog
  products: Product[];
  currentProduct: Product | null;
  
  // Cart
  cart: CartItem[];
  wishlist: string[]; // Product IDs
  
  // Audited Event logs
  events: LoggedEvent[];
  
  // AI prediction outputs
  prediction: PredictionState | null;
  predictionHistory: Record<number, number>;

  // Dashboard configuration state
  dashboardState: {
    activeTab: string;
    isAnalyzing: boolean;
  };
  
  // Toast notifications
  toast: { message: string; type: 'success' | 'info' | 'warning' } | null;
  
  // Actions
  toggleTheme: () => void;
  setLanguage: (lang: string) => void;
  setSessionId: (id: string) => void;
  setUserId: (id: string) => void;
  setProducts: (products: Product[]) => void;
  setCurrentProduct: (product: Product | null) => void;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  changeQuantity: (productId: string, quantity: number) => void;
  toggleWishlist: (productId: string) => void;
  clearCart: () => void;
  startNewSession: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
  hideToast: () => void;
  logEvent: (page: string, eventType: string, metadata?: Record<string, any>) => void;
  setPrediction: (pred: PredictionState | null) => void;
  setDashboardState: (dashboard: Partial<StateStore['dashboardState']>) => void;
}

const createNewSessionId = () => `FK-${Math.floor(10000 + Math.random() * 90000)}`;

export const useStore = create<StateStore>((set, get) => ({
  sessionId: createNewSessionId(),
  userId: "USR-83921",
  theme: 'dark',
  language: 'English',
  
  products: INITIAL_PRODUCTS,
  currentProduct: null,
  cart: [],
  wishlist: [],
  events: [],
  prediction: null,
  predictionHistory: {},
  toast: null,
  dashboardState: {
    activeTab: 'overview',
    isAnalyzing: false
  },
  
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setLanguage: (language) => set({ language }),
  setSessionId: (id) => set({ sessionId: id }),
  setUserId: (id) => set({ userId: id }),
  setProducts: (products) => set({ products }),
  setCurrentProduct: (product) => set({ currentProduct: product }),
  
  addToCart: (product) => set((state) => {
    const existing = state.cart.find(item => item.product.id === product.id);
    let newCart;
    if (existing) {
      newCart = state.cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      newCart = [...state.cart, { product, quantity: 1 }];
    }
    return { cart: newCart };
  }),
  
  removeFromCart: (productId) => set((state) => ({
    cart: state.cart.filter(item => item.product.id !== productId)
  })),
  
  changeQuantity: (productId, quantity) => set((state) => ({
    cart: state.cart.map(item => 
      item.product.id === productId 
        ? { ...item, quantity: Math.max(1, quantity) }
        : item
    )
  })),
  
  toggleWishlist: (productId) => set((state) => {
    const active = state.wishlist.includes(productId);
    const newWish = active 
      ? state.wishlist.filter(id => id !== productId)
      : [...state.wishlist, productId];
    return { wishlist: newWish };
  }),
  
  clearCart: () => set({ cart: [], events: [], prediction: null, predictionHistory: {} }),
  startNewSession: () => set({
    sessionId: createNewSessionId(),
    events: [],
    cart: [],
    prediction: null,
    predictionHistory: {}
  }),
  
  logEvent: (page, eventType, metadata = {}) => {
    const state = get();
    const now = Date.now();

    // Deduplication check: prevent identical events logged within 500ms (e.g. StrictMode double effect execution or duplicate triggers)
    const lastEvent = state.events[state.events.length - 1];
    if (lastEvent && lastEvent.page === page && lastEvent.eventType === eventType) {
      const lastTime = new Date(lastEvent.timestamp).getTime();
      if (now - lastTime < 500 && JSON.stringify(lastEvent.metadata) === JSON.stringify(metadata)) {
        return;
      }
    }

    const newEvent: LoggedEvent = {
      sessionId: state.sessionId,
      userId: state.userId,
      timestamp: new Date(now).toISOString(),
      page,
      eventType,
      metadata
    };
    
    const updatedEvents = [...state.events, newEvent];
    set({ events: updatedEvents });

    // Trigger HUD notification for visual feedback
    state.showToast(`AI System Logged: ${eventType}`, 'info');

    // Sync event with backend
    apiService.logEvents([newEvent]).catch((err) => {
      console.warn("Failed to sync event with backend database:", err);
    });
  },
  
  showToast: (message, type = 'info') => set({ toast: { message, type } }),
  hideToast: () => set({ toast: null }),
  setPrediction: (pred) => set((state) => {
    const updatedHistory = { ...state.predictionHistory };
    if (pred && state.events.length > 0) {
      updatedHistory[state.events.length] = pred.abandonmentProbability;
    }
    return {
      prediction: pred,
      predictionHistory: updatedHistory
    };
  }),
  setDashboardState: (dashboard) => set((state) => ({
    dashboardState: { ...state.dashboardState, ...dashboard }
  }))
}));
