/**
 * @fileoverview Public Menu Page
 * Customer-facing menu accessed via QR code
 * Route: /menu/:code
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { qrService, type PublicMenu } from '../services/qrService';
import { Loader2, AlertCircle, ShoppingCart, Plus, Minus } from 'lucide-react';

interface CartItem {
    productId: number;
    name: string;
    price: number;
    quantity: number;
}

export const MenuPublicPage: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const [menu, setMenu] = useState<PublicMenu | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);

    useEffect(() => {
        if (code) {
            loadMenu(code);
        }
    }, [code]);

    const loadMenu = async (qrCode: string) => {
        setLoading(true);
        setError(null);
        try {
            const data = await qrService.getPublicMenu(qrCode);
            setMenu(data);
            
            // Select first category by default
            if (data.categories && data.categories.length > 0) {
                setSelectedCategory(data.categories[0].id);
            }
        } catch (err: any) {
            setError(err.response?.data?.error?.message || 'No se pudo cargar el menú');
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product: any) => {
        const existing = cart.find(item => item.productId === product.id);
        if (existing) {
            setCart(cart.map(item => 
                item.productId === product.id 
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, {
                productId: product.id,
                name: product.name,
                price: Number(product.price),
                quantity: 1
            }]);
        }
    };

    const removeFromCart = (productId: number) => {
        const existing = cart.find(item => item.productId === productId);
        if (existing && existing.quantity > 1) {
            setCart(cart.map(item => 
                item.productId === productId 
                    ? { ...item, quantity: item.quantity - 1 }
                    : item
            ));
        } else {
            setCart(cart.filter(item => item.productId !== productId));
        }
    };

    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#1a1c1a] flex items-center justify-center">
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&display=swap');
                    body { font-family: 'Outfit', sans-serif; }
                `}</style>
                <div className="text-center">
                    <Loader2 className="animate-spin text-amber-50 mx-auto mb-4" size={48} />
                    <p className="text-amber-50">Cargando menú...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#1a1c1a] flex items-center justify-center p-4 text-white font-bold">
                <div className="bg-red-900/20 border border-red-500 rounded-xl p-8 shadow-lg text-center max-w-md">
                    <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
                    <h1 className="text-xl font-bold mb-2 uppercase">Error</h1>
                    <p className="text-red-200">{error}</p>
                </div>
            </div>
        );
    }

    // Static Mode - Show PDF
    if (menu?.mode === 'STATIC') {
        return (
            <div className="min-h-screen bg-black">
                {/* Header */}
                <div className="bg-[#1a1c1a] text-white p-4 text-center border-b border-white/10">
                    <h1 className="text-xl font-bold uppercase tracking-widest">{menu.businessName}</h1>
                </div>
                
                {/* PDF Viewer */}
                {menu.pdfUrl ? (
                    <iframe
                        src={menu.pdfUrl}
                        className="w-full h-[calc(100vh-64px)]"
                        title="Menú"
                    />
                ) : (
                    <div className="flex items-center justify-center h-96">
                        <p className="text-white">No hay menú disponible</p>
                    </div>
                )}
            </div>
        );
    }

    // Interactive Mode
    const filteredProducts = menu?.products?.filter(
        (p: any) => selectedCategory === null || p.category?.id === selectedCategory
    ) || [];

    const currentCategoryName = menu?.categories?.find((c: any) => c.id === selectedCategory)?.name || 'CARTA';

    // Theme values with defaults
    const theme = {
        bg: menu?.theme?.backgroundColor || '#2c2e2c',
        textPrimary: menu?.theme?.primaryColor || '#ffffff',
        textSecondary: menu?.theme?.secondaryColor || 'rgba(254, 243, 199, 0.6)',
        accent: menu?.theme?.accentColor || '#fef3c7',
        fontFamily: menu?.theme?.fontFamily || 'Outfit',
        enableAnimations: menu?.theme?.enableAnimations ?? true,
        ...menu?.theme
    };

    // Build Google Fonts URL dynamically
    const fontsToLoad = [
        'Outfit:wght@400;700',
        'Playfair+Display:wght@400;700',
        'Roboto:wght@400;700',
        'Merriweather:wght@400;700',
        'Montserrat:wght@400;700'
    ];
    const googleFontsUrl = `https://fonts.googleapis.com/css2?${fontsToLoad.map(f => `family=${f}`).join('&')}&display=swap`;

    return (
        <div className="min-h-screen pb-32 menu-bg text-secondary">
            <style>{`
                @import url('${googleFontsUrl}');
                
                :root {
                    --menu-bg: ${theme.bg};
                    --menu-text-primary: ${theme.textPrimary};
                    --menu-text-secondary: ${theme.textSecondary};
                    --menu-accent: ${theme.accent};
                    --menu-font-family: '${theme.fontFamily}', sans-serif;
                    --menu-transition-speed: ${theme.enableAnimations ? '0.3s' : '0s'};
                }

                body { 
                    font-family: var(--menu-font-family);
                    background-color: var(--menu-bg);
                }

                .menu-bg { background-color: var(--menu-bg); }
                .text-primary { color: var(--menu-text-primary); }
                .text-secondary { color: var(--menu-text-secondary); }
                .border-accent { border-color: var(--menu-accent); }
                .bg-accent { background-color: var(--menu-accent); }

                .dotted-leader {
                    flex: 1;
                    border-bottom: 2px dotted var(--menu-text-secondary);
                    margin: 0 12px;
                    height: 1px;
                    opacity: 0.4;
                    align-self: center;
                    margin-top: 6px;
                }

                .category-tab {
                    border-bottom: 2px solid transparent;
                    transition: all var(--menu-transition-speed) ease;
                }
                .category-tab.active {
                    border-bottom-color: var(--menu-accent);
                    color: var(--menu-text-primary);
                }

                /* Apply transitions conditionally */
                * {
                    transition-duration: var(--menu-transition-speed);
                }

                /* Disable specific animations if turned off */
                ${!theme.enableAnimations ? `
                    .group:hover .group-hover\\:opacity-80 { opacity: 1 !important; }
                    .hover\\:bg-white:hover { background-color: white !important; }
                    .hover\\:text-black:hover { color: black !important; }
                ` : ''}

                ::-webkit-scrollbar {
                    width: 6px;
                }
                ::-webkit-scrollbar-thumb {
                    background: var(--menu-text-secondary);
                    border-radius: 10px;
                }
            `}</style>

            {/* Header / Banner */}
            <div className="relative">
                {menu?.bannerUrl ? (
                    <div className="w-full h-56 overflow-hidden relative">
                        <div className="absolute inset-0 bg-black/60 z-10" />
                        <img 
                            src={menu.bannerUrl} 
                            alt="Banner" 
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
                            <h1 className="text-4xl font-bold text-primary uppercase tracking-tighter mb-1">
                                {menu?.businessName}
                            </h1>
                            {menu?.tableName && (
                                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-primary tracking-widest uppercase">
                                    Mesa {menu.tableName}
                                </span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="p-8 text-center border-b border-white/5 bg-black/20">
                        <h1 className="text-3xl font-bold text-primary uppercase tracking-tighter">
                            {menu?.businessName}
                        </h1>
                        {menu?.tableName && (
                            <p className="text-secondary mt-2 text-sm font-bold uppercase tracking-widest opacity-60">
                                Mesa {menu.tableName}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Categories Sticky Grid */}
            <div className="sticky top-0 z-50 bg-[#2c2e2c]/95 menu-bg backdrop-blur-md border-b border-white/5 shadow-xl">
                <div className="overflow-x-auto no-scrollbar">
                    <div className="flex px-4 py-3 gap-6 min-w-max">
                        {menu?.categories?.map((cat: any) => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`category-tab pb-1 text-sm font-bold uppercase tracking-widest transition-all ${
                                    selectedCategory === cat.id
                                        ? 'active text-primary scale-105'
                                        : 'text-secondary/50 hover:text-primary'
                                }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="p-6 max-w-2xl mx-auto">
                {/* Category Header */}
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold text-primary uppercase tracking-[0.2em] inline-block relative px-10">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] w-8 bg-white/20" />
                        {currentCategoryName}
                        <span className="absolute right-0 top-1/2 -translate-y-1/2 h-[2px] w-8 bg-white/20" />
                    </h2>
                </div>

                {/* Product List */}
                <div className="grid gap-10">
                    {filteredProducts.map((product: any) => {
                        const inCart = cart.find(i => i.productId === product.id);
                        return (
                            <div key={product.id} className="group">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center">
                                            <h3 className="text-lg font-bold uppercase tracking-wide text-primary group-hover:opacity-80 transition-opacity truncate">
                                                {product.name}
                                            </h3>
                                            <div className="dotted-leader" />
                                            <span className="text-lg font-bold text-primary shrink-0 ml-1">
                                                ${Number(product.price).toFixed(0)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons for Self-Order */}
                                    {menu?.selfOrderEnabled && (
                                        <div className="shrink-0">
                                            {inCart ? (
                                                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-1">
                                                    <button
                                                        onClick={() => removeFromCart(product.id)}
                                                        className="w-9 h-9 flex items-center justify-center bg-black/40 border border-white/20 text-white rounded-full hover:bg-white/10 transition-colors"
                                                    >
                                                        <Minus size={16} />
                                                    </button>
                                                    <span className="font-bold text-sm w-4 text-center text-white">
                                                        {inCart.quantity}
                                                    </span>
                                                    <button
                                                        onClick={() => addToCart(product)}
                                                        className="w-9 h-9 flex items-center justify-center bg-white text-black rounded-full hover:bg-amber-50 transition-colors"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => addToCart(product)}
                                                    className="w-11 h-11 flex items-center justify-center bg-white/10 border border-white/20 text-white rounded-full hover:bg-white hover:text-black transition-all"
                                                >
                                                    <Plus size={22} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Description in Parentheses below Name+Price row */}
                                {product.description && (
                                    <p className="text-sm text-secondary italic mt-1 leading-relaxed opacity-70">
                                        ({product.description})
                                    </p>
                                )}
                                
                                {/* Product Image if exists */}
                                {product.imageUrl && (
                                    <div className="mt-4 overflow-hidden rounded-xl border border-white/10 opacity-80 group-hover:opacity-100 transition-all max-w-[140px] shadow-lg">
                                        <img 
                                            src={product.imageUrl} 
                                            alt={product.name}
                                            className="w-full h-28 object-cover transform group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Empty State */}
                {filteredProducts.length === 0 && (
                    <div className="py-20 text-center opacity-40">
                        <p className="text-lg uppercase tracking-widest italic">No hay platos en esta sección</p>
                    </div>
                )}
            </div>

            {/* Footer Text */}
            <div className="mt-20 px-6 py-12 text-center opacity-30 text-xs border-t border-white/5 max-w-md mx-auto">
                <p className="uppercase tracking-[0.3em] font-bold mb-2">¡Buen Provecho!</p>
                <p className="">Los precios incluyen IVA • Todos los derechos reservados</p>
                <p className="mt-4">{menu?.businessName}</p>
            </div>

            {/* Cart Floating Button */}
            {menu?.selfOrderEnabled && cartCount > 0 && (
                <div className="fixed bottom-6 left-6 right-6 z-[60] animate-in slide-in-from-bottom-5 duration-300">
                    <button
                        onClick={() => setShowCart(true)}
                        className="w-full bg-accent text-secondary p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between group overflow-hidden relative"
                    >
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="relative z-10 flex items-center gap-4">
                            <div className="menu-bg text-primary p-2 rounded-xl">
                                <ShoppingCart size={24} />
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-lg leading-none text-primary">Mi Pedido</p>
                                <p className="text-xs uppercase font-black text-secondary opacity-60 mt-1">{cartCount} items seleccionados</p>
                            </div>
                        </div>
                        <div className="relative z-10 text-right">
                            <p className="text-2xl font-black text-primary">${cartTotal.toFixed(0)}</p>
                            <p className="text-[10px] uppercase font-bold text-secondary opacity-60">Toca para confirmar</p>
                        </div>
                    </button>
                </div>
            )}

            {/* Cart Sidebar/Modal */}
            {showCart && (
                <div className="fixed inset-0 z-[70] flex items-end">
                    <div 
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowCart(false)}
                    />
                    <div className="bg-[#1a1c1a] border-t border-white/10 w-full rounded-t-[2.5rem] p-8 pb-12 shadow-2xl relative z-10 max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-8 shrink-0" />
                        
                        <div className="flex items-center justify-between mb-8 shrink-0">
                            <h2 className="text-2xl font-black text-primary uppercase tracking-tighter">Tu Pedido</h2>
                            <button 
                                onClick={() => setShowCart(false)}
                                className="text-secondary hover:text-primary text-sm font-bold uppercase tracking-widest transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>

                        <div className="overflow-y-auto space-y-4 pr-2 flex-grow scroll-smooth">
                            {cart.map(item => (
                                <div key={item.productId} className="flex justify-between items-center group">
                                    <div className="flex items-center gap-4">
                                        <span className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/5 text-secondary font-black rounded-lg">
                                            {item.quantity}
                                        </span>
                                        <div>
                                            <p className="font-bold text-primary uppercase tracking-wide">{item.name}</p>
                                            <p className="text-xs text-secondary opacity-60 font-bold">${item.price.toFixed(0)} c/u</p>
                                        </div>
                                    </div>
                                    <span className="font-black text-primary text-lg">${(item.price * item.quantity).toFixed(0)}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/10 shrink-0">
                            <div className="flex justify-between items-end mb-8">
                                <div>
                                    <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em] mb-1">Total a pagar</p>
                                    <p className="text-4xl font-black text-primary tracking-tighter">${cartTotal.toFixed(0)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-primary font-bold text-sm">Caja / Mostrador</p>
                                    <p className="text-secondary text-[10px] uppercase font-bold">Lugar de Pago</p>
                                </div>
                            </div>
                            
                            <button
                                onClick={() => {
                                    alert('¡Pedido Iniciado! Por favor confirma con el personal.');
                                    setShowCart(false);
                                }}
                                className="w-full bg-white hover:bg-amber-50 text-[#1a1c1a] py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-95"
                            >
                                Confirmar Pedido
                            </button>
                            <p className="text-center text-amber-100/20 text-[10px] uppercase font-bold mt-4 tracking-widest">
                                El personal acudirá a tu mesa en breve
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export default MenuPublicPage;
