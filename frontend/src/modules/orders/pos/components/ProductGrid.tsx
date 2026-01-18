import React, { useState } from 'react';
import { useProducts } from '../hooks/useProducts';
import { ProductCard } from './ProductCard';
import { usePOSStore } from '../../../../store/pos.store';
import { Loader2 } from 'lucide-react';
import { ProductModifierModal } from './ProductModifierModal';
import { type Product } from '../../../../services/productService';

interface ProductGridProps {
  activeCategoryId?: number;
  searchQuery?: string;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ activeCategoryId, searchQuery }) => {
  const { products, loading, error } = useProducts(activeCategoryId, true);
  const addToCart = usePOSStore((state) => state.addToCart);
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Client-side filtering for search query (if API doesn't support it yet)
  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    return p.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleProductClick = (product: Product) => {
      // Check if product has active modifier groups OR keys ingredients that can be removed
      const hasModifiers = (product.modifiers && product.modifiers.length > 0) || (product.ingredients && product.ingredients.length > 0);
      
      if (hasModifiers) {
          setSelectedProduct(product);
          setIsModalOpen(true);
      } else {
          addToCart(product);
      }
  };

  const handleModifierConfirm = (quantity: number, modifiers: any[], notes: string, removedIngredientIds: number[]) => {
      if (selectedProduct) {
          addToCart(selectedProduct, quantity, modifiers, notes, removedIngredientIds);
      }
  };

  if (loading) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
    );
  }

  if (error) {
    return (
        <div className="flex h-full items-center justify-center text-red-500">
            {error}
        </div>
    );
  }

  return (
    <>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-1">
        {filteredProducts.map((product) => (
            <ProductCard 
                key={product.id} 
                product={product} 
                onClick={() => handleProductClick(product)} 
            />
        ))}
        {filteredProducts.length === 0 && (
            <div className="col-span-full h-40 flex items-center justify-center text-slate-400">
                No products found.
            </div>
        )}
        </div>

        <ProductModifierModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            product={selectedProduct}
            onConfirm={handleModifierConfirm}
        />
    </>
  );
};
