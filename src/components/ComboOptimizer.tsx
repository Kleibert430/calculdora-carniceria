/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, ComboConfig, ComboItem, InventoryTrays, CalculationResult } from '../types';
import { DEFAULT_PRODUCTS } from '../defaultProducts';
import { safeStorage } from '../utils';
import { 
  Layers, Plus, Minus, Trash2, Award, AlertTriangle, 
  ShieldCheck, DollarSign, Edit3, Check, Play, RefreshCw, 
  Scale, Tag, Info, AlertCircle, Save, Sparkles, PlusCircle, Bookmark, Package,
  Printer, Send, Copy, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Custom interface for combo recipe items with optional custom price overrides per portion
interface ComboRecipeItem {
  productId: string;
  requiredWeightGrams: number;
  customPortionPrice?: number; // Optional manual override price for this portion (e.g. override calculated weight price)
}

interface SingleComboRecipe {
  name: string; // Optional custom name
  items: ComboRecipeItem[];
  customPrice?: number; // Optional manual override for the entire combo total price
}

const SYSTEM_PRESETS: SingleComboRecipe[] = [
  {
    name: 'Combo Familiar Estándar',
    items: [
      { productId: 'carne_molida', requiredWeightGrams: 500 },
      { productId: 'muslos', requiredWeightGrams: 1000 },
      { productId: 'chuleta_de_res', requiredWeightGrams: 1000 }
    ]
  },
  {
    name: 'Combo Parrillero Premium',
    items: [
      { productId: 'chuleta_de_res', requiredWeightGrams: 1500 },
      { productId: 'lomito_y_pulpa', requiredWeightGrams: 1000 },
      { productId: 'cochino', requiredWeightGrams: 1000 }
    ]
  },
  {
    name: 'Combo Sopa Familiar',
    items: [
      { productId: 'costillas_de_res', requiredWeightGrams: 1500 },
      { productId: 'carne_molida', requiredWeightGrams: 500 },
      { productId: 'hueso_redondo', requiredWeightGrams: 1000 }
    ]
  },
  {
    name: 'Combo Todo Pollo',
    items: [
      { productId: 'pechuga', requiredWeightGrams: 1000 },
      { productId: 'muslos', requiredWeightGrams: 1500 },
      { productId: 'alas', requiredWeightGrams: 1000 }
    ]
  },
  {
    name: 'Combo Surtido Económico',
    items: [
      { productId: 'carne', requiredWeightGrams: 1000 },
      { productId: 'carne_molida', requiredWeightGrams: 500 },
      { productId: 'muslos', requiredWeightGrams: 1000 }
    ]
  }
];

interface ComboOptimizerProps {
  products: Product[];
  comboConfig: ComboConfig;
  onUpdateComboConfig: (config: ComboConfig) => void;
  inventory: InventoryTrays;
  onUpdateInventory: (inventory: InventoryTrays) => void;
  exchangeRate: number;
  globalCurrency: 'USD' | 'VES';
}

export default function ComboOptimizer({
  products,
  comboConfig,
  onUpdateComboConfig,
  inventory,
  onUpdateInventory,
  exchangeRate,
  globalCurrency
}: ComboOptimizerProps) {
  // --- STATE FOR SINGLE OPTIONAL NAMED RECIPE ---
  const [comboRecipe, setComboRecipe] = useState<SingleComboRecipe>(() => {
    const saved = safeStorage.getItem('carniceria_single_combo_recipe_v4');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SingleComboRecipe;
        if (parsed && parsed.items && parsed.items.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing single recipe from localStorage, loading default.', e);
      }
    }
    // Default initial recipe items: carne_molida defaults to 500g (medio kilo) as requested
    return {
      name: '', // Empty by default (optional name)
      items: [
        { productId: 'carne_molida', requiredWeightGrams: 500 },
        { productId: 'muslos', requiredWeightGrams: 1000 },
        { productId: 'chuleta_de_res', requiredWeightGrams: 1000 }
      ]
    };
  });

  // --- STATE FOR SAVED RECIPES (PLANTILLAS) ---
  const [savedRecipes, setSavedRecipes] = useState<SingleComboRecipe[]>(() => {
    const saved = safeStorage.getItem('carniceria_saved_combo_templates_v4');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Error parsing saved templates', e);
      }
    }
    return [];
  });

  // --- STATE FOR SYSTEM PRESETS ---
  const [systemPresets, setSystemPresets] = useState<SingleComboRecipe[]>(() => {
    const saved = safeStorage.getItem('carniceria_system_presets_v4');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Error parsing saved system presets', e);
      }
    }
    return SYSTEM_PRESETS;
  });

  // Persist systemPresets changes
  useEffect(() => {
    safeStorage.setItem('carniceria_system_presets_v4', JSON.stringify(systemPresets));
  }, [systemPresets]);

  // Track the original name of the combo being edited
  const [editingOriginalName, setEditingOriginalName] = useState<string | null>(null);

  // State to track deleted predefined system presets
  const [hiddenSystemPresets, setHiddenSystemPresets] = useState<string[]>(() => {
    const saved = safeStorage.getItem('carniceria_hidden_system_presets_v4');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Error parsing hidden system presets', e);
      }
    }
    return [];
  });

  // State for adding ingredients to combo
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>('');
  const [weightToAdd, setWeightToAdd] = useState<number>(1000); // Defaults to 1000g

  // Toggle to prioritize original fixed base prices of the workbook
  const [useBasePrices, setUseBasePrices] = useState<boolean>(true);

  // Toggle for the elegant Combo Configuration Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Dynamic feedback toast when changing combos
  const [toast, setToast] = useState<{ message: string; submessage?: string } | null>(null);

  // Custom non-blocking dialog states for multi-device/iframe safety
  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [customPrompt, setCustomPrompt] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (val: string) => void;
  } | null>(null);

  // Track which combo is showing the inline delete confirmation UI
  const [comboNameToDelete, setComboNameToDelete] = useState<string | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Core calculation states
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [isCalculated, setIsCalculated] = useState<boolean>(false); // Starts uncalculated as requested
  const [calculationTrigger, setCalculationTrigger] = useState<number>(0);

  // State for simulated multi-combo production quantities
  const [simulatedQuantities, setSimulatedQuantities] = useState<{ [recipeName: string]: number }>({});

  // --- PERSIST COMBO RECIPE ---
  useEffect(() => {
    safeStorage.setItem('carniceria_single_combo_recipe_v4', JSON.stringify(comboRecipe));
  }, [comboRecipe]);

  // --- PERSIST SAVED TEMPLATES ---
  useEffect(() => {
    safeStorage.setItem('carniceria_saved_combo_templates_v4', JSON.stringify(savedRecipes));
  }, [savedRecipes]);

  // --- PERSIST HIDDEN SYSTEM PRESETS ---
  useEffect(() => {
    safeStorage.setItem('carniceria_hidden_system_presets_v4', JSON.stringify(hiddenSystemPresets));
  }, [hiddenSystemPresets]);

  // Synchronize active recipe to parent App.tsx comboConfig
  useEffect(() => {
    if (comboRecipe && Array.isArray(comboRecipe.items)) {
      onUpdateComboConfig({
        items: comboRecipe.items
          .filter(item => item && item.productId)
          .map(item => ({
            productId: item.productId,
            requiredWeightGrams: item.requiredWeightGrams
          })),
        customPrice: comboRecipe.customPrice
      });
    }
  }, [comboRecipe, onUpdateComboConfig]);

  // Ensure inventory is initialized for all products
  useEffect(() => {
    const updatedInventory = { ...inventory };
    let changed = false;
    products.forEach(p => {
      if (updatedInventory[p.id] === undefined) {
        updatedInventory[p.id] = 0;
        changed = true;
      }
    });
    if (changed) {
      onUpdateInventory(updatedInventory);
    }
  }, [products, inventory, onUpdateInventory]);

  // Perform calculation of combinations
  const calculateCombos = () => {
    if (!comboRecipe || !Array.isArray(comboRecipe.items) || comboRecipe.items.length === 0) {
      setCalculation({
        maxCombos: 0,
        limitingProductId: null,
        singleComboPrice: 0,
        totalCombosPrice: 0,
        unusedTrays: {}
      });
      return;
    }

    let singleComboPrice = 0;
    const trayCounts: number[] = [];
    const validItems = comboRecipe.items.filter(item => item && item.productId);

    validItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        if (item.customPortionPrice !== undefined) {
          // Custom override price for this item's portion
          singleComboPrice += item.customPortionPrice;
        } else {
          // Standard calculation: weight * price per kg
          let pricePerKg = product.pricePerKg;
          if (useBasePrices) {
            const baseProduct = DEFAULT_PRODUCTS.find(p => p.id === item.productId);
            if (baseProduct) {
              pricePerKg = baseProduct.pricePerKg;
            }
          }
          const weightKg = item.requiredWeightGrams / 1000;
          singleComboPrice += pricePerKg * weightKg;
        }

        const availableTrays = inventory[item.productId] || 0;
        trayCounts.push(availableTrays);
      }
    });

    // Custom total price override for the entire combo if configured
    const finalSinglePrice = comboRecipe.customPrice !== undefined ? comboRecipe.customPrice : singleComboPrice;

    // Max combos is limited by the minimum available trays among combo items
    const maxCombos = trayCounts.length > 0 ? Math.min(...trayCounts) : 0;

    // Identify bottleneck product (limiting factor)
    let limitingProductId: string | null = null;
    if (maxCombos >= 0 && validItems.length > 0) {
      // Find the first item where its inventory equals the limiting count
      const limitingItem = validItems.find(item => (inventory[item.productId] || 0) === maxCombos);
      if (limitingItem) {
        limitingProductId = limitingItem.productId;
      }
    }

    // Unused trays calculations
    const unusedTrays: { [productId: string]: number } = {};
    validItems.forEach(item => {
      const available = inventory[item.productId] || 0;
      unusedTrays[item.productId] = Math.max(0, available - maxCombos);
    });

    setCalculation({
      maxCombos,
      limitingProductId,
      singleComboPrice: finalSinglePrice,
      totalCombosPrice: finalSinglePrice * maxCombos,
      unusedTrays
    });
  };

  // State for report copy success
  const [copied, setCopied] = useState<boolean>(false);

  // Run calculation automatically when anything changes for true interactive feeling
  useEffect(() => {
    calculateCombos();
    setIsCalculated(true);
  }, [comboRecipe?.items, comboRecipe?.customPrice, inventory, useBasePrices, products]);

  // Deduct stock after preparing / selling combos
  const handleDispatchCombos = (qty: number) => {
    if (qty <= 0 || !comboRecipe || !Array.isArray(comboRecipe.items)) return;
    const updatedInventory = { ...inventory };
    let canDispatch = true;
    let missingProduct = '';

    comboRecipe.items.filter(Boolean).forEach(item => {
      const currentVal = updatedInventory[item.productId] || 0;
      if (currentVal < qty) {
        canDispatch = false;
        const pObj = products.find(p => p.id === item.productId);
        if (pObj) missingProduct = pObj.name;
      } else {
        updatedInventory[item.productId] = currentVal - qty;
      }
    });

    if (!canDispatch) {
      setToast({
        message: "Stock Insuficiente",
        submessage: `No hay suficientes bandejas de "${missingProduct}" para despachar ${qty} combos.`
      });
      return;
    }

    onUpdateInventory(updatedInventory);
    setToast({
      message: "¡Despacho Registrado!",
      submessage: `Se han restado -${qty} bandejas de cada ingrediente del combo de tu stock de mostrador.`
    });
  };

  interface ComboSimulationDetails {
    recipe: SingleComboRecipe;
    maxYield: number;
    unitPrice: number;
    totalValuation: number;
    bottleneckProduct: string | null;
    ingredients: { productName: string; weightStr: string }[];
    unusedTrays: { [productId: string]: number };
    remainingYieldsIfSelected: { otherRecipeName: string; yieldCount: number }[];
  }

  // Generate complete simulations details for each available combo
  const getDetailedComboSimulations = (): ComboSimulationDetails[] => {
    const allPresets = [
      ...systemPresets.filter(p => p && p.name && !hiddenSystemPresets.some(h => h.trim().toLowerCase() === p.name.trim().toLowerCase())),
      ...savedRecipes.filter(p => p && p.name)
    ];

    return allPresets.map(recipe => {
      // 1. Calculate maxYield
      const counts = (recipe.items || []).map(item => inventory[item.productId] || 0);
      const maxYield = counts.length > 0 ? Math.min(...counts) : 0;

      // 2. Unit price
      const unitPrice = getEstimatedComboPrice(recipe);

      // 3. Total valuation
      const totalValuation = maxYield * unitPrice;

      // 4. Bottleneck product
      let bottleneckProduct: string | null = null;
      if (recipe.items && recipe.items.length > 0) {
        const limitingItem = recipe.items.find(item => (inventory[item.productId] || 0) === maxYield);
        if (limitingItem) {
          const prod = products.find(p => p.id === limitingItem.productId);
          bottleneckProduct = prod ? prod.name : limitingItem.productId;
        }
      }

      // 5. Ingredients
      const ingredients = (recipe.items || []).map(item => {
        const product = products.find(p => p.id === item.productId);
        const weightStr = item.requiredWeightGrams === 500 ? '1/2 kg' : `${(item.requiredWeightGrams / 1000).toFixed(1).replace('.0', '')} kg`;
        return {
          productName: product ? product.name : item.productId,
          weightStr
        };
      });

      // 6. Unused trays
      const unusedTrays: { [productId: string]: number } = {};
      (recipe.items || []).forEach(item => {
        const available = inventory[item.productId] || 0;
        unusedTrays[item.productId] = Math.max(0, available - maxYield);
      });

      // 7. Simulated inventory after this combo is fully built
      const simulatedInventory = { ...inventory };
      (recipe.items || []).forEach(item => {
        const available = simulatedInventory[item.productId] || 0;
        simulatedInventory[item.productId] = Math.max(0, available - maxYield);
      });

      // 8. Remaining yields for OTHER combos under this simulated inventory
      const remainingYieldsIfSelected = allPresets
        .filter(other => other.name !== recipe.name)
        .map(other => {
          const otherCounts = (other.items || []).map(item => simulatedInventory[item.productId] || 0);
          const otherYield = otherCounts.length > 0 ? Math.min(...otherCounts) : 0;
          return {
            otherRecipeName: other.name,
            yieldCount: otherYield
          };
        });

      return {
        recipe,
        maxYield,
        unitPrice,
        totalValuation,
        bottleneckProduct,
        ingredients,
        unusedTrays,
        remainingYieldsIfSelected
      };
    });
  };

  // Shared text generator for reports
  const getReportText = (): string => {
    const simulations = getDetailedComboSimulations();
    
    let text = `🥩 *REPORTE DE SIMULACIÓN DE COMBOS PARA EL ADMINISTRADOR* 🥩\n`;
    text += `📅 _Generado: ${new Date().toLocaleString('es-VE')}_\n\n`;
    text += `Este reporte simula la disponibilidad y viabilidad de cada tipo de combo según el stock de bandejas en mostrador para facilitar la toma de decisiones.\n\n`;
    
    simulations.forEach((sim, idx) => {
      text += `📦 *${idx + 1}. COMBO: ${sim.recipe.name.toUpperCase()}*\n`;
      text += `• *Rendimiento Máximo:* *${sim.maxYield} combos posibles* ${sim.maxYield > 0 ? '✅' : '❌'}\n`;
      text += `• *Ingredientes por combo:*\n`;
      sim.ingredients.forEach(ing => {
        text += `  - 1 bandeja de ${ing.productName} (${ing.weightStr})\n`;
      });
      
      if (sim.maxYield > 0) {
        if (sim.bottleneckProduct) {
          text += `• *Cuello de Botella (Limitante):* *${sim.bottleneckProduct}*\n`;
        }
        text += `• *Precio Unitario:* $${sim.unitPrice.toFixed(2)} (${(sim.unitPrice * exchangeRate).toFixed(2)} Bs.)\n`;
        text += `• *Valorización Total si se arma:* *$${sim.totalValuation.toFixed(2)} USD* (${(sim.totalValuation * exchangeRate).toFixed(2)} Bs.)\n`;
        
        // Sobrantes (Unused trays)
        const leftoversStr = sim.recipe.items
          .map(item => {
            const left = sim.unusedTrays[item.productId] || 0;
            if (left === 0) return null;
            const product = products.find(p => p.id === item.productId);
            return `${left} bndj de ${product?.name?.split(' ')[0] || item.productId}`;
          })
          .filter(Boolean)
          .join(', ');
        
        text += `• *Bandejas Sobrantes:* ${leftoversStr ? leftoversStr : 'Ninguna'}\n`;
        
        // Alternative yields if selected
        const activeAlts = sim.remainingYieldsIfSelected.filter(alt => alt.yieldCount > 0);
        if (activeAlts.length > 0) {
          text += `• *Viabilidad Alternativa (si se agota este combo):*\n`;
          activeAlts.forEach(alt => {
            text += `  - Podrían armarse todavía *${alt.yieldCount}* combos de "${alt.otherRecipeName}" con las bandejas sobrantes.\n`;
          });
        } else {
          text += `• *Viabilidad Alternativa:* No quedarían bandejas suficientes para otros combos.\n`;
        }
      } else {
        text += `• *Nota:* No se puede armar este combo por falta de ingredientes (Stock 0 en uno o más componentes).\n`;
      }
      text += `\n────────────────────\n\n`;
    });
    
    text += `📥 _Administrador: Revisa estas opciones y selecciona qué combo(s) conviene habilitar para optimizar la venta._`;
    return text;
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        setToast({
          message: "¡Reporte Copiado!",
          submessage: "El reporte se ha copiado al portapapeles con éxito."
        });
      } else {
        throw new Error('Fallback copy command failed');
      }
    } catch (err) {
      console.error("Fallback copy failed: ", err);
      setToast({
        message: "Error al Copiar",
        submessage: "No se pudo copiar automáticamente. Por favor, copia el texto manualmente."
      });
    }
  };

  const handleCopyReport = () => {
    try {
      const text = getReportText();
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          setToast({
            message: "¡Reporte Copiado!",
            submessage: "El reporte se ha copiado al portapapeles en formato profesional para compartir por cualquier vía."
          });
        }).catch((err) => {
          console.error("Clipboard write text failed, using fallback:", err);
          fallbackCopyTextToClipboard(text);
        });
      } else {
        fallbackCopyTextToClipboard(text);
      }
    } catch (err) {
      console.error("Clipboard error:", err);
    }
  };

  const handleManualTriggerCalculate = () => {
    calculateCombos();
    setIsCalculated(true);
    // Flash effect
    setCalculationTrigger(prev => prev + 1);
  };

  // --- ACTIONS FOR RECIPE ITEMS ---
  const handleComboNameChange = (val: string) => {
    setComboRecipe(prev => ({
      ...prev,
      name: val
    }));
  };

  // Save all modifications made to name, cuts, weights or overridden price in the edit modal
  const handleSaveChangesFromModal = () => {
    const currentName = comboRecipe.name.trim();
    if (!currentName) {
      setToast({
        message: "Nombre Requerido",
        submessage: "Por favor, introduce un nombre para el combo antes de continuar."
      });
      return;
    }

    if (editingOriginalName) {
      // Editing an existing combo
      const isSystem = systemPresets.some(r => r.name.toLowerCase() === editingOriginalName.toLowerCase());
      
      const saveAction = () => {
        if (isSystem) {
          setSystemPresets(prev => prev.map(r => r.name.toLowerCase() === editingOriginalName.toLowerCase() ? { ...comboRecipe, name: currentName } : r));
        } else {
          setSavedRecipes(prev => prev.map(r => r.name.toLowerCase() === editingOriginalName.toLowerCase() ? { ...comboRecipe, name: currentName } : r));
        }
        
        setToast({
          message: `¡Combo "${currentName}" actualizado!`,
          submessage: "Los cambios se han guardado correctamente en tu catálogo."
        });
        setIsEditModalOpen(false);
        setEditingOriginalName(null);
      };

      const otherExistsInSystem = systemPresets.some(r => r && r.name && r.name.toLowerCase() === currentName.toLowerCase() && r.name.toLowerCase() !== editingOriginalName.toLowerCase() && !hiddenSystemPresets.some(h => h.trim().toLowerCase() === r.name.trim().toLowerCase()));
      const otherExistsInSaved = savedRecipes.some(r => r && r.name && r.name.toLowerCase() === currentName.toLowerCase() && r.name.toLowerCase() !== editingOriginalName.toLowerCase());

      if (otherExistsInSystem || otherExistsInSaved) {
        setCustomConfirm({
          isOpen: true,
          title: "Sobrescribir Combo",
          message: `Ya existe otro combo con el nombre "${currentName}". ¿Deseas sobrescribirlo con estos cambios?`,
          onConfirm: () => {
            saveAction();
            setCustomConfirm(null);
          }
        });
      } else {
        saveAction();
      }
    } else {
      // Creating a new combo
      const existsInSystem = systemPresets.some(r => r && r.name && r.name.toLowerCase() === currentName.toLowerCase() && !hiddenSystemPresets.some(h => h.trim().toLowerCase() === r.name.trim().toLowerCase()));
      const existsInSaved = savedRecipes.some(r => r && r.name && r.name.toLowerCase() === currentName.toLowerCase());
      
      const saveNewAction = () => {
        if (existsInSystem) {
          setSystemPresets(prev => prev.map(r => r.name.toLowerCase() === currentName.toLowerCase() ? { ...comboRecipe, name: currentName } : r));
        } else if (existsInSaved) {
          setSavedRecipes(prev => prev.map(r => r.name.toLowerCase() === currentName.toLowerCase() ? { ...comboRecipe, name: currentName } : r));
        } else {
          setSavedRecipes(prev => [...prev, { ...comboRecipe, name: currentName }]);
        }

        setToast({
          message: `¡Combo "${currentName}" creado!`,
          submessage: "El nuevo tipo de combo ha sido añadido a tu catálogo."
        });
        setIsEditModalOpen(false);
        setEditingOriginalName(null);
      };

      if (existsInSystem || existsInSaved) {
        setCustomConfirm({
          isOpen: true,
          title: "Sobrescribir Combo",
          message: `Ya existe un combo con el nombre "${currentName}". ¿Deseas sobrescribirlo?`,
          onConfirm: () => {
            saveNewAction();
            setCustomConfirm(null);
          }
        });
      } else {
        saveNewAction();
      }
    }
  };

  // Save current combo recipe as a template
  const handleSaveComboTemplate = () => {
    const name = comboRecipe.name.trim();
    if (!name) {
      setCustomPrompt({
        isOpen: true,
        title: "Guardar Combo como Plantilla",
        message: "Introduce un nombre para guardar este combo en tu catálogo (Ej. Mi Super Combo):",
        placeholder: "Nombre del combo...",
        onConfirm: (promptedName) => {
          const trimmedName = promptedName.trim();
          if (!trimmedName) return;
          setComboRecipe(prev => ({ ...prev, name: trimmedName }));
          saveTemplateWithName(trimmedName);
          setCustomPrompt(null);
        }
      });
    } else {
      saveTemplateWithName(name);
    }
  };

  const saveTemplateWithName = (name: string) => {
    const exists = savedRecipes.some(r => r.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setCustomConfirm({
        isOpen: true,
        title: "Sobrescribir Plantilla",
        message: `Ya existe un combo guardado con el nombre "${name}". ¿Deseas sobrescribirlo con los ingredientes y precios actuales?`,
        onConfirm: () => {
          setSavedRecipes(prev => prev.map(r => r.name.toLowerCase() === name.toLowerCase() ? { ...comboRecipe, name } : r));
          setToast({
            message: "¡Plantilla Actualizada!",
            submessage: `El combo "${name}" se ha sobrescrito con los valores actuales.`
          });
          setCustomConfirm(null);
        }
      });
    } else {
      const updatedRecipe = { ...comboRecipe, name };
      setSavedRecipes(prev => [...prev, updatedRecipe]);
      setToast({
        message: "¡Plantilla Guardada!",
        submessage: `El combo "${name}" se ha añadido correctamente a tus plantillas.`
      });
    }
  };

  const adjustComboItemWeight = (productId: string, deltaGrams: number) => {
    const itemsArray = Array.isArray(comboRecipe?.items) ? comboRecipe.items : [];
    const updatedItems = itemsArray.map(item => {
      if (item && item.productId === productId) {
        const nextWeight = Math.max(50, item.requiredWeightGrams + deltaGrams);
        return { ...item, requiredWeightGrams: nextWeight };
      }
      return item;
    });
    setComboRecipe(prev => ({
      ...prev,
      items: updatedItems
    }));
  };

  const handleComboItemWeightInput = (productId: string, value: string) => {
    const parsed = parseInt(value);
    const itemsArray = Array.isArray(comboRecipe?.items) ? comboRecipe.items : [];
    const updatedItems = itemsArray.map(item => {
      if (item && item.productId === productId) {
        return { ...item, requiredWeightGrams: isNaN(parsed) || parsed < 50 ? 50 : parsed };
      }
      return item;
    });
    setComboRecipe(prev => ({
      ...prev,
      items: updatedItems
    }));
  };

  const handleItemPortionPriceOverride = (productId: string, val: string) => {
    const parsed = val === '' ? undefined : parseFloat(val);
    const itemsArray = Array.isArray(comboRecipe?.items) ? comboRecipe.items : [];
    const updatedItems = itemsArray.map(item => {
      if (item && item.productId === productId) {
        return { ...item, customPortionPrice: isNaN(parsed as number) ? undefined : parsed };
      }
      return item;
    });
    setComboRecipe(prev => ({
      ...prev,
      items: updatedItems
    }));
  };

  const handleOverallComboPriceOverride = (val: string) => {
    const parsed = val === '' ? undefined : parseFloat(val);
    setComboRecipe(prev => ({
      ...prev,
      customPrice: isNaN(parsed as number) ? undefined : parsed
    }));
  };

  const removeComboItem = (productId: string) => {
    const itemsArray = Array.isArray(comboRecipe?.items) ? comboRecipe.items : [];
    const updatedItems = itemsArray.filter(item => item && item.productId !== productId);
    setComboRecipe(prev => ({
      ...prev,
      items: updatedItems
    }));
  };

  const handleAddProductToCombo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductToAdd) return;

    const itemsArray = Array.isArray(comboRecipe?.items) ? comboRecipe.items : [];
    if (itemsArray.some(item => item && item.productId === selectedProductToAdd)) {
      alert('Este producto ya forma parte del combo.');
      return;
    }

    const newItem: ComboRecipeItem = {
      productId: selectedProductToAdd,
      requiredWeightGrams: weightToAdd
    };

    setComboRecipe(prev => ({
      ...prev,
      items: [...(Array.isArray(prev.items) ? prev.items : []), newItem]
    }));
    setSelectedProductToAdd('');
    setWeightToAdd(1000); // Reset weight to default
  };

  // --- HELPERS FOR MULTIPLE COMBO TYPES & INSTANT CALCULATIONS ---
  
  // Calculate potential yield of a specific combo recipe based on current inventory on-the-fly
  const getPossibleYield = (recipe: SingleComboRecipe): number => {
    if (!recipe.items || recipe.items.length === 0) return 0;
    const counts = recipe.items.map(item => inventory[item.productId] || 0);
    return counts.length > 0 ? Math.min(...counts) : 0;
  };

  // Estimate single combo price on-the-fly
  const getEstimatedComboPrice = (recipe: SingleComboRecipe): number => {
    if (!recipe.items || recipe.items.length === 0) return 0;
    if (recipe.customPrice !== undefined) return recipe.customPrice;
    let total = 0;
    recipe.items.forEach(item => {
      if (item.customPortionPrice !== undefined) {
        total += item.customPortionPrice;
      } else {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          let pricePerKg = product.pricePerKg;
          if (useBasePrices) {
            const baseProduct = DEFAULT_PRODUCTS.find(bp => bp.id === item.productId);
            if (baseProduct) pricePerKg = baseProduct.pricePerKg;
          }
          total += pricePerKg * (item.requiredWeightGrams / 1000);
        }
      }
    });
    return total;
  };

  // Combine all possible recipes to display in the simulator
  const allAvailableRecipes: SingleComboRecipe[] = [
    ...(comboRecipe && Array.isArray(comboRecipe.items) && comboRecipe.items.length > 0 ? [{
      name: comboRecipe.name.trim() || 'Receta Activa Personalizada',
      items: comboRecipe.items,
      customPrice: comboRecipe.customPrice
    }] : []),
    ...systemPresets.filter(p => p && p.name && !hiddenSystemPresets.some(h => h.trim().toLowerCase() === p.name.trim().toLowerCase())),
    ...savedRecipes.filter(p => p && p.name)
  ];

  // De-duplicate by name
  const uniqueAvailableRecipes = allAvailableRecipes.filter((r, idx, self) =>
    self.findIndex(item => item.name.toLowerCase() === r.name.toLowerCase()) === idx
  );

  // Calculate simulated consumption & leftovers based on quantities
  const getSimulatedResults = () => {
    const consumption: { [productId: string]: number } = {};
    const leftovers: { [productId: string]: number } = { ...inventory };
    
    // Initialize consumption to 0
    products.forEach(p => {
      consumption[p.id] = 0;
    });

    let hasActiveSimulation = false;
    let totalSimulatedCombos = 0;
    
    // Calculate total consumption
    Object.entries(simulatedQuantities).forEach(([recipeName, qty]) => {
      const qtyNum = qty as number;
      if (qtyNum <= 0) return;
      hasActiveSimulation = true;
      totalSimulatedCombos += qtyNum;
      const recipe = uniqueAvailableRecipes.find(r => r.name === recipeName);
      if (recipe) {
        recipe.items.forEach(item => {
          consumption[item.productId] = (consumption[item.productId] || 0) + qtyNum;
        });
      }
    });

    // Calculate leftovers and check if they exceed stock
    const exceedsStock: { [productId: string]: boolean } = {};
    products.forEach(p => {
      const available = inventory[p.id] || 0;
      const consumed = consumption[p.id] || 0;
      leftovers[p.id] = Math.max(0, available - consumed);
      if (consumed > available) {
        exceedsStock[p.id] = true;
      }
    });

    // Check which other combos can be built with remaining trays
    const otherComboYields: { [recipeName: string]: number } = {};
    uniqueAvailableRecipes.forEach(recipe => {
      let minYield = Infinity;
      if (!recipe.items || recipe.items.length === 0) {
        minYield = 0;
      } else {
        recipe.items.forEach(item => {
          const left = leftovers[item.productId] || 0;
          minYield = Math.min(minYield, left);
        });
      }
      otherComboYields[recipe.name] = minYield === Infinity ? 0 : minYield;
    });

    return {
      consumption,
      leftovers,
      exceedsStock,
      hasActiveSimulation,
      totalSimulatedCombos,
      otherComboYields
    };
  };

  // Switch/Load specific combo and immediately trigger calculation
  const handleLoadComboRecipe = (recipe: SingleComboRecipe, shouldOpenEdit?: boolean) => {
    setComboRecipe(recipe);
    
    // Perform calculation of combinations instantly for immediate user feedback
    let singleComboPrice = 0;
    const trayCounts: number[] = [];

    recipe.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        if (item.customPortionPrice !== undefined) {
          singleComboPrice += item.customPortionPrice;
        } else {
          let pricePerKg = product.pricePerKg;
          if (useBasePrices) {
            const baseProduct = DEFAULT_PRODUCTS.find(bp => bp.id === item.productId);
            if (baseProduct) {
              pricePerKg = baseProduct.pricePerKg;
            }
          }
          const weightKg = item.requiredWeightGrams / 1000;
          singleComboPrice += pricePerKg * weightKg;
        }

        const availableTrays = inventory[item.productId] || 0;
        trayCounts.push(availableTrays);
      }
    });

    const finalSinglePrice = recipe.customPrice !== undefined ? recipe.customPrice : singleComboPrice;
    const maxCombos = trayCounts.length > 0 ? Math.min(...trayCounts) : 0;

    let limitingProductId: string | null = null;
    if (maxCombos >= 0 && recipe.items.length > 0) {
      const limitingItem = recipe.items.find(item => (inventory[item.productId] || 0) === maxCombos);
      if (limitingItem) {
        limitingProductId = limitingItem.productId;
      }
    }

    const unusedTrays: { [productId: string]: number } = {};
    recipe.items.forEach(item => {
      const available = inventory[item.productId] || 0;
      unusedTrays[item.productId] = Math.max(0, available - maxCombos);
    });

    setCalculation({
      maxCombos,
      limitingProductId,
      singleComboPrice: finalSinglePrice,
      totalCombosPrice: finalSinglePrice * maxCombos,
      unusedTrays
    });
    
    setToast({
      message: `¡Cambiado a "${recipe.name || 'Combo'}"!`,
      submessage: `Con las bandejas del mostrador actual, salen exactamente ${maxCombos} combos de este tipo.`
    });
    
    setIsCalculated(true);
    setCalculationTrigger(prev => prev + 1);

    if (shouldOpenEdit) {
      setIsEditModalOpen(true);
    }
  };

  const handleCreateNewCombo = () => {
    setEditingOriginalName(null);
    const newCombo: SingleComboRecipe = {
      name: 'Mi Combo Creado',
      items: [
        { productId: 'carne_molida', requiredWeightGrams: 500 } // medio kilo por defecto
      ]
    };
    setComboRecipe(newCombo);
    setIsCalculated(false);
    setIsEditModalOpen(true);
  };

  // --- WHATSAPP SHARING ENGINE ---
  const handleShareWhatsApp = () => {
    const text = getReportText();
    if (!text) return;
    
    const encoded = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/?text=${encoded}`;
    window.open(whatsappUrl, '_blank');
  };

  // --- PRINTING ENGINE ---
  const handlePrintReport = () => {
    window.print();
  };

  // --- INVENTORY TRAY ADJUSTERS ---
  const adjustTrayCount = (productId: string, delta: number) => {
    const current = inventory[productId] || 0;
    const nextVal = Math.max(0, current + delta);
    onUpdateInventory({
      ...inventory,
      [productId]: nextVal
    });
  };

  const handleTrayInput = (productId: string, value: string) => {
    const parsed = parseInt(value);
    onUpdateInventory({
      ...inventory,
      [productId]: isNaN(parsed) || parsed < 0 ? 0 : parsed
    });
  };

  // Group helpers
  const categories: Array<Product['category']> = ['Res', 'Cerdo', 'Pollo', 'Charcutería', 'Bebidas', 'Víveres'];

  const categoryLabels: Record<string, string> = {
    Res: 'Res',
    Cerdo: 'Cerdo',
    Pollo: 'Pollo',
    Charcutería: 'Charcutería y Lácteos',
    Bebidas: 'Bebidas y Snacks',
    Víveres: 'Víveres'
  };

  // Unselected products available to add to the recipe
  const availableProductsToAdd = products.filter(
    p => !Array.isArray(comboRecipe?.items) || !comboRecipe.items.some(item => item && item.productId === p.id)
  );

  // Simulation Handlers
  const handleIncrementSimulation = (recipe: SingleComboRecipe) => {
    // Calculate current simulated consumption
    const currentConsumption: { [productId: string]: number } = {};
    products.forEach(p => {
      currentConsumption[p.id] = 0;
    });

    Object.entries(simulatedQuantities).forEach(([recipeName, qty]) => {
      const qtyNum = qty as number;
      if (qtyNum <= 0) return;
      const r = uniqueAvailableRecipes.find(item => item.name === recipeName);
      if (r) {
        r.items.forEach(item => {
          currentConsumption[item.productId] = (currentConsumption[item.productId] || 0) + qtyNum;
        });
      }
    });

    // Check if adding one more of this recipe is possible with the actual inventory
    let canAfford = true;
    let bottleneckProduct = '';
    recipe.items.forEach(item => {
      const available = inventory[item.productId] || 0;
      const consumed = currentConsumption[item.productId] || 0;
      if (available - consumed < 1) {
        canAfford = false;
        const pObj = products.find(prod => prod.id === item.productId);
        if (pObj) {
          bottleneckProduct = pObj.name;
        }
      }
    });

    if (!canAfford) {
      setToast({
        message: "¡Sin Stock Suficiente!",
        submessage: `No quedan bandejas suficientes de "${bottleneckProduct || 'ingredientes'}" para armar otro combo "${recipe.name}".`
      });
      return;
    }

    setSimulatedQuantities(prev => ({
      ...prev,
      [recipe.name]: (prev[recipe.name] || 0) + 1
    }));
  };

  const handleDecrementSimulation = (recipeName: string) => {
    setSimulatedQuantities(prev => {
      const next = { ...prev };
      const current = next[recipeName] || 0;
      if (current <= 1) {
        delete next[recipeName];
      } else {
        next[recipeName] = current - 1;
      }
      return next;
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 print:p-0 print:border-0 print:shadow-none" id="combo-optimizer-section">
      
      {/* Dynamic Toast Alerts for Combo Switch Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 right-5 z-50 max-w-md bg-gradient-to-r from-red-600 to-red-700 text-white rounded-2xl shadow-xl border border-red-500/30 p-4 flex items-start gap-3.5 print:hidden"
          >
            <Sparkles className="w-5 h-5 flex-shrink-0 text-amber-300 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-200">
                {toast.message}
              </h4>
              <p className="text-[11px] text-gray-100 font-bold mt-1 leading-snug">
                {toast.submessage}
              </p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-white/60 hover:text-white font-extrabold text-xs bg-black/10 hover:bg-black/20 px-2 py-1 rounded"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Inventario: Bandejas Disponibles en el Mostrador */}
      <div className="border-2 border-gray-200 rounded-3xl p-5 md:p-6 mb-6 bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base md:text-lg font-black text-gray-800 flex items-center gap-2 uppercase tracking-wider">
              <Scale className="w-5 h-5 text-green-600" />
              1. Bandejas Disponibles en el Inventario (Stock)
            </h3>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              Ingresa cuántas bandejas listas tienes de cada corte en el mostrador para simular y calcular cuántos combos puedes armar de forma automática.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                const cleared: InventoryTrays = {};
                products.forEach(p => {
                  cleared[p.id] = 0;
                });
                onUpdateInventory(cleared);
                setToast({
                  message: "Inventario Limpio",
                  submessage: "Se vaciaron todas las bandejas del mostrador."
                });
              }}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold px-3.5 py-2 rounded-xl transition-all border border-gray-200 shadow-xs active:scale-95"
            >
              Limpiar Todo
            </button>
            <button
              type="button"
              onClick={() => {
                const setThree: InventoryTrays = {};
                products.forEach(p => {
                  setThree[p.id] = 3;
                });
                onUpdateInventory(setThree);
                setToast({
                  message: "Stock cargado (3 bandejas c/u)",
                  submessage: "Se colocaron 3 bandejas para cada tipo de corte de carne en mostrador."
                });
              }}
              className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/50 font-extrabold px-3.5 py-2 rounded-xl transition-all shadow-xs active:scale-95"
            >
              Colocar 3 c/u
            </button>
            <button
              type="button"
              onClick={() => {
                const setFive: InventoryTrays = {};
                products.forEach(p => {
                  setFive[p.id] = 5;
                });
                onUpdateInventory(setFive);
                setToast({
                  message: "Stock cargado (5 bandejas c/u)",
                  submessage: "Se colocaron 5 bandejas para cada tipo de corte de carne en mostrador."
                });
              }}
              className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200/50 font-extrabold px-3.5 py-2 rounded-xl transition-all shadow-xs active:scale-95"
            >
              Colocar 5 c/u
            </button>
            <button
              type="button"
              onClick={() => {
                const setTen: InventoryTrays = {};
                products.forEach(p => {
                  setTen[p.id] = 10;
                });
                onUpdateInventory(setTen);
                setToast({
                  message: "Stock cargado (10 bandejas c/u)",
                  submessage: "Se colocaron 10 bandejas para cada tipo de corte de carne en mostrador."
                });
              }}
              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/50 font-extrabold px-3.5 py-2 rounded-xl transition-all shadow-xs active:scale-95"
            >
              Colocar 10 c/u
            </button>
          </div>
        </div>

        {/* Categorized Products List - Beautiful Responsive Multi-Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {categories.map(category => {
            const catProducts = products.filter(p => p.category === category);
            if (catProducts.length === 0) return null;

            return (
              <div key={category} className="border border-gray-200/80 rounded-2xl p-3 bg-gray-50/30 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-black text-gray-600 uppercase tracking-widest block mb-3 px-2 py-1 bg-gray-100 border border-gray-200/40 rounded-lg text-center">
                    {categoryLabels[category] || category}
                  </span>
                  <div className="flex flex-col gap-2">
                    {catProducts.map(p => {
                      const available = inventory[p.id] || 0;
                      const inActiveCombo = Array.isArray(comboRecipe?.items) && comboRecipe.items.some(item => item && item.productId === p.id);

                      return (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between p-2 rounded-xl transition-colors border ${
                            inActiveCombo
                              ? 'bg-red-50/50 border-red-300 hover:bg-red-50/70'
                              : 'bg-white border-gray-200/70 hover:border-gray-300 shadow-xs'
                          }`}
                        >
                          <div className="min-w-0 flex-1 mr-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-gray-800 text-xs sm:text-sm truncate leading-tight">
                                {p.name}
                              </span>
                              {inActiveCombo && (
                                <span className="text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider scale-90 flex-shrink-0">
                                  En receta
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-500 font-mono font-bold block mt-1">${p.pricePerKg.toFixed(2)}/kg</span>
                          </div>

                          {/* Tray Counters */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => adjustTrayCount(p.id, -1)}
                              className="w-7 h-7 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg flex items-center justify-center font-black text-sm active:scale-90 border border-gray-200"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={available}
                              onChange={(e) => handleTrayInput(p.id, e.target.value)}
                              className="w-11 h-7 bg-white border border-gray-200 rounded-lg text-center font-black text-gray-800 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 p-0"
                            />
                            <button
                              type="button"
                              onClick={() => adjustTrayCount(p.id, 1)}
                              className="w-7 h-7 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg flex items-center justify-center font-black text-sm active:scale-90 border border-gray-200"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ACTION TRIGGER BUTTON FOR CALCULATION */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-green-600 font-extrabold flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-xl border border-green-250">
            <ShieldCheck className="w-4 h-4" />
            Actualizado en tiempo real (Cálculo Automático Activo)
          </span>
          <button
            type="button"
            onClick={handleManualTriggerCalculate}
            className="w-full sm:w-auto bg-gray-150 hover:bg-gray-250 text-gray-700 border border-gray-200 font-extrabold text-xs sm:text-sm py-2.5 px-6 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Forzar Recálculo</span>
          </button>
        </div>
      </div>

      {/* 2. Catálogo de Tipos de Combo & Simulación de Rendimiento */}
      <div className="border-b border-gray-100 pb-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <span className="w-3 h-7 bg-red-600 rounded-full inline-block"></span>
              2. Catálogo & Simulación de Tipos de Combo
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Visualiza cuántos combos de cada tipo puedes producir al instante con tus bandejas cargadas arriba, selecciona un tipo para prepararlo.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Reset / Restore Predefined defaults */}
            {(hiddenSystemPresets.length > 0 || savedRecipes.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setCustomConfirm({
                    isOpen: true,
                    title: "Restaurar Predefinidos",
                    message: "¿Deseas restaurar todos los combos predefinidos originales? Esto los reincorporará al catálogo manteniendo tus combos creados.",
                    onConfirm: () => {
                      setHiddenSystemPresets([]);
                      setSystemPresets(SYSTEM_PRESETS);
                      setToast({
                        message: "¡Catálogo Restaurado!",
                        submessage: "Los combos predefinidos originales se han reincorporado al catálogo."
                      });
                      setCustomConfirm(null);
                    }
                  });
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-sm px-4 py-2.5 rounded-2xl transition-all border border-gray-200 shadow-sm flex items-center gap-2 active:scale-95 whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4" />
                Restablecer Predefinidos
              </button>
            )}

            <button
              type="button"
              onClick={handleCreateNewCombo}
              className="bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-sm px-4.5 py-2.5 rounded-2xl transition-all border border-red-200 shadow-sm flex items-center gap-2 active:scale-95 whitespace-nowrap"
            >
              <PlusCircle className="w-4.5 h-4.5" />
              Crear Otro Tipo de Combo
            </button>
          </div>
        </div>

        {/* Dynamic Catalog Grid with explicit Edit and Delete buttons for each card */}
        <div className="flex flex-wrap gap-4 mb-6 justify-center items-start">
          {[
            ...systemPresets.filter(p => p && p.name && !hiddenSystemPresets.some(hiddenName => hiddenName.trim().toLowerCase() === p.name.trim().toLowerCase())).map(p => ({ ...p, isSystem: true })),
            ...savedRecipes.filter(p => p && p.name).map(p => ({ ...p, isSystem: false }))
          ].map((recipe, index) => {
            const possibleYield = getPossibleYield(recipe);
            const isActive = (comboRecipe?.name || '').trim().toLowerCase() === (recipe?.name || '').trim().toLowerCase();
            const estimatedPrice = getEstimatedComboPrice(recipe);

            return (
              <div
                key={index}
                className={`w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)] rounded-3xl p-5 transition-all duration-200 border-2 text-left relative overflow-hidden flex flex-col justify-start group ${
                  isActive
                    ? 'bg-red-50/40 border-red-600 shadow-md ring-1 ring-red-600/20'
                    : 'bg-white border-gray-200/80 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                {/* Active glow background */}
                {isActive && (
                  <div className="absolute top-0 right-0 w-20 h-20 bg-red-100 rounded-full -mr-10 -mt-10 -z-10 opacity-30"></div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                      recipe.isSystem
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {recipe.isSystem ? '🏷️ Predefinido' : '👤 Mi Combo'}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-gray-800 line-clamp-1 group-hover:text-red-700 transition-colors">
                    {recipe.name || 'Combo Sin Nombre'}
                  </h3>

                  {/* Ingredients detailed representation - Larger & with explicit tray count */}
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 transition-colors">
                    <span className="text-xs font-black text-red-600 block uppercase tracking-wider mb-2">
                      📦 LLEVA {recipe.items.length} {recipe.items.length === 1 ? 'BANDEJA' : 'BANDEJAS'} EN TOTAL:
                    </span>
                    <div className="space-y-1.5">
                      {recipe.items.map((item, idx) => {
                        const prod = products.find(p => p.id === item.productId);
                        const weightStr = item.requiredWeightGrams === 500 ? '1/2 kg' : `${(item.requiredWeightGrams / 1000).toFixed(1).replace('.0', '')} kg`;
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm text-gray-700 font-bold">
                            <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>
                            <span>1 band. de <span className="font-extrabold text-gray-950">{prod?.name || item.productId}</span> ({weightStr})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mt-4 pt-3.5 border-t border-gray-150 flex items-center justify-between">
                    {/* Price */}
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold">Costo Estimado</span>
                      <span className="font-black text-gray-800 text-sm font-mono">
                        ${estimatedPrice.toFixed(2)}
                      </span>
                    </div>

                    {/* Production Yield Output - THE KEY REQUIREMENT */}
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold">Producción</span>
                      {possibleYield > 0 ? (
                        <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 px-2.5 py-1 rounded-xl text-xs font-black text-green-700 font-mono">
                          <Package className="w-3.5 h-3.5 text-green-600 animate-bounce" />
                          Saldrían {possibleYield}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-xl text-xs font-extrabold text-gray-500 font-mono">
                          Saldrían 0
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Explicit Action Buttons for editing and deleting the combo type */}
                  <div className="mt-4 pt-3 border-t border-dashed border-gray-150 flex items-center gap-2">
                    {isActive ? (
                      <div className="flex-1 flex gap-1.5">
                        <button
                          type="button"
                          disabled
                          className="flex-1 bg-green-50 text-green-700 border border-green-250 font-black text-[11px] py-2 rounded-xl flex items-center justify-center gap-1 shadow-xs"
                          title="Este combo es la receta activa actual"
                        >
                          <Check className="w-3.5 h-3.5 text-green-600" />
                          <span>ACTIVO</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOriginalName(recipe.name);
                            setIsEditModalOpen(true);
                          }}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] py-2 px-3.5 rounded-xl transition-all flex items-center justify-center gap-1 active:scale-[0.97] shadow-sm"
                          title="Editar nombre y configuración de este combo"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>EDITAR</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLoadComboRecipe(recipe, false)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-[11px] py-2 rounded-xl transition-all flex items-center justify-center gap-1 active:scale-[0.97] shadow-sm"
                          title="Cargar esta receta para preparar y optimizar"
                        >
                          <Play className="w-3 h-3 fill-current text-white" />
                          <span>APLICAR</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleLoadComboRecipe(recipe, false);
                            setEditingOriginalName(recipe.name);
                            setIsEditModalOpen(true);
                          }}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-[11px] py-2 px-3.5 rounded-xl transition-all flex items-center justify-center gap-1 active:scale-[0.97] shadow-xs border border-gray-200"
                          title="Editar este combo"
                        >
                          <Edit3 className="w-3 h-3 text-gray-500" />
                          <span>EDITAR</span>
                        </button>
                      </div>
                    )}
                    
                    {comboNameToDelete === recipe.name ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetName = recipe?.name || '';
                            if (recipe.isSystem) {
                              setHiddenSystemPresets(prev => {
                                if (!prev.some(name => name.trim().toLowerCase() === targetName.trim().toLowerCase())) {
                                  return [...prev, targetName];
                                }
                                return prev;
                              });
                              setSystemPresets(prev => prev.filter(r => r && r.name && r.name.trim().toLowerCase() !== targetName.trim().toLowerCase()));
                            } else {
                              setSavedRecipes(prev => prev.filter(r => r && r.name && r.name.trim().toLowerCase() !== targetName.trim().toLowerCase()));
                            }
                            
                            // If active combo was deleted, clean the workspace
                            if (isActive) {
                              setComboRecipe({ name: '', items: [] });
                              setIsCalculated(false);
                            }

                            setToast({
                              message: "¡Combo Borrado!",
                              submessage: `El combo "${targetName}" ha sido eliminado del catálogo.`
                            });
                            setComboNameToDelete(null);
                          }}
                          className="bg-red-600 hover:bg-red-750 text-white font-black text-[10px] py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1 active:scale-[0.95] shadow-sm animate-pulse"
                          title="Confirmar eliminación permanente del combo de tu catálogo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>¿ELIMINAR?</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setComboNameToDelete(null);
                          }}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-[10px] py-2 px-2.5 rounded-xl transition-all flex items-center justify-center active:scale-[0.95] border border-gray-200"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setComboNameToDelete(recipe.name);
                        }}
                        className="bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 font-bold p-2.5 rounded-xl border border-gray-200 transition-all flex items-center justify-center active:scale-[0.97]"
                        title="Borrar combo de mi catálogo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* EDIT RECIPE AND NAME MODAL */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            ></motion.div>

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 flex flex-col text-left z-10"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-lg sm:text-xl">
                      Editar Nombre y Receta de Combo
                    </h3>
                    <p className="text-xs text-gray-500">
                      Modifica los cortes de carne, pesos, precios individuales y nombre de este combo.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto flex flex-col gap-6">
                {/* Section A: Combo Name */}
                <div className="bg-red-50/20 border border-red-200/50 rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                    <div className="flex items-center gap-3 text-red-700">
                      <Tag className="w-5 h-5 flex-shrink-0" />
                      <div>
                        <span className="text-xs font-black block text-red-800 uppercase tracking-wider">Nombre del Combo (Opcional)</span>
                        <span className="text-[11px] text-gray-500 block leading-tight">Dale un nombre para guardar o personalizar esta plantilla de combo.</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Ej. Combo Parrillada Familiar, Combo del Mes, Súper Sopa..."
                        value={comboRecipe.name}
                        onChange={(e) => handleComboNameChange(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm font-extrabold text-gray-850 placeholder-gray-400 focus:outline-none focus:border-red-500 transition-all shadow-xs"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveComboTemplate}
                        className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-4 py-3 rounded-xl transition-all shadow-md flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                      >
                        <Save className="w-4 h-4" />
                        Guardar Plantilla
                      </button>
                      {comboRecipe.name && (
                        <button
                          type="button"
                          onClick={() => handleComboNameChange('')}
                          className="text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 font-bold px-3.5 py-3 rounded-xl transition-colors whitespace-nowrap border border-gray-200 shadow-xs"
                        >
                          Borrar Nombre
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section B: Base Prices Toggle */}
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                    <div>
                      <span className="text-xs font-black text-gray-800 block uppercase tracking-wider">Precios Base de Carnicería Activos</span>
                      <span className="text-[11px] text-gray-500 block leading-tight">
                        Los combos toman los precios originales fijos por defecto. El cambio de precio por peso es totalmente opcional.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={useBasePrices} 
                        onChange={(e) => setUseBasePrices(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                      <span className="ml-2.5 text-xs font-extrabold text-gray-700">Usar Precios Base</span>
                    </label>
                  </div>
                </div>

                {/* Section C: Recipe & Ingredients Config */}
                <div className="bg-gray-50/50 border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-150">
                    <span className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
                      <Layers className="w-4.5 h-4.5 text-red-600" />
                      Ingredientes Seleccionados
                    </span>
                    <span className="text-xs text-amber-800 font-extrabold font-mono uppercase bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200/40">
                      {Array.isArray(comboRecipe?.items) ? comboRecipe.items.length : 0} cortes
                    </span>
                  </div>

                  {!Array.isArray(comboRecipe?.items) || comboRecipe.items.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500 italic font-bold">
                        Este combo no tiene ingredientes aún. Agrega cortes de carne abajo.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                      {comboRecipe.items.map(item => {
                        const product = products.find(p => p.id === item.productId);
                        if (!product) return null;

                        let pricePerKg = product.pricePerKg;
                        if (useBasePrices) {
                          const baseProduct = DEFAULT_PRODUCTS.find(bp => bp.id === item.productId);
                          if (baseProduct) {
                            pricePerKg = baseProduct.pricePerKg;
                          }
                        }

                        const weightKg = item.requiredWeightGrams / 1000;
                        const calculatedPortionPrice = pricePerKg * weightKg;
                        const stockTrays = inventory[item.productId] || 0;
                        const isLimiting = calculation?.limitingProductId === item.productId;

                        return (
                          <div 
                            key={item.productId} 
                            className={`p-4 rounded-xl border transition-all flex flex-col gap-3 shadow-xs ${
                              isLimiting && calculation && calculation.maxCombos > 0
                                ? 'bg-red-50/20 border-red-300 ring-2 ring-red-500/10'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1 mr-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-black uppercase tracking-wider">{product.category}</span>
                                  <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded border ${
                                    stockTrays > 0 
                                      ? 'bg-green-50 text-green-700 border-green-200' 
                                      : 'bg-red-50 text-red-800 border-red-200'
                                  }`}>
                                    Stock: {stockTrays}
                                  </span>
                                </div>
                                <h4 className="font-extrabold text-gray-900 text-sm truncate mt-1.5">{product.name}</h4>
                                <span className="text-[11px] text-gray-400 font-mono font-bold block mt-0.5">Base: ${pricePerKg.toFixed(2)}/kg</span>
                              </div>

                              {/* Portion Weight Adjuster */}
                              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => adjustComboItemWeight(item.productId, -100)}
                                  className="px-2 py-1 text-gray-600 hover:bg-gray-200 font-black transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  step="100"
                                  min="50"
                                  value={item.requiredWeightGrams}
                                  onChange={(e) => handleComboItemWeightInput(item.productId, e.target.value)}
                                  className="w-14 text-center bg-transparent border-none text-xs font-black text-gray-800 focus:outline-none focus:ring-0 p-0"
                                />
                                <span className="text-[10px] text-gray-400 pr-1.5 font-bold">g</span>
                                <button
                                  type="button"
                                  onClick={() => adjustComboItemWeight(item.productId, 100)}
                                  className="px-2 py-1 text-gray-600 hover:bg-gray-200 font-black transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Portion Prices Config */}
                            <div className="pt-2 border-t border-dashed border-gray-150 flex items-center justify-between gap-2 bg-gray-50/50 p-2 rounded-lg text-xs">
                              <span className="text-gray-500 font-bold">
                                Peso: <span className="font-black text-gray-800">${calculatedPortionPrice.toFixed(2)}</span>
                              </span>
                              
                              <div className="flex items-center gap-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Precio Propio:</label>
                                <div className="relative">
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">$</span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    placeholder="Fijar"
                                    value={item.customPortionPrice !== undefined ? item.customPortionPrice : ''}
                                    onChange={(e) => handleItemPortionPriceOverride(item.productId, e.target.value)}
                                    className="w-16 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs font-black text-right text-gray-850 focus:outline-none focus:ring-1 focus:ring-red-500 pl-4 shadow-xs"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeComboItem(item.productId)}
                                  className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                                  title="Quitar ingrediente"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Dropdown to add more cortes to the recipe inside modal */}
                  {availableProductsToAdd.length > 0 && (
                    <div className="border-t border-gray-200 pt-4 flex flex-col sm:flex-row items-end gap-3 w-full">
                      <div className="flex-1 w-full text-left">
                        <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Corte para Añadir al Combo</label>
                        <select
                          value={selectedProductToAdd}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedProductToAdd(val);
                            if (val === 'carne_molida' || val === 'carne') {
                              setWeightToAdd(500); // 500g (medio kilo) por defecto
                            } else {
                              setWeightToAdd(1000); // 1kg por defecto
                            }
                          }}
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-bold text-gray-700 shadow-xs"
                        >
                          <option value="">-- Seleccionar corte --</option>
                          {availableProductsToAdd.map(p => {
                            let pricePerKg = p.pricePerKg;
                            if (useBasePrices) {
                              const baseProduct = DEFAULT_PRODUCTS.find(bp => bp.id === p.id);
                              if (baseProduct) {
                                pricePerKg = baseProduct.pricePerKg;
                              }
                            }
                            return (
                              <option key={p.id} value={p.id}>{p.name} (${pricePerKg.toFixed(2)}/kg)</option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="w-full sm:w-28 text-left">
                        <label className="block text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Peso Inicial (g)</label>
                        <input
                          type="number"
                          step="50"
                          min="50"
                          value={weightToAdd}
                          onChange={(e) => setWeightToAdd(parseInt(e.target.value) || 1000)}
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-black text-right text-gray-800 shadow-xs"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          const mockEvent = { preventDefault: () => {} } as React.FormEvent;
                          handleAddProductToCombo(mockEvent);
                        }}
                        className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl whitespace-nowrap active:scale-95 transition-all shadow-sm"
                      >
                        Añadir Corte
                      </button>
                    </div>
                  )}
                </div>

                {/* Section D: Special Price Override */}
                <div className="bg-gray-50/50 border border-gray-200 rounded-2xl p-5 text-left">
                  <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider mb-1">
                    Precio Especial del Combo Completo (Opcional)
                  </h4>
                  <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                    Por defecto, el precio del combo es la suma exacta de sus ingredientes. Introduce una tarifa fija si deseas aplicar una oferta especial.
                  </p>
                  <div className="relative max-w-xs">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ej. 15.00 para precio fijo total"
                      value={comboRecipe.customPrice !== undefined ? comboRecipe.customPrice : ''}
                      onChange={(e) => handleOverallComboPriceOverride(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl pl-7 pr-16 py-2.5 text-xs font-black text-gray-850 focus:outline-none focus:ring-1 focus:ring-red-500 shadow-xs"
                    />
                    {comboRecipe.customPrice !== undefined && (
                      <button
                        type="button"
                        onClick={() => handleOverallComboPriceOverride('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-red-500 hover:underline font-extrabold"
                      >
                        Resetear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-150 px-6 py-4.5 flex items-center justify-end gap-3 z-10">
                <button
                  type="button"
                  onClick={handleSaveChangesFromModal}
                  className="bg-red-600 hover:bg-red-700 text-white font-black text-sm px-6 py-3 rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  Confirmar y Guardar Cambios
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Results Console Board or Pending Action Alert */}
      <AnimatePresence mode="wait">
        {!isCalculated ? (
          <motion.div
            key="pending-calculation"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 bg-red-500/5 border border-dashed border-red-500/20 rounded-3xl p-8 text-center"
          >
            <Info className="w-10 h-10 text-red-600/70 mx-auto mb-3" />
            <h4 className="text-sm font-black text-gray-700 uppercase tracking-widest">
              Cálculo Pendiente de Ejecución
            </h4>
            <p className="text-xs sm:text-sm text-gray-500 mt-2 max-w-lg mx-auto leading-relaxed">
              Has realizado cambios en la receta del combo, los precios o las bandejas del mostrador. Haz clic en el botón <strong className="text-red-600 font-extrabold">🚀 CALCULAR COMBOS DISPONIBLES</strong> para procesar y actualizar los resultados.
            </p>
          </motion.div>
        ) : (
          calculation && (
            <motion.div
              key={`calc-result-${calculationTrigger}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="mt-6 border-t border-gray-150 pt-6"
            >
              <div className="bg-gradient-to-br from-gray-900 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-2xl border border-gray-850">
                
                <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Award className="w-6 h-6 text-red-500" />
                    <span className="text-xs font-black text-gray-400 tracking-wider uppercase font-mono">Consola de Resultados</span>
                  </div>
                  <span className="text-[11px] sm:text-xs font-mono text-green-400 bg-green-950/40 border border-green-900/60 px-3.5 py-1.5 rounded-xl font-black">
                    {comboRecipe.name ? `COMBO: ${comboRecipe.name.toUpperCase()}` : 'ANÁLISIS DE COMBO'}
                  </span>
                </div>

                {/* Central Combos Result Output */}
                <div className="text-center py-6 mb-4 flex flex-col items-center justify-center">
                  <span className="text-xs sm:text-sm text-gray-400 uppercase tracking-widest font-black">Combos Totales que Puedes Armar</span>
                  <div className="text-7xl md:text-8xl font-black text-green-400 font-mono tracking-tighter my-3.5 drop-shadow-[0_0_15px_rgba(74,222,128,0.3)] animate-pulse">
                    {calculation.maxCombos}
                  </div>
                  <span className="text-xs sm:text-sm text-gray-400 font-extrabold block mb-4">
                    Bandejas completas listas para despachar según el stock cargado
                  </span>

                  {calculation.maxCombos > 0 && (
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 w-full max-w-md mt-2 flex flex-col gap-3">
                      <span className="text-xs text-amber-400 font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
                        <Package className="w-4 h-4" />
                        ⚡ Registrar Despacho Real (Descontar del Mostrador)
                      </span>
                      <p className="text-[11px] text-gray-300 leading-snug">
                        Si preparaste y vendiste combos físicamente, elígelo abajo para descontar de inmediato las bandejas correspondientes de tu stock de mostrador.
                      </p>
                      
                      <div className="flex gap-2.5 items-center justify-center mt-1">
                        {calculation.maxCombos >= 1 && (
                          <button
                            type="button"
                            onClick={() => handleDispatchCombos(1)}
                            className="bg-red-600 hover:bg-red-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1"
                          >
                            <span>Despachar 1 Combo</span>
                          </button>
                        )}
                        {calculation.maxCombos > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDispatchCombos(calculation.maxCombos)}
                            className="bg-green-600 hover:bg-green-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1"
                          >
                            <span>Despachar Todo ({calculation.maxCombos})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Details and Bottleneck Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 text-left">
                  
                  {/* Recipe Composition Breakdown */}
                  <div className="bg-slate-800/40 rounded-2xl p-5 border border-slate-700/50">
                    <span className="text-xs font-black text-amber-400 tracking-wider uppercase block mb-4 font-mono">
                      Detalle de Receta de 1 Combo:
                    </span>
                    
                    {!Array.isArray(comboRecipe?.items) || comboRecipe.items.length === 0 ? (
                      <span className="text-sm text-gray-500 italic block">No hay cortes en la receta.</span>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {comboRecipe.items.filter(Boolean).map(item => {
                          const product = products.find(p => p.id === item.productId);
                          if (!product) return null;
                          const weightKg = item.requiredWeightGrams / 1000;
                          
                          let itemPrice = 0;
                          if (item.customPortionPrice !== undefined) {
                            itemPrice = item.customPortionPrice;
                          } else {
                            let pricePerKg = product.pricePerKg;
                            if (useBasePrices) {
                              const baseProduct = DEFAULT_PRODUCTS.find(bp => bp.id === item.productId);
                              if (baseProduct) {
                                pricePerKg = baseProduct.pricePerKg;
                              }
                            }
                            itemPrice = pricePerKg * weightKg;
                          }

                          return (
                            <div key={item.productId} className="flex items-center justify-between text-xs sm:text-sm border-b border-gray-800/60 pb-2.5 last:border-b-0 last:pb-0">
                              <div className="flex items-baseline gap-2 min-w-0">
                                <span className="font-extrabold text-gray-100 truncate">{product.name}</span>
                                <span className="text-xs text-gray-400 font-bold flex-shrink-0">({weightKg.toFixed(3)} kg)</span>
                              </div>
                              <div className="text-right font-mono text-xs sm:text-sm flex-shrink-0">
                                {globalCurrency === 'USD' ? (
                                  <>
                                    <span className="text-green-400 font-black">${itemPrice.toFixed(2)}</span>
                                    <span className="text-gray-500 mx-1">/</span>
                                    <span className="text-amber-400 font-black">{(itemPrice * exchangeRate).toFixed(2)} Bs.</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-green-400 font-black">{(itemPrice * exchangeRate).toFixed(2)} Bs.</span>
                                    <span className="text-gray-500 mx-1">/</span>
                                    <span className="text-amber-400 font-black">${itemPrice.toFixed(2)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-5 pt-3.5 border-t border-gray-800 flex justify-between items-center text-xs sm:text-sm">
                      <span className="text-gray-400 font-extrabold">Peso Neto de 1 Combo:</span>
                      <span className="font-black text-white font-mono">
                        {Array.isArray(comboRecipe?.items) ? comboRecipe.items.reduce((acc, item) => acc + ((item?.requiredWeightGrams || 0) / 1000), 0).toFixed(3) : '0.000'} kg
                      </span>
                    </div>

                    {calculation && calculation.maxCombos > 0 && (
                      <div className="mt-2.5 flex justify-between items-center text-xs sm:text-sm border-t border-slate-800 pt-2.5">
                        <span className="text-gray-400 font-extrabold">Total Carne Despachada ({calculation.maxCombos} combos):</span>
                        <span className="font-black text-green-400 font-mono text-sm">
                          {(Array.isArray(comboRecipe?.items) ? comboRecipe.items.reduce((acc, item) => acc + ((item?.requiredWeightGrams || 0) / 1000), 0) * calculation.maxCombos : 0).toFixed(2)} kg
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottleneck Analysis */}
                  <div className="flex flex-col justify-between bg-slate-800/40 rounded-2xl p-5 border border-slate-700/50">
                    <div>
                      <span className="text-xs font-black text-red-400 tracking-wider uppercase block mb-4 font-mono">
                        Análisis de Cuello de Botella:
                      </span>
                      
                      {calculation.maxCombos === 0 ? (
                        <div className="flex items-start gap-3 text-amber-400">
                          <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-sm font-black block">No es posible armar combos</span>
                            <p className="text-xs sm:text-sm text-gray-300 mt-1.5 leading-relaxed">
                              No tienes suficientes bandejas de todos los ingredientes incluidos en la receta del combo. Revisa qué ingredientes están en cero.
                            </p>
                          </div>
                        </div>
                      ) : calculation.limitingProductId ? (
                        (() => {
                          const limitingProduct = products.find(p => p.id === calculation.limitingProductId);
                          const limitingTrays = inventory[calculation.limitingProductId] || 0;
                          return (
                            <div className="flex items-start gap-3 text-red-400">
                              <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                              <div>
                                <span className="text-sm font-black block">Corte de Carne Limitante</span>
                                <p className="text-xs sm:text-sm text-gray-300 mt-1.5 leading-relaxed">
                                  El corte <span className="font-extrabold text-white">{limitingProduct?.name}</span> limita la producción. Si tuvieras más de este corte en mostrador, podrías armar más combos. Stock actual: <span className="font-bold text-white">{limitingTrays} bndj</span>.
                                </p>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="flex items-start gap-3 text-green-400">
                          <ShieldCheck className="w-6 h-6 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-sm font-black block">Bandejas Equilibradas</span>
                            <p className="text-xs sm:text-sm text-gray-300 mt-1.5 leading-relaxed">
                              ¡Buen control! Tienes la misma cantidad exacta de bandejas para todos los ingredientes de la receta.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Surplus Display */}
                    {calculation.maxCombos > 0 && (
                      <div className="mt-5 pt-3.5 border-t border-gray-800">
                        <span className="text-xs text-gray-400 uppercase font-mono font-black block mb-2">
                          Bandejas Excedentes (Sobrantes):
                        </span>
                        <div className="flex flex-wrap gap-2 max-h-16 overflow-y-auto pr-1">
                          {(Array.isArray(comboRecipe?.items) ? comboRecipe.items : []).map(item => {
                            const leftover = calculation.unusedTrays[item.productId] || 0;
                            if (leftover === 0) return null;
                            const product = products.find(p => p.id === item.productId);
                            return (
                              <span key={item.productId} className="text-xs bg-slate-800 text-gray-300 px-3 py-1 rounded-xl font-mono font-black border border-slate-700/50">
                                +{leftover} {product?.name?.split(' ')[0]}
                              </span>
                            );
                          })}
                          {Object.values(calculation.unusedTrays).every(v => v === 0) && (
                            <span className="text-xs text-gray-500 italic">No sobra ninguna bandeja.</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* Total Financial Values */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-gray-800 pt-5 mt-2">
                  <div className="bg-slate-800/20 p-4 md:p-5 rounded-2xl border border-slate-800/60">
                    <span className="text-xs text-gray-400 block font-black uppercase">Precio Unitario de 1 Combo</span>
                    <div className="flex items-baseline gap-2.5 mt-2 flex-wrap">
                      {globalCurrency === 'USD' ? (
                        <>
                          <span className="text-3xl font-black text-white font-mono">${calculation.singleComboPrice.toFixed(2)}</span>
                          <span className="text-sm text-amber-400 font-black font-mono">
                            ({(calculation.singleComboPrice * exchangeRate).toFixed(2)} Bs.)
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-3xl font-black text-white font-mono">{(calculation.singleComboPrice * exchangeRate).toFixed(2)} Bs.</span>
                          <span className="text-sm text-amber-400 font-black font-mono">
                            (${calculation.singleComboPrice.toFixed(2)})
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-800/20 p-4 md:p-5 rounded-2xl border border-slate-800/60">
                    <span className="text-xs text-gray-400 block font-black uppercase">Valorización Total ({calculation.maxCombos} combos)</span>
                    <div className="flex items-baseline gap-2.5 mt-2 flex-wrap">
                      {globalCurrency === 'USD' ? (
                        <>
                          <span className="text-3xl font-black text-green-400 font-mono">${calculation.totalCombosPrice.toFixed(2)}</span>
                          <span className="text-sm text-amber-400 font-black font-mono">
                            ({(calculation.totalCombosPrice * exchangeRate).toFixed(2)} Bs.)
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-3xl font-black text-green-400 font-mono">{(calculation.totalCombosPrice * exchangeRate).toFixed(2)} Bs.</span>
                          <span className="text-sm text-amber-400 font-black font-mono">
                            (${calculation.totalCombosPrice.toFixed(2)})
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 📋 SECCIÓN: REPORTE COMPLETO DE COMBOS PARA EL ADMINISTRADOR (VISTA DEL CARNICERO) */}
                <div className="mt-8 pt-6 border-t border-gray-800">
                  <div className="flex items-center gap-2.5 mb-4">
                    <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                    <h3 className="text-sm sm:text-base font-black text-amber-400 uppercase tracking-wider">
                      📋 Reporte de Simulación de Combos para el Administrador
                    </h3>
                  </div>

                  <p className="text-xs text-gray-300 mb-5 leading-relaxed">
                    Esta es la simulación completa de tu catálogo para el administrador. <strong className="text-white">No incluye el inventario crudo</strong> para mayor claridad de decisión, sino que detalla cada combo con sus ingredientes, capacidad de producción, cuellos de botella y alternativas según el sobrante.
                  </p>

                  {/* Simulations Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                    {getDetailedComboSimulations().map((sim, index) => {
                      const isZero = sim.maxYield === 0;
                      return (
                        <div 
                          key={`sim-${sim.recipe.name}-${index}`}
                          className={`rounded-2xl p-4 border transition-all ${
                            isZero 
                              ? 'bg-red-950/10 border-red-900/40 text-gray-450' 
                              : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600/60'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2.5 border-b border-slate-750 pb-2 flex-wrap gap-2">
                            <div className="min-w-0">
                              <span className="text-[9px] uppercase font-mono text-gray-500 font-extrabold block">Opción #{index+1}</span>
                              <h4 className="font-extrabold text-white text-xs sm:text-sm truncate">{sim.recipe.name}</h4>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono flex items-center gap-1.5 ${
                              isZero 
                                ? 'bg-red-950 text-red-400 border border-red-900/40' 
                                : 'bg-green-950 text-green-400 border border-green-900/40'
                            }`}>
                              {isZero ? '❌ 0 Combos' : `✅ ${sim.maxYield} Combos`}
                            </span>
                          </div>

                          {/* Ingredients list */}
                          <div className="mb-2.5">
                            <span className="text-[9px] text-gray-400 font-black uppercase block mb-1">Ingredientes:</span>
                            <div className="flex flex-wrap gap-1">
                              {sim.ingredients.map((ing, i) => (
                                <span 
                                  key={i} 
                                  className="text-[10px] bg-slate-900/50 text-gray-200 px-1.5 py-0.5 rounded-md border border-slate-750 font-medium"
                                >
                                  {ing.productName} ({ing.weightStr})
                                </span>
                              ))}
                            </div>
                          </div>

                          {!isZero ? (
                            <div className="space-y-1.5 text-xs text-gray-300">
                              {/* Bottleneck */}
                              {sim.bottleneckProduct && (
                                <div className="flex items-center gap-1 text-[11px] text-red-400">
                                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>Límite (Cuello de Botella): <strong className="text-white font-mono">{sim.bottleneckProduct}</strong></span>
                                </div>
                              )}

                              {/* Price and valuation */}
                              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-750 mt-1.5">
                                <div>
                                  <span className="text-[9px] text-gray-400 uppercase font-bold block">Precio Unitario:</span>
                                  <span className="font-black text-amber-300 font-mono text-[11px] sm:text-xs">
                                    ${sim.unitPrice.toFixed(2)} <span className="text-[9px] text-gray-400">({(sim.unitPrice * exchangeRate).toFixed(0)} Bs)</span>
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-gray-400 uppercase font-bold block">Valorización:</span>
                                  <span className="font-black text-green-400 font-mono text-[11px] sm:text-xs">
                                    ${sim.totalValuation.toFixed(2)} <span className="text-[9px] text-gray-400">({(sim.totalValuation * exchangeRate).toFixed(0)} Bs)</span>
                                  </span>
                                </div>
                              </div>

                              {/* Surplus trays */}
                              {(() => {
                                const surplusItems = sim.recipe.items
                                  .map(item => {
                                    const left = sim.unusedTrays[item.productId] || 0;
                                    if (left === 0) return null;
                                    const product = products.find(p => p.id === item.productId);
                                    return `${left} ${product?.name?.split(' ')[0] || item.productId}`;
                                  })
                                  .filter(Boolean);
                                
                                return surplusItems.length > 0 ? (
                                  <div className="pt-1 text-gray-400 text-[10px] leading-snug">
                                    <span className="font-bold text-gray-300">Sobrantes:</span> {surplusItems.join(', ')}
                                  </div>
                                ) : null;
                              })()}

                              {/* Alternative Yields */}
                              {sim.remainingYieldsIfSelected.some(alt => alt.yieldCount > 0) && (
                                <div className="mt-1.5 p-1.5 bg-indigo-950/20 border border-indigo-900/30 rounded-lg">
                                  <span className="text-[9px] text-indigo-300 font-black uppercase block mb-0.5">
                                    🔄 Si agotas este combo, todavía podrías armar:
                                  </span>
                                  <div className="space-y-0.5 text-[10px]">
                                    {sim.remainingYieldsIfSelected.map((alt, i) => {
                                      if (alt.yieldCount === 0) return null;
                                      return (
                                        <div key={i} className="flex justify-between text-gray-300">
                                          <span className="truncate max-w-[120px]">"{alt.otherRecipeName}"</span>
                                          <span className="text-indigo-300 font-bold font-mono">+{alt.yieldCount} combos</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[10px] text-red-400/80 flex items-center gap-1 mt-1.5">
                              <Info className="w-3 h-3 text-red-400/60 flex-shrink-0" />
                              <span>Faltan componentes en el stock</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Raw Text Preview */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 mb-4">
                    <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                      <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider">
                        📝 Vista del Mensaje a Enviar por WhatsApp / Copiar
                      </span>
                      <span className="text-[9px] text-green-400 bg-green-950/50 px-2 py-0.5 rounded border border-green-900/40 font-mono font-black">
                        ✓ Inventario oculto del reporte
                      </span>
                    </div>
                    <textarea
                      readOnly
                      rows={6}
                      value={getReportText()}
                      className="w-full bg-slate-900 text-gray-300 font-mono text-xs p-2.5 rounded-xl border border-slate-800 focus:outline-none focus:ring-0 leading-relaxed resize-none scrollbar-thin"
                    />
                  </div>
                </div>

                {/* Administrative Dispatch Actions (Print & Share via WhatsApp) */}
                <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row gap-4 print:hidden">
                  <button
                    type="button"
                    onClick={handlePrintReport}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black text-sm py-4 px-4.5 rounded-2xl border border-slate-700 shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Printer className="w-5 h-5 text-gray-300" />
                    <span>🖨️ IMPRIMIR REPORTE</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleCopyReport}
                    className={`flex-1 font-black text-sm py-4 px-4.5 rounded-2xl border shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                      copied 
                        ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600' 
                        : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-750'
                    }`}
                  >
                    <Copy className="w-5 h-5" />
                    <span>{copied ? '✓ REPORTE COPIADO' : '📋 COPIAR REPORTE'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black text-sm py-4 px-4.5 rounded-2xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5 fill-current text-white animate-bounce-horizontal" />
                    <span>💬 WHATSAPP AL ADMIN</span>
                  </button>
                </div>

              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* 4. Simulador Interactivo de Despacho, Combinaciones y Sobrantes */}
      <div id="simulador-multicombo" className="bg-white border-2 border-gray-200 rounded-3xl p-5 md:p-6 mb-6 shadow-sm mt-6 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-3 border-b border-gray-150">
          <div>
            <h2 className="text-base md:text-lg font-black text-gray-800 flex items-center gap-2 uppercase tracking-wider">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
              4. Simulador de Despacho y Combinaciones (Sobrantes)
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Simula armar varios combos diferentes al mismo tiempo para ver cuántas bandejas te sobran en el mostrador y qué otras opciones tienes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 self-end sm:self-auto">
            {isCalculated && calculation && calculation.maxCombos > 0 && (
              <button
                type="button"
                onClick={() => {
                  const activeName = comboRecipe.name.trim() || 'Receta Activa Personalizada';
                  setSimulatedQuantities({
                    [activeName]: calculation.maxCombos
                  });
                  setToast({
                    message: "Simulación Iniciada",
                    submessage: `Se cargó la producción máxima de "${activeName}" (${calculation.maxCombos} combos).`
                  });
                }}
                className="text-xs bg-red-50 hover:bg-red-100 text-red-700 border-2 border-red-200/50 font-black px-4 py-2.5 rounded-xl transition-all shadow-xs"
              >
                Simular Combo Actual Máx.
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSimulatedQuantities({});
                setToast({
                  message: "Simulación Reiniciada",
                  submessage: "Todas las cantidades simuladas de la orden volvieron a cero."
                });
              }}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold px-4 py-2.5 rounded-xl transition-all border border-gray-200/50"
            >
              Resetear
            </button>
          </div>
        </div>

        {(() => {
          const sim = getSimulatedResults();
          return (
            <div className="flex flex-col gap-6">
              
              {/* Scenario Explanation Card */}
              <div className="bg-amber-50/50 border-2 border-amber-200 rounded-2xl p-5 text-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <span className="font-black text-amber-900 uppercase tracking-wider text-xs">
                    Escenario de Producción y Sobrantes
                  </span>
                </div>

                {!sim.hasActiveSimulation ? (
                  <div className="text-amber-800 leading-relaxed">
                    <p className="font-extrabold text-sm mb-1.5 text-amber-950">
                      No has agregado ningún combo al lote de producción simulado.
                    </p>
                    <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                      Usa los botones de control <strong className="text-gray-800 font-black font-mono">(-) y (+)</strong> abajo en los tipos de combo para simular que un cliente se lleva 1, 2 o más combos diferentes, y ver cuántas bandejas quedan al final en el mostrador.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-amber-950 font-bold leading-relaxed text-sm sm:text-base">
                      Estás preparando un total de <span className="font-black text-amber-900 text-base font-mono bg-amber-100/80 px-3.5 py-1.5 rounded-xl border-2 border-amber-300/40 shadow-xs">{sim.totalSimulatedCombos}</span> combos en esta combinación de despacho:
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                      {/* Products used and how each combo works */}
                      <div className="bg-white p-4.5 rounded-xl border-2 border-amber-200 space-y-3 shadow-xs">
                        <span className="font-black text-xs text-amber-900 block uppercase tracking-wider border-b border-amber-100 pb-2">
                          Bandejas que se Sacan (Consumo):
                        </span>
                        <div className="space-y-2.5">
                          {products.map(p => {
                            const consumed = sim.consumption[p.id] || 0;
                            if (consumed === 0) return null;
                            const totalInStock = inventory[p.id] || 0;
                            const left = sim.leftovers[p.id] || 0;
                            return (
                              <div key={p.id} className="flex justify-between items-center text-xs sm:text-sm text-gray-700 border-b border-amber-100/40 pb-2 last:border-0 last:pb-0">
                                <span className="font-black text-gray-800">{p.name}:</span>
                                <span className="font-mono text-xs font-bold">
                                  <strong className="text-red-600 font-black bg-red-50 border border-red-200/50 px-2 py-0.5 rounded-md text-xs">-{consumed} bandejas</strong> de {totalInStock}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Alternate options with leftovers */}
                      <div className="bg-white p-4.5 rounded-xl border-2 border-amber-200 space-y-3 shadow-xs">
                        <span className="font-black text-xs text-amber-900 block uppercase tracking-wider border-b border-amber-100 pb-2">
                          ¿Qué otros combos se pueden hacer con lo que queda?:
                        </span>
                        <div className="space-y-2.5">
                          {uniqueAvailableRecipes.map((recipe, index) => {
                            const possible = sim.otherComboYields[recipe.name] || 0;
                            return (
                              <div key={index} className="flex justify-between items-center text-xs sm:text-sm text-gray-700 border-b border-amber-100/40 pb-2 last:border-0 last:pb-0">
                                <span className="font-bold text-gray-800 truncate max-w-[210px]">{recipe.name}:</span>
                                <span className={`font-mono text-xs font-black px-2.5 py-0.5 rounded-md ${possible > 0 ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-gray-100 text-gray-400'}`}>
                                  {possible > 0 ? `✅ Quedan para +${possible}` : '❌ No alcanza'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Combo Controls list */}
              <div className="space-y-4">
                <span className="text-xs font-black text-gray-500 uppercase tracking-widest block">
                  Define las Cantidades de cada Combo a Preparar
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
                  {uniqueAvailableRecipes.map((recipe, idx) => {
                    const currentSimQty = simulatedQuantities[recipe.name] || 0;
                    
                    // Composición desc
                    const compositionDesc = recipe.items.map(item => {
                      const prod = products.find(p => p.id === item.productId);
                      const weightStr = item.requiredWeightGrams === 500 ? '1/2 kg' : `${(item.requiredWeightGrams / 1000).toFixed(1).replace('.0', '')} kg`;
                      return `${prod?.name || item.productId} (${weightStr})`;
                    }).join(' + ');

                    // Max solo
                    const maxSolo = getPossibleYield(recipe);

                    // Check if they can afford another one
                    let canAffordAnother = true;
                    recipe.items.forEach(item => {
                      const available = inventory[item.productId] || 0;
                      const currentlyConsumed = sim.consumption[item.productId] || 0;
                      if (available - currentlyConsumed < 1) {
                        canAffordAnother = false;
                      }
                    });

                    return (
                      <div 
                        key={idx} 
                        className={`border-2 rounded-2xl p-5 transition-all flex flex-col justify-between ${
                          currentSimQty > 0 
                            ? 'bg-amber-50/20 border-amber-400 shadow-xs' 
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <span className="font-black text-xs sm:text-sm text-gray-950 leading-snug">
                              {recipe.name}
                            </span>
                            {currentSimQty > 0 && (
                              <span className="text-xs bg-amber-600 text-white font-black px-2.5 py-1 rounded-lg shrink-0">
                                {currentSimQty} u.
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-4">
                            {compositionDesc}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-150 pt-3.5 mt-auto">
                          <span className="text-xs font-black font-mono text-gray-400 uppercase">
                            Máx. Solo: {maxSolo}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDecrementSimulation(recipe.name)}
                              className="w-8 h-8 rounded-xl bg-gray-150 hover:bg-gray-250 text-gray-700 font-black flex items-center justify-center text-sm active:scale-90 transition-colors border border-gray-200 shadow-xs"
                              disabled={currentSimQty === 0}
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-black text-sm text-gray-800 font-mono">
                              {currentSimQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleIncrementSimulation(recipe)}
                              className={`w-8 h-8 rounded-xl font-black flex items-center justify-center text-sm active:scale-90 transition-colors shadow-xs ${
                                canAffordAnother 
                                  ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                              }`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          );
        })()}

        {/* Custom Confirm Dialog Overlay */}
        <AnimatePresence>
          {customConfirm?.isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-3xl p-6 max-w-md w-full border border-gray-150 shadow-2xl relative overflow-hidden text-left"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="p-2.5 bg-amber-100 text-amber-800 rounded-2xl flex-shrink-0">
                    <span className="text-xl">⚠️</span>
                  </span>
                  <h3 className="text-lg font-black text-amber-950 uppercase tracking-tight">{customConfirm.title}</h3>
                </div>
                <p className="text-sm text-gray-600 font-medium leading-relaxed mb-6">
                  {customConfirm.message}
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCustomConfirm(null)}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-extrabold transition-all active:scale-95"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={customConfirm.onConfirm}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-extrabold transition-all shadow-md active:scale-95"
                  >
                    Confirmar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Custom Prompt Dialog Overlay */}
        <AnimatePresence>
          {customPrompt?.isOpen && (
            <PromptDialog
              dialog={customPrompt}
              onClose={() => setCustomPrompt(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* 5. Clean, Professional Printable Report Sheet (Shown only on paper printout) */}
      <div className="hidden print:block text-black bg-white p-8 max-w-3xl mx-auto font-sans leading-relaxed text-sm">
        <div className="text-center border-b-2 border-black pb-5 mb-6">
          <h1 className="text-3xl font-black uppercase tracking-tight">🥩 REPORTE DE PRODUCCIÓN & OPTIMIZACIÓN DE COMBOS 🥩</h1>
          <p className="text-xs uppercase font-mono tracking-widest mt-2">SISTEMA INTERNO - ÁREA DE PRODUCTIVIDAD Y DESPACHOS</p>
          <div className="flex justify-between text-xs font-mono mt-4 max-w-md mx-auto">
            <span><strong>Fecha:</strong> {new Date().toLocaleDateString('es-VE')}</span>
            <span><strong>Hora:</strong> {new Date().toLocaleTimeString('es-VE')}</span>
            <span><strong>Tasa BCV:</strong> {exchangeRate.toFixed(2)} Bs./$</span>
          </div>
        </div>

        {/* Inventory Section */}
        <div className="mb-8">
          <h2 className="text-base font-black uppercase border-b-2 border-black pb-1.5 mb-3">📊 Estado del Mostrador (Bandejas Disponibles)</h2>
          <table className="w-full text-xs sm:text-sm font-mono text-left">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-2">Corte de Carne</th>
                <th className="py-2 text-right">Bandejas Disponibles</th>
                <th className="py-2 text-right">Precio de Lista (USD)</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const qty = inventory[p.id] || 0;
                return (
                  <tr key={p.id} className="border-b border-gray-350 last:border-0">
                    <td className="py-2 font-black">{p.name}</td>
                    <td className="py-2 text-right font-black text-sm">{qty} bandejas</td>
                    <td className="py-2 text-right font-extrabold">${p.pricePerKg.toFixed(2)} / kg</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Catalogue Simulation Yields */}
        <div className="mb-8">
          <h2 className="text-base font-black uppercase border-b-2 border-black pb-1.5 mb-3">🚀 Simulación de Producción de Catálogo (Todos los Combos)</h2>
          <p className="text-xs text-gray-700 mb-3 italic">Análisis en tiempo real de cuántas unidades se pueden armar de cada tipo registrado con las bandejas del mostrador actual:</p>
          <table className="w-full text-xs sm:text-sm text-left">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-2 text-left">Tipo de Combo</th>
                <th className="py-2 text-left">Composición / Contenido</th>
                <th className="py-2 text-right">Rendimiento Máximo</th>
              </tr>
            </thead>
            <tbody>
              {[
                ...systemPresets.filter(p => p && p.name && !hiddenSystemPresets.some(h => h.trim().toLowerCase() === p.name.trim().toLowerCase())),
                ...savedRecipes.filter(p => p && p.name)
              ].map((recipe, index) => {
                const yieldAmt = getPossibleYield(recipe);
                const desc = recipe.items.map(item => {
                  const prod = products.find(p => p.id === item.productId);
                  const weightStr = item.requiredWeightGrams === 500 ? '1/2 kg' : `${(item.requiredWeightGrams / 1000).toFixed(1).replace('.0', '')} kg`;
                  return `${prod?.name || item.productId} (${weightStr})`;
                }).join(' + ');
                return (
                  <tr key={index} className="border-b border-gray-250 last:border-0">
                    <td className="py-2 font-black">{recipe.name || 'Combo Sin Nombre'}</td>
                    <td className="py-2 text-xs text-gray-700 truncate max-w-sm">{desc}</td>
                    <td className="py-2 text-right font-black text-sm">
                      {yieldAmt > 0 ? `✅ ${yieldAmt} combos` : '❌ 0 combos'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detailed Selected/Active Combo */}
        {calculation && (
          <div className="border-2 border-black p-5 bg-gray-50/50 rounded-xl mb-8">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider block border-b-2 border-black pb-1.5 mb-3">🔥 Detalle del Combo Seleccionado para Preparar</h2>
            <div className="flex justify-between items-baseline mb-4 flex-wrap gap-2">
              <span className="text-lg font-black text-red-700">COMBO: {comboRecipe.name || 'Combo Personalizado'}</span>
              <span className="text-base font-black font-mono bg-black text-white px-3 py-1 rounded-lg">CANTIDAD AUTORIZADA: {calculation.maxCombos} combos</span>
            </div>

            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider mt-3.5 mb-2">Receta de Ingredientes (Por 1 unidad de combo):</h3>
            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
              {(Array.isArray(comboRecipe?.items) ? comboRecipe.items : []).map((item, idx) => {
                const prod = products.find(p => p.id === item.productId);
                const weightStr = item.requiredWeightGrams === 500 ? '1/2 kg' : `${(item.requiredWeightGrams / 1000).toFixed(1).replace('.0', '')} kg`;
                return (
                  <li key={idx} className="font-extrabold text-gray-800">
                    1 bandeja de <span className="text-black font-black">{prod?.name || item.productId}</span> (Peso Neto: {weightStr})
                  </li>
                );
              })}
            </ul>

            <div className="grid grid-cols-2 gap-5 mt-5 border-t border-dashed border-gray-400 pt-4">
              <div>
                <span className="text-xs uppercase font-black text-gray-500 block">Cuello de Botella / Limitante:</span>
                <span className="text-sm font-black font-mono">
                  {calculation.limitingProductId 
                    ? products.find(p => p.id === calculation.limitingProductId)?.name 
                    : 'Bandejas Equilibradas'}
                </span>
              </div>
              <div>
                <span className="text-xs uppercase font-black text-gray-500 block">Total Carne a Despachar:</span>
                <span className="text-sm font-black font-mono">
                  {((Array.isArray(comboRecipe?.items) ? comboRecipe.items.reduce((acc, item) => acc + (item.requiredWeightGrams / 1000), 0) : 0) * calculation.maxCombos).toFixed(2)} kg
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5 mt-4 border-t border-dashed border-gray-400 pt-4">
              <div>
                <span className="text-xs uppercase font-black text-gray-500 block">Precio Unitario de Venta:</span>
                <span className="text-base font-black font-mono text-gray-900">
                  ${calculation.singleComboPrice.toFixed(2)} USD / {(calculation.singleComboPrice * exchangeRate).toFixed(2)} Bs.
                </span>
              </div>
              <div>
                <span className="text-xs uppercase font-black text-gray-500 block">Valorización Total Autorizada:</span>
                <span className="text-base font-black font-mono text-green-700">
                  ${calculation.totalCombosPrice.toFixed(2)} USD / {(calculation.totalCombosPrice * exchangeRate).toFixed(2)} Bs.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Signature Area */}
        <div className="mt-20 pt-8 border-t border-gray-300 grid grid-cols-2 gap-8 text-center text-xs sm:text-sm">
          <div>
            <div className="w-56 border-b border-black mx-auto mb-2"></div>
            <p className="font-black text-gray-800">Preparado por / Firma Mostrador</p>
            <p className="text-xs text-gray-500 mt-0.5">Encargado de Preparación Física</p>
          </div>
          <div>
            <div className="w-56 border-b border-black mx-auto mb-2"></div>
            <p className="font-black text-gray-800">Autorizado por / Firma Administrador</p>
            <p className="text-xs text-gray-500 mt-0.5">Validación de Stock y Precios</p>
          </div>
        </div>
      </div>

    </div>
  );
}

interface PromptDialogProps {
  dialog: {
    isOpen: boolean;
    title: string;
    message: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (val: string) => void;
  };
  onClose: () => void;
}

function PromptDialog({ dialog, onClose }: PromptDialogProps) {
  const [val, setVal] = useState(dialog.defaultValue || '');
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl p-6 max-w-md w-full border border-gray-150 shadow-2xl relative overflow-hidden text-left"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="p-2.5 bg-red-100 text-red-600 rounded-2xl flex-shrink-0">
            <span className="text-xl">✍️</span>
          </span>
          <h3 className="text-lg font-black text-amber-950 uppercase tracking-tight">{dialog.title}</h3>
        </div>
        <p className="text-sm text-gray-650 font-medium leading-relaxed mb-4">
          {dialog.message}
        </p>
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={dialog.placeholder || "Escribe aquí..."}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-850 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 mb-6 text-sm"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && val.trim()) {
              dialog.onConfirm(val);
            }
          }}
        />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-extrabold transition-all active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!val.trim()}
            onClick={() => dialog.onConfirm(val)}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold transition-all shadow-md active:scale-95"
          >
            Aceptar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
