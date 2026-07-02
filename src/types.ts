/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  pricePerKg: number;
  category: 'Res' | 'Cerdo' | 'Pollo' | 'Charcutería' | 'Bebidas' | 'Víveres';
}

export interface ComboItem {
  productId: string;
  requiredWeightGrams: number; // e.g. 800g for Bistec
}

export interface ComboConfig {
  items: ComboItem[];
  customPrice?: number; // Optional custom fixed combo price. If not set, it calculates sum of items.
}

export interface InventoryTrays {
  [productId: string]: number; // Number of ready-to-sell trays in stock
}

export interface CalculationResult {
  maxCombos: number;
  limitingProductId: string | null;
  singleComboPrice: number;
  totalCombosPrice: number;
  unusedTrays: { [productId: string]: number };
}
