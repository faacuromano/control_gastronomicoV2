
import React from 'react';

interface POSLayoutProps {
  categories: React.ReactNode;
  products: React.ReactNode;
  cart: React.ReactNode;
}

export const POSLayout: React.FC<POSLayoutProps> = ({ categories, products, cart }) => {
  return (
    <div className="flex h-full w-full overflow-hidden bg-muted/20">
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Categories */}
        <div className="w-24 md:w-32 flex-shrink-0 bg-background border-r border-border flex flex-col items-center py-4 overflow-y-auto hidden sm:flex">
          {categories}
        </div>
  
        {/* Center: Products */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 overflow-y-auto h-full scrollbar-hide">
              {products}
          </div>
        </div>
  
        {/* Right Sidebar: Cart */}
        <div className="w-80 md:w-96 flex-shrink-0 bg-background border-l border-border flex flex-col shadow-xl z-10">
          {cart}
        </div>
      </div>
    </div>
  );
};
