/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                // Additional semantic colors
                surface: {
                    elevated: "hsl(var(--surface-elevated))",
                    sunken: "hsl(var(--surface-sunken))",
                },
                status: {
                    pending: "hsl(var(--status-pending))",
                    cooking: "hsl(var(--status-cooking))",
                    ready: "hsl(var(--status-ready))",
                    delivered: "hsl(var(--status-delivered))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                xl: "calc(var(--radius) + 4px)",
                "2xl": "calc(var(--radius) + 8px)",
            },
            fontFamily: {
                // Display font: Outfit - bold, geometric, modern
                display: ["Outfit", "system-ui", "sans-serif"],
                // Body font: Plus Jakarta Sans - elegant, readable
                body: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
                // Sans fallback
                sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
                // Monospace: JetBrains Mono - for prices and numbers
                mono: ["JetBrains Mono", "ui-monospace", "monospace"],
            },
            fontSize: {
                // Display sizes
                "display-xl": ["4.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
                "display-lg": ["3.75rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
                "display-md": ["3rem", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
                "display-sm": ["2.25rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
            },
            boxShadow: {
                // Elevated shadows
                "elevation-1": "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)",
                "elevation-2": "0 3px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.12)",
                "elevation-3": "0 10px 20px rgba(0, 0, 0, 0.15), 0 3px 6px rgba(0, 0, 0, 0.10)",
                "elevation-4": "0 15px 25px rgba(0, 0, 0, 0.15), 0 5px 10px rgba(0, 0, 0, 0.05)",
                // Glow shadows
                "glow-primary": "0 0 30px hsl(var(--primary) / 0.3)",
                "glow-accent": "0 0 30px hsl(var(--accent) / 0.3)",
                "glow-sm": "0 0 15px hsl(var(--primary) / 0.2)",
                // Inner shadow
                "inner-sm": "inset 0 1px 2px rgba(0, 0, 0, 0.1)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "slide-in-right": {
                    from: { transform: "translateX(100%)", opacity: "0" },
                    to: { transform: "translateX(0)", opacity: "1" },
                },
                "slide-in-up": {
                    from: { transform: "translateY(10px)", opacity: "0" },
                    to: { transform: "translateY(0)", opacity: "1" },
                },
                "fade-in": {
                    from: { opacity: "0" },
                    to: { opacity: "1" },
                },
                "scale-in": {
                    from: { transform: "scale(0.95)", opacity: "0" },
                    to: { transform: "scale(1)", opacity: "1" },
                },
                "pulse-glow": {
                    "0%, 100%": { boxShadow: "0 0 20px hsl(var(--primary) / 0.3)" },
                    "50%": { boxShadow: "0 0 40px hsl(var(--primary) / 0.5)" },
                },
                "shimmer": {
                    from: { backgroundPosition: "-200% 0" },
                    to: { backgroundPosition: "200% 0" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "slide-in-right": "slide-in-right 0.3s ease-out",
                "slide-in-up": "slide-in-up 0.3s ease-out",
                "fade-in": "fade-in 0.2s ease-out",
                "scale-in": "scale-in 0.2s ease-out",
                "pulse-glow": "pulse-glow 2s ease-in-out infinite",
                "shimmer": "shimmer 2s linear infinite",
            },
            backgroundImage: {
                // Gradient backgrounds
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
                // Noise texture
                "noise": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
            },
            transitionTimingFunction: {
                "bounce-in": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
                "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}
