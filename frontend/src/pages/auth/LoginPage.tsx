import { useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Users, Building2, Flame, Loader2, AlertCircle } from 'lucide-react';
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
                    setError('Ingresa el código de tu negocio.');
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
        } catch (err: unknown) {
            let message = getErrorMessage(err, 'Credenciales inválidas. Intenta de nuevo.');

            if (isErrorStatus(err, 429)) {
                message = 'Demasiados intentos fallidos. Intenta en 15 minutos.';
            } else if (isErrorStatus(err, 403)) {
                message = 'Cuenta bloqueada. Contacta a tu administrador.';
            } else if (isErrorStatus(err, 404)) {
                message = 'Negocio no encontrado. Verifica el código.';
            }

            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center mb-4">
                        <div className="bg-primary p-3 rounded-xl">
                            <Flame className="w-8 h-8 text-primary-foreground" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">
                        <span className="text-primary">Pentium</span>POS
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Sistema de Gestión Gastronómica</p>
                </div>

                {/* Login Card */}
                <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                    {/* Accent line */}
                    <div className="h-1 bg-primary" />

                    <div className="p-6">
                        {/* Mode Toggle */}
                        <div className="flex gap-2 mb-6 p-1 bg-muted rounded-lg">
                            <button
                                type="button"
                                onClick={() => setMode('pin')}
                                className={`
                                    flex-1 py-2 rounded-md text-sm font-medium transition-colors
                                    ${mode === 'pin'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }
                                `}
                            >
                                <Users className="inline w-4 h-4 mr-2" />
                                PIN
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('email')}
                                className={`
                                    flex-1 py-2 rounded-md text-sm font-medium transition-colors
                                    ${mode === 'email'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }
                                `}
                            >
                                <Mail className="inline w-4 h-4 mr-2" />
                                Email
                            </button>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-6 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Business Code */}
                            {!storedTenantId && (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Código de Negocio</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            value={businessCode}
                                            onChange={(e) => setBusinessCode(e.target.value)}
                                            className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                                            placeholder="mi_negocio"
                                            required={!storedTenantId}
                                        />
                                    </div>
                                </div>
                            )}

                            {mode === 'email' ? (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-foreground">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                                                placeholder="admin@ejemplo.com"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-foreground">Contraseña</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                                                placeholder="••••••••"
                                                required
                                            />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Código PIN</label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={pin}
                                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                            className="w-full px-4 py-3 border border-border rounded-lg text-foreground text-center font-mono text-2xl tracking-[0.4em] placeholder:text-muted-foreground placeholder:text-base placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                                            placeholder="••••••"
                                            required
                                            data-testid="pin-input"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground text-center">Ingresa tu PIN de 6 dígitos</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 mt-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                data-testid="btn-login"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Ingresando...
                                    </>
                                ) : (
                                    'Ingresar'
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-muted-foreground text-xs mt-6">
                    Sistema de Gestión Gastronómica
                </p>
            </div>
        </div>
    );
}
