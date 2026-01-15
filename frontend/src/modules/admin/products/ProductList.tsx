import { useState, useEffect } from 'react';
import { productService, type Product } from '../../../services/productService';
import { categoryService, type Category } from '../../../services/categoryService';
import { Plus, Trash2, Edit, Check, X } from 'lucide-react';
import ProductForm from './components/ProductForm';

export default function ProductList() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);

    useEffect(() => {
        loadData();
    }, [selectedCategory]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [prods, cats] = await Promise.all([
                productService.getAll(selectedCategory),
                categoryService.getAll()
            ]);
            setProducts(prods);
            setCategories(cats);
        } catch (err) {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingProduct(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Delete product?')) return;
        try {
            await productService.delete(id);
            loadData();
        } catch (err) {
            setError('Failed to delete product');
        }
    };

    const handleToggle = async (id: number) => {
        try {
            await productService.toggleActive(id);
            loadData();
        } catch (err) {
            setError('Failed to toggle product status');
        }
    };

    if (loading && products.length === 0) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Products</h2>
                <button 
                    onClick={handleCreate}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    New Product
                </button>
            </div>

            <ProductForm 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSuccess={loadData}
                productToEdit={editingProduct}
            />

            {/* Filters */}
            <div className="flex gap-4">
                <select 
                    className="px-3 py-2 border border-input rounded-md bg-background"
                    value={selectedCategory || ''}
                    onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : undefined)}
                >
                    <option value="">All Categories</option>
                    {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {error && <div className="text-destructive">{error}</div>}

            <div className="rounded-md border border-border bg-card">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/50">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Category</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Price</th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((product) => (
                            <tr key={product.id} className="border-b border-border transition-colors hover:bg-muted/50">
                                <td className="p-4 align-middle">
                                    <button 
                                        onClick={() => handleToggle(product.id)}
                                        className={`w-6 h-6 rounded-full flex items-center justify-center ${product.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                                    >
                                        {product.isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                    </button>
                                </td>
                                <td className="p-4 align-middle font-medium">{product.name}</td>
                                <td className="p-4 align-middle text-muted-foreground">{product.category?.name || '-'}</td>
                                <td className="p-4 align-middle">${product.price.toFixed(2)}</td>
                                <td className="p-4 align-middle text-right flex justify-end gap-2">
                                    <button 
                                        onClick={() => handleEdit(product)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(product.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-md">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
