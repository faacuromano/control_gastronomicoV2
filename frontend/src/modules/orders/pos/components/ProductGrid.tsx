import React, { useState } from 'react';
import { useProducts } from '../hooks/useProducts';
import { ProductCard } from './ProductCard';
import { usePOSStore, type ModifierSelection } from '../../../../store/pos.store';
import { Loader2, Package, AlertCircle } from 'lucide-react';
import { ProductModifierModal } from './ProductModifierModal';
import { type Product } from '../../../../services/productService';
import { toast } from 'sonner';

interface ProductGridProps {
  activeCategoryId?: number;
  searchQuery?: string;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ activeCategoryId, searchQuery }) => {
  const { products, loading, error } = useProducts(activeCategoryId, true);
  const addToCart = usePOSStore((state) => state.addToCart);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Client-side filtering for search query
  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    return p.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleProductClick = (product: Product) => {
    const hasModifiers = (product.modifiers && product.modifiers.length > 0) ||
                         (product.ingredients && product.ingredients.length > 0);

    if (hasModifiers) {
      setSelectedProduct(product);
      setIsModalOpen(true);
    } else {
      addToCart(product);
      // Brief visual feedback
      toast.success(`${product.name} agregado`, { duration: 1500 });
    }
  };

  const handleModifierConfirm = (quantity: number, modifiers: ModifierSelection[], notes: string, removedIngredientIds: number[]) => {
    if (selectedProduct) {
      addToCart(selectedProduct, quantity, modifiers, notes, removedIngredientIds);
      toast.success(`${selectedProduct.name} agregado`, { duration: 1500 });
    }
  };

  // Loading State - Minimal
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      </div>
    );
  }

  // Empty State
  if (filteredProducts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {searchQuery
              ? `Sin resultados para "${searchQuery}"`
              : 'No hay productos'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Optimized Grid - 5 columns on large screens for maximum density */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onClick={() => handleProductClick(product)}
          />
        ))}
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
