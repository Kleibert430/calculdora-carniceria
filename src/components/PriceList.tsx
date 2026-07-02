/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Product } from '../types';
import { Search, Plus, Trash2, Edit2, Check, Scale, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PriceListProps {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
  onSelectForCalculation: (product: Product) => void;
  onResetToDefault: () => void;
  exchangeRate: number;
  globalCurrency: 'USD' | 'VES';
}

export default function PriceList({
  products,
  onUpdateProducts,
  onSelectForCalculation,
  onResetToDefault,
  exchangeRate,
  globalCurrency
}: PriceListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states for new product
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState<Product['category']>('Res');

  // Edit states for modifying the whole product
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPrice, setEditingPrice] = useState('');
  const [editingCategory, setEditingCategory] = useState<Product['category']>('Res');

  // Custom non-blocking confirmation dialog state for multi-device compatibility
  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handleStartEdit = (product: Product) => {
    setEditingProduct(product);
    setEditingName(product.name);
    setEditingPrice(product.pricePerKg.toString());
    setEditingCategory(product.category);
  };

  const handleSaveEditedProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    const priceNum = parseFloat(editingPrice);
    if (isNaN(priceNum) || priceNum < 0) return;

    const updated = products.map(p => {
      if (p.id === editingProduct.id) {
        return {
          ...p,
          name: editingName.trim(),
          pricePerKg: priceNum,
          category: editingCategory
        };
      }
      return p;
    });

    onUpdateProducts(updated);
    setEditingProduct(null);
  };

  const isWeighable = (product: Product) => {
    return ['Res', 'Cerdo', 'Pollo', 'Charcutería'].includes(product.category);
  };

  // Filter and sort products (weighable first, non-weighable second)
  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const aWeigh = isWeighable(a) ? 1 : 0;
      const bWeigh = isWeighable(b) ? 1 : 0;
      return bWeigh - aWeigh; // 1 (weighable) goes before 0 (non-weighable)
    });

  // Handle inline price change
  const handlePriceChange = (id: string, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;
    
    const updated = products.map(p => {
      if (p.id === id) {
        return { ...p, pricePerKg: numValue };
      }
      return p;
    });
    onUpdateProducts(updated);
  };

  // Add new product
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPrice) return;

    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    const newProduct: Product = {
      id: 'custom_' + Date.now(),
      name: newName.trim(),
      pricePerKg: priceNum,
      category: newCategory
    };

    onUpdateProducts([...products, newProduct]);
    setNewName('');
    setNewPrice('');
    setShowAddForm(false);
  };

  // Delete product
  const handleDeleteProduct = (id: string) => {
    const productToDelete = products.find(p => p.id === id);
    const productName = productToDelete ? `"${productToDelete.name}"` : 'este producto';
    
    setCustomConfirm({
      isOpen: true,
      title: "Eliminar Producto",
      message: `¿Está seguro de que desea eliminar ${productName}? Se quitará también de cualquier combo activo del catálogo.`,
      onConfirm: () => {
        onUpdateProducts(products.filter(p => p.id !== id));
        setCustomConfirm(null);
      }
    });
  };

  const categories: ('Todos' | Product['category'])[] = ['Todos', 'Res', 'Cerdo', 'Pollo', 'Charcutería', 'Bebidas', 'Víveres'];

  const categoryColors: Record<Product['category'], string> = {
    Res: 'bg-red-50 text-red-700 border-red-200',
    Cerdo: 'bg-orange-50 text-orange-700 border-orange-200',
    Pollo: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    Charcutería: 'bg-pink-50 text-pink-700 border-pink-200',
    Bebidas: 'bg-blue-50 text-blue-700 border-blue-200',
    Víveres: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };

  const categoryLabels: Record<string, string> = {
    Todos: 'Todos',
    Res: 'Res',
    Cerdo: 'Cerdo',
    Pollo: 'Pollo',
    Charcutería: 'Charcutería y Lácteos',
    Bebidas: 'Bebidas y Snacks',
    Víveres: 'Víveres'
  };

  return (
    <div className="bg-white rounded-3xl shadow-md border-2 border-gray-150 p-5 md:p-8" id="product-management-section">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-8 border-b border-gray-100 pb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <span className="w-3.5 h-8 bg-red-600 rounded-full inline-block"></span>
            Gestión y Consulta de Precios
          </h2>
          <p className="text-sm md:text-base text-gray-500 mt-1.5 font-medium">Consulta de precios en tiempo real y edición de mostrador</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="toggle-edit-mode-btn"
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-5 py-3 rounded-2xl font-black text-sm md:text-base flex items-center gap-2 transition-all shadow-md active:scale-95 ${
              isEditMode
                ? 'bg-green-600 text-white hover:bg-green-700 hover:shadow'
                : 'bg-red-50 text-red-700 border-2 border-red-200/60 hover:bg-red-100'
            }`}
          >
            {isEditMode ? (
              <>
                <Check className="w-5 h-5" />
                <span>Terminar Edición</span>
              </>
            ) : (
              <>
                <Edit2 className="w-5 h-5" />
                <span>Editar Precios</span>
              </>
            )}
          </button>

          <button
            id="toggle-add-form-btn"
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-red-600 text-white hover:bg-red-700 px-5 py-3 rounded-2xl font-black text-sm md:text-base flex items-center gap-2 transition-all shadow-md hover:shadow active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Quick Add Product Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form
            id="add-product-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6 bg-gray-50 rounded-xl p-4 border border-gray-200"
            onSubmit={handleAddProduct}
          >
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-red-600" /> Registrar Nuevo Producto en Mostrador
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nombre del corte</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pulpa de Res, Tocino..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Precio por Kilogramo ($/kg)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Categoría</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as Product['category'])}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="Res">Res</option>
                  <option value="Cerdo">Cerdo</option>
                  <option value="Pollo">Pollo</option>
                  <option value="Charcutería">Charcutería y Lácteos</option>
                  <option value="Bebidas">Bebidas y Snacks</option>
                  <option value="Víveres">Víveres</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Agregar Producto
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-4 h-5.5 w-5.5 text-gray-400" />
          <input
            id="product-search-input"
            type="text"
            placeholder="Buscar carne o producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl pl-12 pr-4 py-4 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-4 text-sm text-gray-500 hover:text-gray-800 font-black"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Category quick selectors */}
        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none" id="category-filter-bar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2.5 rounded-xl text-sm font-black whitespace-nowrap border-2 transition-all ${
                selectedCategory === cat
                  ? 'bg-red-600 text-white border-red-600 shadow-md'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {categoryLabels[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main product representation */}
      <div className="overflow-hidden border-2 border-gray-150 rounded-2xl">
        {filteredProducts.length === 0 ? (
          <div className="py-14 text-center bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
            <Scale className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 text-base font-black">No se encontraron productos</p>
            <p className="text-gray-500 text-sm mt-1">Intenta otra búsqueda o agrega un nuevo producto</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <table className="w-full text-left border-collapse hidden md:table">
              <thead>
                <tr className="bg-gray-50/75 border-b-2 border-gray-150 text-sm font-black text-gray-700 uppercase tracking-wider">
                  <th className="px-6 py-4">Categoría</th>
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4 text-right">Precio por kg ($/kg)</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-100">
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-gray-50/40 transition-colors group"
                  >
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 uppercase tracking-wider ${categoryColors[product.category]}`}>
                        {categoryLabels[product.category] || product.category}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-black text-gray-900 text-lg">{product.name}</div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {isEditMode ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-gray-500 text-base font-bold">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={product.pricePerKg}
                            onChange={(e) => handlePriceChange(product.id, e.target.value)}
                            className="w-28 text-right bg-white border-2 border-gray-300 rounded-xl px-3 py-1.5 text-base font-black focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      ) : (
                        <div className="text-right">
                          {globalCurrency === 'USD' ? (
                            <>
                              <div className="text-xl font-black text-green-600 font-mono">${product.pricePerKg.toFixed(2)}</div>
                              <div className="text-sm text-amber-600 font-mono font-black mt-1">{(product.pricePerKg * exchangeRate).toFixed(2)} Bs.</div>
                            </>
                          ) : (
                            <>
                              <div className="text-xl font-black text-green-600 font-mono">{(product.pricePerKg * exchangeRate).toFixed(2)} Bs.</div>
                              <div className="text-sm text-amber-600 font-mono font-black mt-1">${product.pricePerKg.toFixed(2)}</div>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-3">
                        {isWeighable(product) && (
                          <button
                            title="Cargar en la calculadora de peso"
                            onClick={() => onSelectForCalculation(product)}
                            className="bg-green-50 text-green-700 hover:bg-green-600 hover:text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all border-2 border-green-200 hover:border-green-600 shadow-sm active:scale-95"
                          >
                            <Scale className="w-4.5 h-4.5" />
                            <span>Pesar / Cotizar</span>
                          </button>
                        )}

                        <button
                          title="Editar producto completo"
                          onClick={() => handleStartEdit(product)}
                          className="p-2.5 text-blue-600 hover:text-blue-700 rounded-xl hover:bg-blue-50 transition-colors border-2 border-transparent hover:border-blue-100 active:scale-95"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>

                        <button
                          title="Eliminar producto"
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-2.5 text-gray-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors border-2 border-transparent hover:border-red-100 active:scale-95"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Cards View (Much better for counter use in mobile devices) */}
            <div className="md:hidden divide-y divide-gray-150">
              {filteredProducts.map((product) => (
                <div key={product.id} className="p-5 bg-white hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-black border uppercase tracking-widest inline-block mb-2 ${categoryColors[product.category]}`}>
                        {categoryLabels[product.category] || product.category}
                      </span>
                      <h4 className="font-black text-gray-900 text-lg md:text-xl leading-snug">{product.name}</h4>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(product)}
                        className="p-2 text-blue-600 hover:text-blue-700 active:scale-95"
                        title="Editar producto"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 text-gray-400 hover:text-red-600 active:scale-95"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <div>
                      <span className="text-xs text-gray-500 font-bold block mb-1">Precio por Kilogramo</span>
                      {isEditMode ? (
                        <div className="flex items-center gap-1.5 bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-1">
                          <span className="text-gray-500 text-xs font-bold">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={product.pricePerKg}
                            onChange={(e) => handlePriceChange(product.id, e.target.value)}
                            className="w-24 bg-transparent text-right font-black text-gray-900 text-sm md:text-base focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div>
                          {globalCurrency === 'USD' ? (
                            <>
                              <span className="text-xl font-black text-green-600 font-mono">${product.pricePerKg.toFixed(2)} <span className="text-xs text-gray-500 font-bold">/kg</span></span>
                              <span className="block text-sm text-amber-600 font-mono font-black mt-0.5">{(product.pricePerKg * exchangeRate).toFixed(2)} Bs. <span className="text-[10px] text-gray-500 font-bold">/kg</span></span>
                            </>
                          ) : (
                            <>
                              <span className="text-xl font-black text-green-600 font-mono">{(product.pricePerKg * exchangeRate).toFixed(2)} Bs. <span className="text-xs text-gray-500 font-bold">/kg</span></span>
                              <span className="block text-sm text-amber-600 font-mono font-black mt-0.5">${product.pricePerKg.toFixed(2)} <span className="text-[10px] text-gray-500 font-bold">/kg</span></span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {isWeighable(product) && (
                      <button
                        onClick={() => onSelectForCalculation(product)}
                        className="bg-green-600 hover:bg-green-700 active:scale-95 text-white font-black text-xs sm:text-sm py-3 px-4 rounded-xl flex items-center gap-2 transition-all shadow-md"
                      >
                        <Scale className="w-4.5 h-4.5" />
                        <span>Calcular</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Database/App Reset footer */}
      <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4 pt-5 border-t-2 border-gray-150 text-xs sm:text-sm text-gray-500 font-bold">
        <span>Mostrando {filteredProducts.length} cortes disponibles</span>
        <button
          onClick={() => {
            setCustomConfirm({
              isOpen: true,
              title: "Restablecer Valores de Fábrica",
              message: "¿Está seguro de que desea restablecer todos los precios de los productos y la configuración de combos a los valores por defecto? Se perderán las personalizaciones actuales.",
              onConfirm: () => {
                onResetToDefault();
                setCustomConfirm(null);
              }
            });
          }}
          className="text-gray-500 hover:text-red-600 font-black transition-colors flex items-center gap-1.5 active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Restablecer Valores de Fábrica</span>
        </button>
      </div>

      {/* Edit Product Modal Overlay */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl border-2 border-gray-150 p-6 md:p-8"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-150">
                <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <Edit2 className="w-6 h-6 text-red-600" />
                  Editar Producto
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-800 transition-all active:scale-90"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveEditedProduct} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-600 uppercase tracking-wider mb-1.5">Nombre del Producto</label>
                  <input
                    type="text"
                    required
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-base font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-600 uppercase tracking-wider mb-1.5">Precio por Kilogramo ($/kg)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-gray-400 font-black text-base">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={editingPrice}
                      onChange={(e) => setEditingPrice(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl pl-8 pr-4 py-3 text-base font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-600 uppercase tracking-wider mb-1.5">Categoría</label>
                  <select
                    value={editingCategory}
                    onChange={(e) => setEditingCategory(e.target.value as Product['category'])}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-base font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  >
                    <option value="Res">Res</option>
                    <option value="Cerdo">Cerdo</option>
                    <option value="Pollo">Pollo</option>
                    <option value="Charcutería">Charcutería y Lácteos</option>
                    <option value="Bebidas">Bebidas y Snacks</option>
                    <option value="Víveres">Víveres</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-5 py-2.5 rounded-xl text-sm font-black text-gray-700 hover:bg-gray-100 transition-all border-2 border-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 active:scale-95 text-white px-6 py-2.5 rounded-xl text-sm font-black transition-all shadow-md"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
    </div>
  );
}
