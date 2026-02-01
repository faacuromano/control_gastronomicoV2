import { useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Users, Building2 } from 'lucide-react';
import { getErrorMessage, isErrorStatus } from '../../lib/errorUtils';
import api from '../../lib/api';

export default function LoginPage() {
    const [mode, setMode] = useState<'pin' | 'email'>('pin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [pin, setPin] = useState('');
    const [businessCode, setBusinessCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const login = useAuthStore((state) => state.login);
    const loginPin = useAuthStore((state) => state.loginPin);
    const setTenant = useAuthStore((state) => state.setTenant);
    const storedTenantId = useAuthStore((state) => state.tenantId);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Resolve tenant if not already set and business code provided
            if (!storedTenantId) {
                if (!businessCode.trim()) {
                    setError('Please enter your business code.');
                    setLoading(false);
                    return;
                }
                const tenantRes = await api.get(`/auth/tenant/${encodeURIComponent(businessCode.trim())}`);
                setTenant(tenantRes.data.data.tenantId);
            }

            if (mode === 'email') {
                await login(email, password);
            } else {
                await loginPin(pin);
            }
            navigate('/');
        } catch (err: any) {
            let message = getErrorMessage(err, 'Invalid credentials. Please try again.');

            if (isErrorStatus(err, 429)) {
                message = 'Too many failed attempts. Please try again in 15 minutes.';
            } else if (isErrorStatus(err, 403)) {
                message = 'Account is locked. Please contact your administrator.';
            } else if (isErrorStatus(err, 404)) {
                message = 'Business not found. Check your business code.';
            }

            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                <div className="p-6 text-center border-b border-border">
                    <h1 className="text-2xl font-bold">PentiumPOS</h1>
                    <p className="text-muted-foreground">Sign in to your account</p>
                </div>

                <div className="p-6">
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => setMode('pin')}
                            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                                mode === 'pin'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                        >
                            PIN Login
                        </button>
                        <button
                            onClick={() => setMode('email')}
                            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                                mode === 'email'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                        >
                            Email Login
                        </button>
                    </div>

                    {error && (
                        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!storedTenantId && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Business Name</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={businessCode}
                                        onChange={(e) => setBusinessCode(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Business name or code"
                                        required={!storedTenantId}
                                    />
                                </div>
                            </div>
                        )}

                        {mode === 'email' ? (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                            placeholder="admin@example.com"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">PIN Code</label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="password"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-center text-2xl tracking-widest"
                                        placeholder="••••••"
                                        required
                                        data-testid="pin-input"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            data-testid="btn-login"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
