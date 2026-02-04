
import React from 'react';

interface POSLayoutProps {
  categories: React.ReactNode;
  products: React.ReactNode;
  cart: React.ReactNode;
}

export const POSLayout: React.FC<POSLayoutProps> = ({ categories, products, cart }) => {
  return (
    <div className="flex h-full w-full overflow-hidden bg-muted/30">
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Categories - Compact & Efficient */}
        <aside className="
          w-20 lg:w-24 flex-shrink-0
          bg-card border-r border-border
          flex flex-col items-center py-3
          overflow-y-auto scrollbar-hide
          hidden sm:flex
        ">
          {categories}
        </aside>

        {/* Center: Products - Maximum Space */}
        <main className="flex-1 flex flex-col min-w-0 bg-background">
          <div className="p-3 lg:p-4 overflow-y-auto h-full">
            {products}
          </div>
        </main>

        {/* Right Sidebar: Cart - Clean & Functional */}
        <aside className="
          w-80 lg:w-[360px] flex-shrink-0
          bg-card border-l border-border
          flex flex-col
          shadow-lg
        ">
          {cart}
        </aside>
      </div>
    </div>
  );
};
