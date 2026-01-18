import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface KitchenTimerProps {
    startTime: string | Date;
    expectedPrepTime?: number; // in minutes
}

export const KitchenTimer: React.FC<KitchenTimerProps> = ({ startTime }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const start = new Date(startTime).getTime();
        
        const updateTimer = () => {
            const now = new Date().getTime();
            setElapsed(Math.floor((now - start) / 60000)); // minutes
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [startTime]);

    // Color logic & Status Text
    const getStatus = () => {
        if (elapsed < 15) return { color: 'text-green-500 bg-green-500/10', text: 'En tiempo' };
        if (elapsed < 25) return { color: 'text-yellow-500 bg-yellow-500/10', text: 'Atento' };
        return { color: 'text-red-500 bg-red-500/10', text: 'Demorado' };
    };

    const status = getStatus();

    return (
        <div className={`flex items-center gap-2 px-2 py-1 rounded-md font-mono font-medium border text-xs ${status.color}`}>
            <Clock size={14} />
            <span>{elapsed}m</span>
            <span className="opacity-75 border-l border-current pl-2 ml-1">{status.text}</span>
        </div>
    );
};
