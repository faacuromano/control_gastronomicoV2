
import React from 'react';
import { type Product } from '../../../../services/productService';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  return (
    <div 
        onClick={onClick}
        className="bg-white rounded-xl shadow-sm border border-slate-100 p-2 cursor-pointer hover:shadow-md hover:border-indigo-100 transition-all active:scale-95 flex flex-col items-center h-full"
    >
      <div className="w-full aspect-square bg-slate-100 rounded-lg mb-3 overflow-hidden relative">
        {product.image ? (
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-3xl select-none">
                {product.name.charAt(0)}
            </div>
        )}
        <div className="absolute bottom-1 right-1 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-bold text-slate-800 shadow-sm border border-slate-200">
            ${product.price.toFixed(2)}
        </div>
      </div>
      
      <h3 className="font-semibold text-slate-800 text-center text-sm line-clamp-2 leading-tight px-1">
        {product.name}
      </h3>
    </div>
  );
};
