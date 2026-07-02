/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, ComboConfig, InventoryTrays } from './types';
import { DEFAULT_PRODUCTS, DEFAULT_COMBO_CONFIG } from './defaultProducts';
import PriceList from './components/PriceList';
import QuickCalculator from './components/QuickCalculator';
import ComboOptimizer from './components/ComboOptimizer';
import { Scale, Layers, Edit3, Beef, Clock, CheckCircle2, Coins, TrendingUp, RefreshCw, AlertCircle, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { safeStorage } from './utils';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

export default function App() {
  // Load products, combo config, and inventory from LocalStorage or defaults
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = safeStorage.getItem('carniceria_products');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Product[];
        // If it contains the old default products or old mock ids, migrate them
        if (parsed.some(p => p.id === 'p1' || p.name.includes('Bistec de Res') || p.name.includes('Lomo de Cerdo'))) {
          safeStorage.removeItem('carniceria_products');
          safeStorage.removeItem('carniceria_combo_config');
          safeStorage.removeItem('carniceria_inventory');
          return DEFAULT_PRODUCTS;
        }
        // Auto-correct categories based on our updated DEFAULT_PRODUCTS
        const corrected = parsed.map(p => {
          const defaultItem = DEFAULT_PRODUCTS.find(d => d.id === p.id);
          if (defaultItem && p.category !== defaultItem.category) {
            return { ...p, category: defaultItem.category };
          }
          return p;
        });
        return corrected;
      } catch (e) {
        return DEFAULT_PRODUCTS;
      }
    }
    return DEFAULT_PRODUCTS;
  });

  const [comboConfig, setComboConfig] = useState<ComboConfig>(() => {
    const saved = safeStorage.getItem('carniceria_combo_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ComboConfig;
        if (parsed && Array.isArray(parsed.items) && parsed.items.some(item => item && (item.productId === 'p1' || item.productId === 'p3'))) {
          return DEFAULT_COMBO_CONFIG;
        }
        if (!parsed || !Array.isArray(parsed.items)) {
          return DEFAULT_COMBO_CONFIG;
        }
        return parsed;
      } catch (e) {
        return DEFAULT_COMBO_CONFIG;
      }
    }
    return DEFAULT_COMBO_CONFIG;
  });

  const [inventory, setInventory] = useState<InventoryTrays>(() => {
    const saved = safeStorage.getItem('carniceria_inventory');
    return saved ? JSON.parse(saved) : {};
  });

  // Exchange rate states (Tasa de cambio del Bolívar VES)
  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    const saved = safeStorage.getItem('carniceria_exchange_rate');
    return saved ? parseFloat(saved) : 45.50;
  });

  const [rateSource, setRateSource] = useState<string>(() => {
    const saved = safeStorage.getItem('carniceria_rate_source');
    return saved || 'Predeterminada (Fija)';
  });

  const [rateMode, setRateMode] = useState<'auto' | 'manual'>(() => {
    const saved = safeStorage.getItem('carniceria_rate_mode');
    return (saved as 'auto' | 'manual') || 'auto';
  });

  const [globalCurrency, setGlobalCurrency] = useState<'USD' | 'VES'>(() => {
    const saved = safeStorage.getItem('carniceria_global_currency');
    return (saved as 'USD' | 'VES') || 'USD';
  });

  const handleGlobalCurrencyChange = (currency: 'USD' | 'VES') => {
    setGlobalCurrency(currency);
    safeStorage.setItem('carniceria_global_currency', currency);
  };

  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [tempRateInput, setTempRateInput] = useState<string>(exchangeRate.toString());

  // Connection and synchronization state with Firestore
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'error' | 'offline'>(() => db ? 'connecting' : 'offline');
  const [dbError, setDbError] = useState<string | null>(null);

  // Navigation tab state: 'prices' | 'calculator' | 'combos'
  const [activeTab, setActiveTab] = useState<'prices' | 'calculator' | 'combos'>('prices');
  
  // Selected product in quick calculator
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Current date & time for counter checkouts
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to save exchange rate to Firestore
  const saveExchangeRateToFirestore = (rate: number, source: string, mode: 'auto' | 'manual') => {
    if (db) {
      const rateRef = doc(db, 'settings', 'exchange_rate');
      setDoc(rateRef, {
        rate,
        source,
        mode,
        updatedAt: new Date().toISOString()
      })
      .then(() => {
        setDbStatus('connected');
        setDbError(null);
      })
      .catch(err => {
        console.error("Error updating exchange rate in Firestore:", err);
        setDbStatus('error');
        setDbError(`Error al subir tasa: ${err?.message || err}`);
      });
    }
  };

  // Fetch exchange rate from Venezuela dolar API on mount
  const fetchExchangeRate = async () => {
    setIsFetchingRate(true);
    
    // We try several API endpoints of pyDolar and DolarApi in order of priority to ensure connection
    const endpoints = [
      'https://ve.dolarapi.com/v1/dolares/oficial',
      'https://pydolarvenezuela-api.vercel.app/api/v1/dollar',
      'https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv',
      'https://pydolarvenezuela-api.vercel.app/api/v1/dollar/page?name=bcv'
    ];

    let success = false;
    let lastErrorMessage = '';

    for (const url of endpoints) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) {
          throw new Error(`Código HTTP: ${response.status}`);
        }
        const data = await response.json();
        
        let rate = 0;
        let sourceName = 'BCV Oficial';

        if (url.includes('dolarapi.com')) {
          if (data && typeof data.venta === 'number') {
            rate = data.venta;
            sourceName = 'BCV Oficial (DolarApi)';
          } else if (data && typeof data.promedio === 'number') {
            rate = data.promedio;
            sourceName = 'BCV Oficial (DolarApi)';
          }
        } else if (data?.monitors?.bcv?.price) {
          rate = Number(data.monitors.bcv.price);
          sourceName = 'BCV Oficial (pyDolar)';
        } else if (data?.monitors?.enparalelovzla?.price) {
          rate = Number(data.monitors.enparalelovzla.price);
          sourceName = 'EnParaleloVzla (pyDolar)';
        } else if (data?.bcv?.price) {
          rate = Number(data.bcv.price);
          sourceName = 'BCV Oficial (Directo)';
        } else if (data?.price) {
          rate = Number(data.price);
          sourceName = 'Tasa BCV (pyDolar)';
        }

        if (rate > 0) {
          const finalSource = sourceName + ' - Automática (Internet)';
          setExchangeRate(rate);
          setTempRateInput(rate.toString());
          setRateSource(finalSource);
          safeStorage.setItem('carniceria_exchange_rate', rate.toString());
          safeStorage.setItem('carniceria_rate_source', finalSource);
          
          // Propagate to Firestore in real-time so other devices synchronize instantly
          saveExchangeRateToFirestore(rate, finalSource, 'auto');
          
          success = true;
          break; // Stop trying other endpoints
        }
      } catch (error: any) {
        console.warn(`Error fetching from ${url}:`, error);
        lastErrorMessage = error?.message || 'Error de red';
      }
    }

    if (!success) {
      console.warn(`No se pudo actualizar la tasa automáticamente por Internet (${lastErrorMessage}). Usando última registrada o manual.`);
    }
    setIsFetchingRate(false);
  };

  useEffect(() => {
    if (rateMode === 'auto') {
      fetchExchangeRate();
    }
  }, []);

  // Sync to LocalStorage
  useEffect(() => {
    safeStorage.setItem('carniceria_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    safeStorage.setItem('carniceria_combo_config', JSON.stringify(comboConfig));
  }, [comboConfig]);

  useEffect(() => {
    safeStorage.setItem('carniceria_inventory', JSON.stringify(inventory));
  }, [inventory]);

  // Synchronized Firestore Update Handlers (only triggered by local user actions)
  const updateProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    if (db) {
      const productsRef = doc(db, 'settings', 'products');
      setDoc(productsRef, { list: newProducts })
        .then(() => {
          setDbStatus('connected');
          setDbError(null);
        })
        .catch(err => {
          console.error("Error updating products in Firestore:", err);
          setDbStatus('error');
          setDbError(`Error al subir productos: ${err?.message || err}`);
        });
    }
  };

  const updateInventory = (newInventory: InventoryTrays) => {
    setInventory(newInventory);
    if (db) {
      const inventoryRef = doc(db, 'settings', 'inventory');
      setDoc(inventoryRef, { values: newInventory })
        .then(() => {
          setDbStatus('connected');
          setDbError(null);
        })
        .catch(err => {
          console.error("Error updating inventory in Firestore:", err);
          setDbStatus('error');
          setDbError(`Error al subir inventario: ${err?.message || err}`);
        });
    }
  };

  const handleManualSync = async () => {
    if (!db) {
      setSyncStatus({
        type: 'error',
        message: 'La base de datos en la nube no está disponible o configurada.'
      });
      setTimeout(() => setSyncStatus(null), 4000);
      return;
    }

    setIsSyncing(true);
    setSyncStatus(null);
    setDbStatus('connecting');

    try {
      // 1. Refresh exchange rate if in auto mode
      if (rateMode === 'auto') {
        try {
          await fetchExchangeRate();
        } catch (err) {
          console.warn("Fallo al actualizar tasa durante sincronización:", err);
        }
      }

      // 2. Fetch products manually from Firestore to bypass snapshot delays
      const productsRef = doc(db, 'settings', 'products');
      const productsSnap = await getDoc(productsRef);
      if (productsSnap.exists()) {
        const data = productsSnap.data();
        if (data && Array.isArray(data.list)) {
          const correctedList = data.list.map((p: any) => {
            const defaultItem = DEFAULT_PRODUCTS.find(d => d.id === p.id);
            if (defaultItem && p.category !== defaultItem.category) {
              return { ...p, category: defaultItem.category };
            }
            return p;
          });
          
          const hasChanges = JSON.stringify(data.list) !== JSON.stringify(correctedList);
          if (hasChanges) {
            await setDoc(productsRef, { list: correctedList });
          }

          setProducts(correctedList);
          safeStorage.setItem('carniceria_products', JSON.stringify(correctedList));
        }
      } else {
        await setDoc(productsRef, { list: products });
      }

      // 3. Fetch inventory manually from Firestore
      const inventoryRef = doc(db, 'settings', 'inventory');
      const inventorySnap = await getDoc(inventoryRef);
      if (inventorySnap.exists()) {
        const data = inventorySnap.data();
        if (data && data.values) {
          setInventory(data.values);
          safeStorage.setItem('carniceria_inventory', JSON.stringify(data.values));
        }
      } else {
        await setDoc(inventoryRef, { values: inventory });
      }

      // 4. Fetch exchange rate manually from Firestore
      const rateRef = doc(db, 'settings', 'exchange_rate');
      const rateSnap = await getDoc(rateRef);
      if (rateSnap.exists()) {
        const data = rateSnap.data();
        if (data && typeof data.rate === 'number') {
          setExchangeRate(data.rate);
          setTempRateInput(data.rate.toString());
          setRateSource(data.source || 'Sincronizada');
          setRateMode(data.mode || 'auto');
          safeStorage.setItem('carniceria_exchange_rate', data.rate.toString());
          safeStorage.setItem('carniceria_rate_source', data.source || 'Sincronizada');
          safeStorage.setItem('carniceria_rate_mode', data.mode || 'auto');
        }
      } else {
        await setDoc(rateRef, {
          rate: exchangeRate,
          source: rateSource,
          mode: rateMode,
          updatedAt: new Date().toISOString()
        });
      }

      setDbStatus('connected');
      setDbError(null);
      setSyncStatus({
        type: 'success',
        message: '¡Sincronizado! Precios, inventario y tasa de cambio actualizados con la nube.'
      });
    } catch (error: any) {
      console.error("Error manual syncing:", error);
      setDbStatus('error');
      setDbError(error?.message || 'Error de sincronización manual');
      setSyncStatus({
        type: 'error',
        message: `Error al sincronizar: ${error?.message || 'problema de red'}`
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  // Subscribe to real-time changes in Firestore
  useEffect(() => {
    if (!db) {
      setDbStatus('offline');
      return;
    }

    setDbStatus('connecting');

    const productsRef = doc(db, 'settings', 'products');
    const unsubscribeProducts = onSnapshot(productsRef, (docSnap) => {
      setDbStatus('connected');
      setDbError(null);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.list)) {
          const correctedList = data.list.map((p: any) => {
            const defaultItem = DEFAULT_PRODUCTS.find(d => d.id === p.id);
            if (defaultItem && p.category !== defaultItem.category) {
              return { ...p, category: defaultItem.category };
            }
            return p;
          });

          const hasChanges = JSON.stringify(data.list) !== JSON.stringify(correctedList);
          if (hasChanges) {
            setDoc(productsRef, { list: correctedList }).catch(err => {
              console.error("Error auto-correcting categories in Firestore:", err);
            });
          }

          setProducts(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(correctedList)) {
              return correctedList;
            }
            return prev;
          });
        }
      } else {
        // Seed initial products to Firestore if empty
        setDoc(productsRef, { list: products }).catch(err => {
          console.error("Error seeding products to Firestore:", err);
        });
      }
    }, (error) => {
      console.warn("Firestore products subscription issue:", error);
      setDbStatus('error');
      setDbError(`Fallo de conexión en productos: ${error.message}`);
    });

    const inventoryRef = doc(db, 'settings', 'inventory');
    const unsubscribeInventory = onSnapshot(inventoryRef, (docSnap) => {
      setDbStatus('connected');
      setDbError(null);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.values) {
          setInventory(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(data.values)) {
              return data.values;
            }
            return prev;
          });
        }
      } else {
        // Seed initial inventory to Firestore if empty
        setDoc(inventoryRef, { values: inventory }).catch(err => {
          console.error("Error seeding inventory to Firestore:", err);
        });
      }
    }, (error) => {
      console.warn("Firestore inventory subscription issue:", error);
      setDbStatus('error');
      setDbError(`Fallo de conexión en inventario: ${error.message}`);
    });

    const rateRef = doc(db, 'settings', 'exchange_rate');
    const unsubscribeRate = onSnapshot(rateRef, (docSnap) => {
      setDbStatus('connected');
      setDbError(null);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && typeof data.rate === 'number') {
          setExchangeRate(prev => {
            if (prev !== data.rate) {
              safeStorage.setItem('carniceria_exchange_rate', data.rate.toString());
              return data.rate;
            }
            return prev;
          });
          setTempRateInput(prev => {
            if (parseFloat(prev) !== data.rate) {
              return data.rate.toString();
            }
            return prev;
          });
          if (data.source) {
            setRateSource(prev => {
              if (prev !== data.source) {
                safeStorage.setItem('carniceria_rate_source', data.source);
                return data.source;
              }
              return prev;
            });
          }
          if (data.mode) {
            setRateMode(prev => {
              if (prev !== data.mode) {
                safeStorage.setItem('carniceria_rate_mode', data.mode);
                return data.mode;
              }
              return prev;
            });
          }
        }
      } else {
        // Seed initial rate to Firestore if empty
        setDoc(rateRef, {
          rate: exchangeRate,
          source: rateSource,
          mode: rateMode,
          updatedAt: new Date().toISOString()
        }).catch(err => {
          console.error("Error seeding exchange rate to Firestore:", err);
        });
      }
    }, (error) => {
      console.warn("Firestore rate subscription issue:", error);
      setDbStatus('error');
      setDbError(`Fallo de conexión en tasa de cambio: ${error.message}`);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeInventory();
      unsubscribeRate();
    };
  }, []);

  // Keep selectedProduct in sync with updated prices from products array in real-time
  useEffect(() => {
    if (selectedProduct) {
      const freshProduct = products.find(p => p.id === selectedProduct.id);
      if (freshProduct && (freshProduct.pricePerKg !== selectedProduct.pricePerKg || freshProduct.name !== selectedProduct.name)) {
        setSelectedProduct(freshProduct);
      }
    }
  }, [products, selectedProduct]);

  // Handle manual rate submit
  const handleManualRateSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(tempRateInput);
    if (!isNaN(parsed) && parsed > 0) {
      const finalSource = 'Manual (Ingresada por el carnicero)';
      setExchangeRate(parsed);
      setRateSource(finalSource);
      setRateMode('manual');
      safeStorage.setItem('carniceria_exchange_rate', parsed.toString());
      safeStorage.setItem('carniceria_rate_source', finalSource);
      safeStorage.setItem('carniceria_rate_mode', 'manual');
      setIsEditingRate(false);
      
      // Propagate manual edit to Firestore in real-time
      saveExchangeRateToFirestore(parsed, finalSource, 'manual');
    }
  };

  // Handler when clicking "Pesar / Cotizar" in PriceList
  const handleSelectForCalculation = (product: Product) => {
    setSelectedProduct(product);
    setActiveTab('calculator');
  };

  // Factory reset everything
  const handleResetToDefault = () => {
    setProducts(DEFAULT_PRODUCTS);
    setComboConfig(DEFAULT_COMBO_CONFIG);
    setInventory({});
    setSelectedProduct(null);
    setExchangeRate(45.50);
    setTempRateInput('45.50');
    setRateSource('Predeterminada (Fija)');
    setRateMode('auto');
    safeStorage.setItem('carniceria_exchange_rate', '45.50');
    safeStorage.setItem('carniceria_rate_source', 'Predeterminada (Fija)');
    safeStorage.setItem('carniceria_rate_mode', 'auto');
    setActiveTab('prices');

    if (db) {
      const productsRef = doc(db, 'settings', 'products');
      setDoc(productsRef, { list: DEFAULT_PRODUCTS }).catch(err => {
        console.error("Error resetting products in Firestore:", err);
      });
      const inventoryRef = doc(db, 'settings', 'inventory');
      setDoc(inventoryRef, { values: {} }).catch(err => {
        console.error("Error resetting inventory in Firestore:", err);
      });
      const rateRef = doc(db, 'settings', 'exchange_rate');
      setDoc(rateRef, {
        rate: 45.50,
        source: 'Predeterminada (Fija)',
        mode: 'auto',
        updatedAt: new Date().toISOString()
      }).catch(err => {
        console.error("Error resetting exchange rate in Firestore:", err);
      });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans antialiased pb-16">
      
      {/* 1. Header & Counter Stats Banner */}
      <header className="bg-slate-900 text-white shadow-lg border-b border-slate-800 print:hidden relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-10 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-5 py-6 md:py-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          
          {/* Logo / Title */}
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-red-600 to-red-700 p-3 rounded-2xl shadow-md shadow-red-950/20 border border-red-500/20">
              <Beef className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-none text-white uppercase flex items-center gap-2">
                Carnicería <span className="text-red-500">PRO</span>
              </h1>
              <p className="text-xs md:text-sm text-slate-400 font-medium tracking-wide mt-1.5 uppercase">
                Control de Precios de Mostrador • Inventario • Combos
              </p>
            </div>
          </div>

          {/* Realtime Clock & Status indicator */}
          <div className="flex items-center gap-5 bg-slate-950/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-800 md:self-center">
            <div className="text-right">
              <div className="text-lg md:text-xl font-black font-mono flex items-center gap-2 justify-end text-white">
                <Clock className="w-4.5 h-4.5 text-red-500" />
                {formatTime(currentTime)}
              </div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                {formatDate(currentTime)}
              </div>
            </div>
            <div className="h-10 w-[1px] bg-slate-800"></div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 justify-end">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-extrabold tracking-widest text-slate-300 uppercase">Mostrador Activo</span>
              </div>
              
              {/* Firestore Real-Time Status Indicator */}
              <div className="flex items-center gap-1.5 justify-end">
                {dbStatus === 'connected' && (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-green-400 animate-pulse" />
                    <span className="text-[9px] font-black tracking-wider text-green-400 uppercase" title="Conexión en tiempo real activa. Los cambios se sincronizan al instante en todos tus dispositivos.">Nube Conectada</span>
                  </>
                )}
                {dbStatus === 'connecting' && (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    <span className="text-[9px] font-black tracking-wider text-blue-400 uppercase">Conectando...</span>
                  </>
                )}
                {dbStatus === 'offline' && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                    <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase">Modo Local</span>
                  </>
                )}
                {dbStatus === 'error' && (
                  <div className="flex items-center gap-1 group relative cursor-pointer">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                    <span className="text-[9px] font-black tracking-wider text-amber-400 uppercase underline decoration-dotted" title={dbError || 'Error de conexión'}>Fallo Sinc.</span>
                    <div className="absolute right-0 top-full mt-1 bg-slate-900 text-white text-[10px] font-medium p-2 rounded-lg shadow-xl border border-slate-700 min-w-[200px] z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      {dbError || 'Error de conexión con la nube'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* 1.5. Exchange Rate Banner (Sleek and polished) */}
      <div className="bg-white border-b border-slate-200 py-3.5 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-amber-500/10 text-amber-800 border border-amber-500/20 rounded-xl px-3 py-1.5 font-bold flex items-center gap-1.5 text-xs">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>TASA DEL DÍA (VES)</span>
            </div>
            
            <span className="font-black text-lg text-slate-900 font-mono">
              1 USD = <span className="text-amber-600">{exchangeRate.toFixed(2)}</span> Bs.
            </span>
            
            <span className="text-slate-300">|</span>
            
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>Origen: <span className="font-bold text-slate-800">{rateSource}</span></span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {/* Global Currency Selector */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">Moneda Visual:</span>
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleGlobalCurrencyChange('USD')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    globalCurrency === 'USD'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  $ USD
                </button>
                <button
                  type="button"
                  onClick={() => handleGlobalCurrencyChange('VES')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    globalCurrency === 'VES'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bs. VES
                </button>
              </div>
            </div>

            <span className="text-slate-200 hidden lg:block">|</span>

            {isEditingRate ? (
              <form onSubmit={handleManualRateSave} className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="w-24 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 text-center text-slate-900 text-xs sm:text-sm font-black focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  value={tempRateInput}
                  onChange={(e) => setTempRateInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-xl font-bold text-xs"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingRate(false);
                    setTempRateInput(exchangeRate.toString());
                  }}
                  className="text-slate-400 hover:text-slate-600 font-bold px-1 text-xs"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditingRate(true)}
                  className="text-slate-700 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl font-semibold text-xs transition-colors border border-slate-200"
                >
                  Cambiar Tasa
                </button>
                
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing || isFetchingRate}
                  className="text-slate-700 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl disabled:opacity-50 transition-all border border-slate-200 flex items-center gap-1.5 active:scale-95"
                  title="Sincronizar precios, inventario y tasa manualmente con todos los dispositivos"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || isFetchingRate ? 'animate-spin' : ''}`} />
                  <span className="text-xs font-semibold">Sincronizar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Navigation Controls (Responsive & Easy to Click on Mobile) */}
      <nav className="bg-white border-b-2 border-gray-150 sticky top-0 z-40 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-5">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 py-3 sm:py-4">
            
            <button
              id="nav-prices-tab"
              onClick={() => setActiveTab('prices')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 px-1.5 sm:px-6 py-2.5 sm:py-4.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-sm md:text-base transition-all active:scale-95 ${
                activeTab === 'prices'
                  ? 'bg-red-50 text-red-700 ring-2 ring-red-600/20 border-transparent shadow-md'
                  : 'text-gray-600 hover:text-gray-950 hover:bg-gray-100 border border-transparent'
              }`}
            >
              <Edit3 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              <span className="block sm:hidden text-center leading-tight">1. Lista<br/>Precios</span>
              <span className="hidden sm:block">1. Lista de Precios</span>
            </button>

            <button
              id="nav-calculator-tab"
              onClick={() => setActiveTab('calculator')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 px-1.5 sm:px-6 py-2.5 sm:py-4.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-sm md:text-base transition-all active:scale-95 ${
                activeTab === 'calculator'
                  ? 'bg-green-50 text-green-700 ring-2 ring-green-600/20 border-transparent shadow-md'
                  : 'text-gray-600 hover:text-gray-950 hover:bg-gray-100 border border-transparent'
              }`}
            >
              <Scale className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              <span className="block sm:hidden text-center leading-tight">2. Pesado<br/>Conversor</span>
              <span className="hidden sm:block">2. Pesado / Conversor</span>
            </button>

            <button
              id="nav-combos-tab"
              onClick={() => setActiveTab('combos')}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 px-1.5 sm:px-6 py-2.5 sm:py-4.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-sm md:text-base transition-all active:scale-95 ${
                activeTab === 'combos'
                  ? 'bg-red-50 text-red-700 ring-2 ring-red-600/20 border-transparent shadow-md'
                  : 'text-gray-600 hover:text-gray-950 hover:bg-gray-100 border border-transparent'
              }`}
            >
              <Layers className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              <span className="block sm:hidden text-center leading-tight">3. Optimizar<br/>Combos</span>
              <span className="hidden sm:block">3. Optimizador Combos</span>
            </button>

          </div>
        </div>
      </nav>

      {/* 3. Main Dashboard Content (Animated Transitions) */}
      <main className="max-w-7xl mx-auto px-4 mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'prices' && (
              <PriceList
                products={products}
                onUpdateProducts={updateProducts}
                onSelectForCalculation={handleSelectForCalculation}
                onResetToDefault={handleResetToDefault}
                exchangeRate={exchangeRate}
                globalCurrency={globalCurrency}
              />
            )}

            {activeTab === 'calculator' && (
              <QuickCalculator
                products={products}
                selectedProduct={selectedProduct}
                onSelectProduct={setSelectedProduct}
                exchangeRate={exchangeRate}
                globalCurrency={globalCurrency}
              />
            )}

            {activeTab === 'combos' && (
              <ComboOptimizer
                products={products}
                comboConfig={comboConfig}
                onUpdateComboConfig={setComboConfig}
                inventory={inventory}
                onUpdateInventory={updateInventory}
                exchangeRate={exchangeRate}
                globalCurrency={globalCurrency}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 4. Help Section / Counter Shortcut Tips (Craftsmanship Touch) */}
      <footer className="max-w-7xl mx-auto px-4 mt-8 print:hidden">
        <div className="bg-gray-100 rounded-2xl p-4 md:p-5 border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Atención de Mostrador</h4>
              <p className="text-gray-500 text-xs mt-0.5">
                Para pesar o cotizar rápidamente, dale clic al botón <span className="font-bold text-gray-700">Pesar / Cotizar</span> en la lista de precios para cargar el producto al instante.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Configuración Segura</h4>
              <p className="text-gray-500 text-xs mt-0.5">
                Los precios de los cortes, inventarios de bandejas y combos se guardan solos en el navegador. No perderás tus datos al refrescar la pantalla.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Combos en un Clic</h4>
              <p className="text-gray-500 text-xs mt-0.5">
                Utiliza los botones grandes de <span className="font-extrabold text-green-600">+</span> y <span className="font-extrabold text-red-500">-</span> para registrar las bandejas del mostrador y obtener el cálculo de combos al instante.
              </p>
            </div>
          </div>

        </div>
      </footer>

      {/* Floating Synchronization Toast/Notification */}
      <AnimatePresence>
        {syncStatus && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-11/12 px-4 py-3.5 rounded-2xl shadow-xl border flex items-center gap-3 bg-white"
            style={{
              borderColor: syncStatus.type === 'success' ? '#bbf7d0' : '#fecaca',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div className={`p-2 rounded-xl flex-shrink-0 ${
              syncStatus.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {syncStatus.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-black text-gray-900 leading-tight">
                {syncStatus.type === 'success' ? 'Sincronización Exitosa' : 'Error de Sincronización'}
              </p>
              <p className="text-[11px] sm:text-xs text-gray-600 font-medium mt-0.5 leading-relaxed">
                {syncStatus.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSyncStatus(null)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors font-bold text-lg"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
