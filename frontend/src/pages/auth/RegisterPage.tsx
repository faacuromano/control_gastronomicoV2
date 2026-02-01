import { useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, User, Building2, Phone, ArrowRight, CheckCircle } from 'lucide-react';
import { getErrorMessage } from '../../lib/errorUtils';

export default function RegisterPage() {
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [businessName, setBusinessName] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    
    // Validation states
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [serverError, setServerError] = useState('');
    const [loading, setLoading] = useState(false);

    const signup = useAuthStore((state) => state.signup);
    const user = useAuthStore((state) => state.user);
    const navigate = useNavigate();

    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        
        if (businessName.length < 2) newErrors.businessName = 'Business name must be at least 2 characters';
        if (name.length < 1) newErrors.name = 'Name is required';
        if (!email.includes('@')) newErrors.email = 'Please enter a valid email';
        if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setServerError('');
        
        if (!validateForm()) return;

        setLoading(true);

        try {
            await signup({
                businessName,
                name,
                email,
                password,
                phone: phone || undefined
            });
            setStep('success');
        } catch (err: any) {
            // Use utility to extract user-friendly error message
            const message = getErrorMessage(err, 'Failed to register. Please try again.');
            setServerError(message);
        } finally {
            setLoading(false);
        }
    };

    if (step === 'success') {
        const pin = (user as any)?.generatedPin || '******'; // Access generatedPin from user object
        
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    
                    <h2 className="text-2xl font-bold mb-2">Registration Successful!</h2>
                    <p className="text-muted-foreground mb-6">
                        Your restaurant has been created.
                    </p>

                    <div className="bg-muted p-4 rounded-lg mb-6 border border-border">
                        <p className="text-sm text-muted-foreground mb-1">Your Backup Admin PIN</p>
                        <p className="text-3xl font-mono tracking-widest font-bold text-primary">{pin}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                            Please save this PIN. You can use it to login seamlessly on POS devices.
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                        Go to Dashboard
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                <div className="p-6 text-center border-b border-border">
                    <h1 className="text-2xl font-bold">Create Account</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Start managing your restaurant with PentiumPOS
                    </p>
                </div>

                <div className="p-6">
                    {serverError && (
                        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4 border border-destructive/20">
                            {serverError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Business Name</label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    className={`w-full pl-9 pr-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${
                                        errors.businessName ? 'border-destructive' : 'border-input'
                                    }`}
                                    placeholder="My Restaurant"
                                />
                            </div>
                            {errors.businessName && <p className="text-xs text-destructive">{errors.businessName}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={`w-full pl-9 pr-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${
                                        errors.name ? 'border-destructive' : 'border-input'
                                    }`}
                                    placeholder="John Doe"
                                />
                            </div>
                            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={`w-full pl-9 pr-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${
                                        errors.email ? 'border-destructive' : 'border-input'
                                    }`}
                                    placeholder="admin@example.com"
                                />
                            </div>
                            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`w-full pl-9 pr-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${
                                        errors.password ? 'border-destructive' : 'border-input'
                                    }`}
                                    placeholder="••••••••"
                                />
                            </div>
                            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Phone (Optional)</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="+1 234 567 890"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors mt-6"
                        >
                            {loading ? 'Creating Account...' : 'Sign Up'}
                        </button>

                        <div className="text-center text-sm pt-2">
                            <span className="text-muted-foreground">Already have an account? </span>
                            <Link to="/login" className="text-primary hover:underline font-medium">
                                Sign In
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
