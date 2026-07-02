/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { Scale, DollarSign, Calculator, RefreshCw, AlertCircle, ArrowUpDown } from 'lucide-react';
import { motion } from 'motion/react';

interface QuickCalculatorProps {
  products: Product[];
  selectedProduct: Product | null;
  onSelectProduct: (product: Product | null) => void;
  exchangeRate: number;
  globalCurrency: 'USD' | 'VES';
}

export default function QuickCalculator({
  products,
  selectedProduct,
  onSelectProduct,
  exchangeRate,
  globalCurrency
}: QuickCalculatorProps) {
  const [weight, setWeight] = useState<string>(''); // in kg
  const [money, setMoney] = useState<string>(''); // in active currency ($ or Bs.)
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'VES'>(globalCurrency);
  
  // Track which input was last edited to keep them in sync
  const [lastEdited, setLastEdited] = useState<'weight' | 'money'>('weight');

  // Sync with globalCurrency when it changes
  useEffect(() => {
    handleCurrencyModeChange(globalCurrency);
  }, [globalCurrency]);

  // Load selected product's default price or calculate whenever product/inputs change
  useEffect(() => {
    if (!selectedProduct) return;

    if (lastEdited === 'weight') {
      const wNum = parseFloat(weight);
      if (!isNaN(wNum) && wNum >= 0) {
        const calculatedMoneyUSD = wNum * selectedProduct.pricePerKg;
        if (currencyMode === 'USD') {
          setMoney(calculatedMoneyUSD.toFixed(2));
        } else {
          setMoney((calculatedMoneyUSD * exchangeRate).toFixed(2));
        }
      } else {
        setMoney('');
      }
    } else {
      const mNum = parseFloat(money);
      if (!isNaN(mNum) && mNum >= 0) {
        const calculatedMoneyUSD = currencyMode === 'USD' ? mNum : mNum / exchangeRate;
        const calculatedWeight = calculatedMoneyUSD / selectedProduct.pricePerKg;
        setWeight(calculatedWeight.toFixed(3));
      } else {
        setWeight('');
      }
    }
  }, [selectedProduct, weight, money, lastEdited, currencyMode, exchangeRate]);

  // Handle weight manual changes
  const handleWeightChange = (val: string) => {
    setWeight(val);
    setLastEdited('weight');
  };

  // Handle money manual changes
  const handleMoneyChange = (val: string) => {
    setMoney(val);
    setLastEdited('money');
  };

  // Handle currency mode changes
  const handleCurrencyModeChange = (mode: 'USD' | 'VES') => {
    if (mode === currencyMode) return;
    
    // Convert current money value in input to keep calculations synchronized
    const currentVal = parseFloat(money);
    if (!isNaN(currentVal) && currentVal >= 0) {
      if (mode === 'VES') {
        const newVal = currentVal * exchangeRate;
        setMoney(newVal.toFixed(2));
      } else {
        const newVal = currentVal / exchangeRate;
        setMoney(newVal.toFixed(2));
      }
    }
    setCurrencyMode(mode);
  };

  // Quick weight additions
  const addWeight = (amountGrams: number) => {
    setLastEdited('weight');
    const currentWeight = parseFloat(weight) || 0;
    const newWeight = Math.max(0, currentWeight + amountGrams / 1000);
    setWeight(newWeight.toFixed(3));
  };

  // Quick money additions
  const addMoney = (amount: number) => {
    setLastEdited('money');
    const currentMoney = parseFloat(money) || 0;
    const newMoney = Math.max(0, currentMoney + amount);
    setMoney(newMoney.toFixed(2));
  };

  // Reset calculator
  const handleReset = () => {
    setWeight('');
    setMoney('');
    setLastEdited('weight');
  };

  // Auto-focus and scroll to weight input when a product is selected
  useEffect(() => {
    if (selectedProduct) {
      const timer = setTimeout(() => {
        const element = document.getElementById('weight-input');
        if (element) {
          element.focus();
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedProduct]);

  // Helper calculations for final display
  const mNum = parseFloat(money) || 0;
  const usdAmount = currencyMode === 'USD' ? mNum : mNum / exchangeRate;
  const vesAmount = currencyMode === 'VES' ? mNum : mNum * exchangeRate;

  // Helper to format currency values beautifully with thousands separators and exactly 2 decimals
  const formatAmount = (val: number): string => {
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="bg-white rounded-3xl shadow-md border-2 border-gray-150 p-5 md:p-8" id="quick-calculator-section">
      <div className="mb-6 border-b border-gray-100 pb-5">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
          <span className="w-3.5 h-8 bg-green-600 rounded-full inline-block"></span>
          Calculadora de Peso y Dinero
        </h2>
        <p className="text-sm md:text-base text-gray-500 mt-1.5 font-medium">Conversión instantánea en tiempo de pesaje</p>
      </div>

      {/* Product selector dropdown if none or to change quickly */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2.5">Seleccionar Corte de Carne</label>
          <select
            id="product-calc-selector"
            value={selectedProduct?.id || ''}
            onChange={(e) => {
              const prod = products.find(p => p.id === e.target.value) || null;
              onSelectProduct(prod);
            }}
            className="w-full bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 rounded-2xl px-5 py-4 text-base md:text-lg font-black text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all shadow-sm"
          >
            <option value="" disabled>-- Seleccione un Producto del Mostrador --</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (${p.pricePerKg.toFixed(2)}/kg - {(p.pricePerKg * exchangeRate).toFixed(2)} Bs./kg)
              </option>
            ))}
          </select>
        </div>

        {selectedProduct ? (
          <div className="bg-green-50/50 border-2 border-green-150 rounded-2xl p-4 flex items-center justify-between animate-fadeIn">
            <div>
              <span className="text-xs sm:text-sm text-green-700 font-black uppercase tracking-wider">Corte Activo</span>
              <h3 className="font-black text-gray-950 text-lg md:text-xl leading-tight mt-1">{selectedProduct.name}</h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 block uppercase font-black tracking-wide">Precio Unitario</span>
              {globalCurrency === 'USD' ? (
                <>
                  <span className="text-2xl font-black text-green-700 font-mono">${selectedProduct.pricePerKg.toFixed(2)}<span className="text-sm font-semibold text-gray-500 font-sans">/kg</span></span>
                  <span className="block text-sm font-black text-amber-600 font-mono mt-0.5">{(selectedProduct.pricePerKg * exchangeRate).toFixed(2)} Bs.<span className="text-xs font-semibold text-gray-500 font-sans">/kg</span></span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-black text-green-700 font-mono">{(selectedProduct.pricePerKg * exchangeRate).toFixed(2)} Bs.<span className="text-sm font-semibold text-gray-500 font-sans">/kg</span></span>
                  <span className="block text-sm font-black text-amber-600 font-mono mt-0.5">${selectedProduct.pricePerKg.toFixed(2)}<span className="text-xs font-semibold text-gray-500 font-sans">/kg</span></span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-amber-600 shrink-0 animate-pulse" />
            <div>
              <span className="text-xs sm:text-sm text-amber-800 font-black uppercase tracking-wider">Báscula Inactiva</span>
              <p className="text-xs sm:text-sm text-amber-700 font-medium leading-tight mt-0.5">Por favor, seleccione un corte de carne para activar la calculadora y los campos de peso/dinero.</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Inputs Section */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Campo A: Calcular por Peso */}
          <div className="bg-gray-50/60 rounded-3xl p-5 md:p-6 border-2 border-gray-150">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-black text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <Scale className="w-5 h-5 text-green-600" />
                Campo A: Por Peso (Kilogramos)
              </span>
              <span className={`text-xs px-3 py-1.5 rounded-full font-black uppercase tracking-wider border ${
                selectedProduct 
                  ? 'text-green-700 bg-green-50 border-green-200' 
                  : 'text-gray-400 bg-gray-100 border-gray-200'
              }`}>Ingresa Peso</span>
            </div>
            
            <div className="relative">
              <input
                id="weight-input"
                type="number"
                step="0.001"
                min="0"
                placeholder="0.000"
                value={weight}
                disabled={!selectedProduct}
                onChange={(e) => handleWeightChange(e.target.value)}
                className={`w-full border-2 rounded-2xl py-5 pl-6 pr-20 text-4xl font-black focus:outline-none transition-all text-right font-mono ${
                  selectedProduct 
                    ? 'bg-white border-gray-300 focus:border-green-500 text-gray-900' 
                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              />
              <span className={`absolute right-6 top-6 text-2xl font-black font-mono ${selectedProduct ? 'text-gray-500' : 'text-gray-400'}`}>kg</span>
            </div>

            {/* Quick weight buttons (Large click targets) */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-5" id="quick-weight-buttons">
              <button
                type="button"
                disabled={!selectedProduct}
                onClick={() => addWeight(100)}
                className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm ${
                  selectedProduct 
                    ? 'bg-white hover:bg-green-50 active:scale-95 border-gray-200 hover:border-green-300 text-gray-700' 
                    : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                +100g
              </button>
              <button
                type="button"
                disabled={!selectedProduct}
                onClick={() => addWeight(250)}
                className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm ${
                  selectedProduct 
                    ? 'bg-white hover:bg-green-50 active:scale-95 border-gray-200 hover:border-green-300 text-gray-700' 
                    : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                +250g
              </button>
              <button
                type="button"
                disabled={!selectedProduct}
                onClick={() => addWeight(500)}
                className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm ${
                  selectedProduct 
                    ? 'bg-white hover:bg-green-50 active:scale-95 border-gray-200 hover:border-green-300 text-gray-700' 
                    : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                +500g
              </button>
              <button
                type="button"
                disabled={!selectedProduct}
                onClick={() => addWeight(1000)}
                className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm ${
                  selectedProduct 
                    ? 'bg-white hover:bg-green-50 active:scale-95 border-gray-200 hover:border-green-300 text-gray-700' 
                    : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                +1.0kg
              </button>
              <button
                type="button"
                disabled={!selectedProduct}
                onClick={() => addWeight(2000)}
                className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm hidden sm:block ${
                  selectedProduct 
                    ? 'bg-white hover:bg-green-50 active:scale-95 border-gray-200 hover:border-green-300 text-gray-700' 
                    : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                +2.0kg
              </button>
              <button
                type="button"
                disabled={!selectedProduct}
                onClick={() => {
                  setWeight('');
                  setLastEdited('weight');
                }}
                className={`rounded-2xl py-3.5 text-sm font-black border-2 transition-all shadow-sm col-span-1 ${
                  selectedProduct 
                    ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200/50' 
                    : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                Borrar
              </button>
            </div>
          </div>

          {/* Conversor icon connector */}
          <div className="flex justify-center -my-3.5 z-10">
            <div className={`rounded-full p-3 shadow-md border-4 border-white ${selectedProduct ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-500'}`}>
              <ArrowUpDown className="w-5.5 h-5.5" />
            </div>
          </div>

          {/* Campo B: Calcular por Dinero */}
          <div className="bg-gray-50/60 rounded-3xl p-5 md:p-6 border-2 border-gray-150">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
              <span className="text-sm font-black text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Campo B: Por Dinero ({currencyMode === 'USD' ? 'Dólares $' : 'Bolívares Bs.'})
              </span>
              <div className="flex items-center gap-2">
                <div className="flex bg-gray-200/80 p-0.5 rounded-xl border border-gray-300/40">
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => handleCurrencyModeChange('USD')}
                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                      !selectedProduct
                        ? 'opacity-50 cursor-not-allowed text-gray-400'
                        : currencyMode === 'USD'
                        ? 'bg-green-600 text-white shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    $ USD
                  </button>
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => handleCurrencyModeChange('VES')}
                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                      !selectedProduct
                        ? 'opacity-50 cursor-not-allowed text-gray-400'
                        : currencyMode === 'VES'
                        ? 'bg-amber-500 text-white shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Bs. VES
                  </button>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <span className={`absolute left-6 top-6 text-2xl font-black font-mono leading-none ${selectedProduct ? (currencyMode === 'USD' ? 'text-green-600' : 'text-amber-500') : 'text-gray-400'}`}>
                {currencyMode === 'USD' ? '$' : 'Bs.'}
              </span>
              <input
                id="money-input"
                type="number"
                step="1"
                min="0"
                placeholder="0.00"
                value={money}
                disabled={!selectedProduct}
                onChange={(e) => handleMoneyChange(e.target.value)}
                className={`w-full border-2 rounded-2xl py-5 pl-20 pr-6 text-4xl font-black focus:outline-none transition-all text-right font-mono ${
                  selectedProduct 
                    ? 'bg-white border-gray-300 focus:border-green-500 text-gray-900' 
                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              />
            </div>

            {/* Quick money buttons (Large click targets) */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-5" id="quick-money-buttons">
              {currencyMode === 'USD' ? (
                <>
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => addMoney(5)}
                    className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm ${
                      selectedProduct 
                        ? 'bg-white hover:bg-green-50 active:scale-95 border-gray-200 hover:border-green-300 text-gray-700' 
                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    +$5
                  </button>
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => addMoney(10)}
                    className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm ${
                      selectedProduct 
                        ? 'bg-white hover:bg-green-50 active:scale-95 border-gray-200 hover:border-green-300 text-gray-700' 
                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    +$10
                  </button>
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => addMoney(20)}
                    className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm ${
                      selectedProduct 
                        ? 'bg-white hover:bg-green-50 active:scale-95 border-gray-200 hover:border-green-300 text-gray-700' 
                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    +$20
                  </button>
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => addMoney(50)}
                    className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm ${
                      selectedProduct 
                        ? 'bg-white hover:bg-green-50 active:scale-95 border-gray-200 hover:border-green-300 text-gray-700' 
                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    +$50
                  </button>
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => addMoney(100)}
                    className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm hidden sm:block ${
                      selectedProduct 
                        ? 'bg-white hover:bg-green-50 active:scale-95 border-gray-200 hover:border-green-300 text-gray-700' 
                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    +$100
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => addMoney(100)}
                    className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm ${
                      selectedProduct 
                        ? 'bg-white hover:bg-amber-50 active:scale-95 border-gray-200 hover:border-amber-300 text-gray-700' 
                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    +100 Bs
                  </button>
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => addMoney(200)}
                    className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm ${
                      selectedProduct 
                        ? 'bg-white hover:bg-amber-50 active:scale-95 border-gray-200 hover:border-amber-300 text-gray-700' 
                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    +200 Bs
                  </button>
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => addMoney(500)}
                    className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm ${
                      selectedProduct 
                        ? 'bg-white hover:bg-amber-50 active:scale-95 border-gray-200 hover:border-amber-300 text-gray-700' 
                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    +500 Bs
                  </button>
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => addMoney(1000)}
                    className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm ${
                      selectedProduct 
                        ? 'bg-white hover:bg-amber-50 active:scale-95 border-gray-200 hover:border-amber-300 text-gray-700' 
                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    +1k Bs
                  </button>
                  <button
                    type="button"
                    disabled={!selectedProduct}
                    onClick={() => addMoney(2000)}
                    className={`border-2 rounded-2xl py-3.5 text-sm font-black transition-all shadow-sm hidden sm:block ${
                      selectedProduct 
                        ? 'bg-white hover:bg-amber-50 active:scale-95 border-gray-200 hover:border-amber-300 text-gray-700' 
                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    +2k Bs
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={!selectedProduct}
                onClick={() => {
                  setMoney('');
                  setLastEdited('money');
                }}
                className={`rounded-2xl py-3.5 text-sm font-black border-2 transition-all shadow-sm col-span-1 ${
                  selectedProduct 
                    ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200/50' 
                    : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                Borrar
              </button>
            </div>
          </div>
          
          {/* General Utilities */}
          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              disabled={!selectedProduct}
              onClick={handleReset}
              className={`px-5 py-3 rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-sm border ${
                selectedProduct 
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200 active:scale-95' 
                  : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
              }`}
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
              <span>Restablecer Calculadora</span>
            </button>
          </div>
        </div>

        {/* Scale Mockup Display (Craftsmanship & Premium Feel) */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div className="bg-gray-900 text-white rounded-3xl p-6 md:p-8 border-4 border-gray-800 shadow-2xl flex flex-col justify-between h-full min-h-[350px] relative overflow-hidden">
            {/* Decorative Scale Header */}
            <div className="flex justify-between items-center border-b border-gray-800 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${selectedProduct ? 'bg-green-500 animate-ping' : 'bg-gray-600'}`}></span>
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest font-mono">Báscula Digital Mostrador</span>
              </div>
              <div className={`text-[10px] sm:text-xs px-3 py-1 rounded-xl border font-mono font-black ${
                selectedProduct 
                  ? 'bg-red-950/40 text-red-400 border-red-900/40' 
                  : 'bg-gray-850 text-gray-500 border-gray-700/50'
              }`}>
                {selectedProduct ? 'BÁSCULA VIRTUAL' : 'SISTEMA INACTIVO'}
              </div>
            </div>

            {/* Product Label in scale */}
            <div className="mb-6">
              <span className="text-xs text-gray-400 uppercase font-black font-mono block mb-1">Producto seleccionado</span>
              {selectedProduct ? (
                <>
                  <div className="text-xl md:text-2xl font-black tracking-tight text-white whitespace-normal break-words leading-tight">{selectedProduct.name}</div>
                  <div className="text-xs sm:text-sm text-gray-400 font-mono mt-1 leading-relaxed">
                    Precio de corte: <span className="text-white font-black">${selectedProduct.pricePerKg.toFixed(2)}/kg</span> ({(selectedProduct.pricePerKg * exchangeRate).toFixed(2)} Bs./kg)
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xl md:text-2xl font-black tracking-tight text-gray-500 italic">Ningún corte seleccionado</div>
                  <div className="text-xs sm:text-sm text-gray-500 font-mono mt-1 leading-relaxed">
                    Esperando selección de producto...
                  </div>
                </>
              )}
            </div>

            {/* Glowing Weight Output */}
            <div className="mb-6">
              <span className="text-xs text-gray-400 uppercase font-black font-mono block mb-1">Peso en Bandeja</span>
              <div className="flex items-baseline justify-between">
                <div className={`text-5xl md:text-6xl font-black font-mono tracking-wider ${
                  selectedProduct && parseFloat(weight) 
                    ? 'text-green-400 glow-green' 
                    : 'text-gray-750'
                }`}>
                  {selectedProduct && parseFloat(weight) ? parseFloat(weight).toFixed(3) : "0.000"}
                </div>
                <span className="text-xl md:text-2xl font-black text-gray-500 font-mono">KG</span>
              </div>
            </div>

            {/* Glowing Money Output */}
            <div className="mt-auto pt-5 border-t-2 border-gray-800">
              <span className="text-xs text-gray-400 uppercase font-black font-mono block mb-1">Total a Cobrar</span>
              
              {currencyMode === 'USD' ? (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 mb-2">
                    <div className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black font-mono tracking-tight break-all ${
                      selectedProduct && usdAmount 
                        ? 'text-green-400 glow-green' 
                        : 'text-gray-750'
                    }`}>
                      ${selectedProduct && usdAmount ? formatAmount(usdAmount) : "0.00"}
                    </div>
                    <span className="text-sm sm:text-base md:text-lg font-black text-gray-400 font-sans tracking-wider shrink-0">USD</span>
                  </div>

                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-t border-gray-800/60 pt-3">
                    <div className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black font-mono tracking-normal break-all ${
                      selectedProduct && vesAmount 
                        ? 'text-amber-400' 
                        : 'text-gray-750'
                    }`}>
                      {selectedProduct && vesAmount ? formatAmount(vesAmount) : "0.00"}
                    </div>
                    <span className="text-xs sm:text-sm md:text-base font-black text-gray-400 font-sans tracking-wider shrink-0">Bs. (VES)</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 mb-2">
                    <div className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black font-mono tracking-tight break-all ${
                      selectedProduct && vesAmount 
                        ? 'text-green-400 glow-green' 
                        : 'text-gray-750'
                    }`}>
                      {selectedProduct && vesAmount ? formatAmount(vesAmount) : "0.00"}
                    </div>
                    <span className="text-sm sm:text-base md:text-lg font-black text-gray-400 font-sans tracking-wider shrink-0">Bs. (VES)</span>
                  </div>

                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-t border-gray-800/60 pt-3">
                    <div className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black font-mono tracking-normal break-all ${
                      selectedProduct && usdAmount 
                        ? 'text-amber-400' 
                        : 'text-gray-750'
                    }`}>
                      ${selectedProduct && usdAmount ? formatAmount(usdAmount) : "0.00"}
                    </div>
                    <span className="text-xs sm:text-sm md:text-base font-black text-gray-400 font-sans tracking-wider shrink-0">USD</span>
                  </div>
                </>
              )}
            </div>

            {/* Glowing effect inside scale css details */}
            {selectedProduct && (
              <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-green-500/10 rounded-full blur-3xl pointer-events-none"></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
