/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, ComboConfig } from './types';

export const DEFAULT_PRODUCTS: Product[] = [
  { id: 'hueso_redondo', name: 'Hueso Redondo', pricePerKg: 7.00, category: 'Res' },
  { id: 'queso', name: 'Queso', pricePerKg: 4.70, category: 'Charcutería' },
  { id: 'carne_molida', name: 'Carne Molida', pricePerKg: 10.00, category: 'Res' },
  { id: 'lomito_y_pulpa', name: 'Lomito y Pulpa', pricePerKg: 11.50, category: 'Res' },
  { id: 'alas', name: 'Alas', pricePerKg: 4.00, category: 'Pollo' },
  { id: 'cochino', name: 'Cochino', pricePerKg: 5.50, category: 'Cerdo' },
  { id: 'chuleta_de_res', name: 'Chuleta de Res', pricePerKg: 9.70, category: 'Res' },
  { id: 'costillas_de_res', name: 'Costillas de Res', pricePerKg: 6.00, category: 'Res' },
  { id: 'yogurt_160gr', name: 'Yogurt 160gr', pricePerKg: 2.00, category: 'Charcutería' },
  { id: 'doritos', name: 'Doritos', pricePerKg: 1.50, category: 'Víveres' },
  { id: 'cheestres', name: 'CheesTris', pricePerKg: 1.50, category: 'Víveres' },
  { id: 'cocacola_1_25l', name: 'Coca-Cola 1.25 Lts', pricePerKg: 1.00, category: 'Bebidas' },
  { id: 'cocacola_2l', name: 'Coca-Cola 2 Lts', pricePerKg: 1.70, category: 'Bebidas' },
  { id: 'fanta_1l', name: 'Fanta 1 Lts', pricePerKg: 0.90, category: 'Bebidas' },
  { id: 'muslos', name: 'Muslos', pricePerKg: 4.80, category: 'Pollo' },
  { id: 'pechuga', name: 'Pechuga', pricePerKg: 5.80, category: 'Pollo' },
  { id: 'milanesa', name: 'Milanesa', pricePerKg: 8.00, category: 'Pollo' },
  { id: 'agua_nevada_335ml', name: 'Agua Nevada 335 mL', pricePerKg: 0.80, category: 'Bebidas' },
  { id: 'cocacola_335ml', name: 'Coca-Cola 335 mL', pricePerKg: 1.00, category: 'Bebidas' },
  { id: 'medio_carton_huevo', name: '1/2 Cartón de Huevo', pricePerKg: 4.00, category: 'Víveres' },
  { id: 'carton_huevo', name: 'Cartón de Huevo', pricePerKg: 8.00, category: 'Víveres' },
  { id: 'helado_yogurt', name: 'Helado de Yogurt', pricePerKg: 0.50, category: 'Charcutería' },
  { id: 'masa_pastel', name: 'Masa de Pastel', pricePerKg: 2.70, category: 'Víveres' },
  { id: 'pollo_entero', name: 'Pollo Entero', pricePerKg: 4.80, category: 'Pollo' },
  { id: 'platanitos_tom', name: 'Platanitos (Tom)', pricePerKg: 1.50, category: 'Víveres' },
  { id: 'carne', name: 'Carne', pricePerKg: 10.00, category: 'Res' },
  { id: 'yogurt_medio_kg', name: 'Yogurt 1/2 kg', pricePerKg: 6.00, category: 'Charcutería' },
  { id: 'yogurt_1kg', name: 'Yogurt 1 kg', pricePerKg: 12.00, category: 'Charcutería' },
  { id: 'tostones', name: 'Tostones', pricePerKg: 1.50, category: 'Víveres' }
];

export const DEFAULT_COMBO_CONFIG: ComboConfig = {
  items: [
    { productId: 'carne_molida', requiredWeightGrams: 500 }, // 500g Carne Molida (medio kilo por defecto)
    { productId: 'muslos', requiredWeightGrams: 1000 },      // 1000g Muslos
    { productId: 'chuleta_de_res', requiredWeightGrams: 1000 } // 1000g Chuleta de Res
  ]
};
