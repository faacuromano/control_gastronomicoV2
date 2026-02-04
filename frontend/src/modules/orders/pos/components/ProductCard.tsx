
import React from 'react';
import { type Product } from '../../../../services/productService';
import { Settings2 } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const hasModifiers = (product.modifiers && product.modifiers.length > 0) ||
                       (product.ingredients && product.ingredients.length > 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group relative w-full text-left
        bg-card rounded-lg border border-border
        p-2 cursor-pointer
        hover:border-primary hover:shadow-md
        transition-all duration-150
        flex flex-col
        active:scale-[0.98] active:bg-primary/5
        focus:outline-none focus:ring-2 focus:ring-primary/50
      "
    >
      {/* Image Container - Compact */}
      <div className="relative w-full aspect-[4/3] bg-muted rounded-md mb-2 overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <span className="text-3xl font-bold text-muted-foreground/40 select-none">
              {product.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Modifier Indicator - Subtle */}
        {hasModifiers && (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
            <Settings2 size={10} className="text-white" />
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 flex flex-col justify-between min-h-[48px]">
        <h3 className="font-medium text-foreground text-sm leading-tight line-clamp-2 mb-1">
          {product.name}
        </h3>
        <p className="font-mono font-bold text-primary text-base">
          ${Number(product.price).toFixed(2)}
        </p>
      </div>
    </button>
  );
};
