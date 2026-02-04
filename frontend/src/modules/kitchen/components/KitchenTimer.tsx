import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface KitchenTimerProps {
    startTime: string | Date;
    expectedPrepTime?: number; // in minutes
}

export const KitchenTimer: React.FC<KitchenTimerProps> = ({ startTime, expectedPrepTime = 15 }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const start = new Date(startTime).getTime();

        const updateTimer = () => {
            const now = new Date().getTime();
            setElapsed(Math.floor((now - start) / 60000)); // minutes
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000);

        return () => clearInterval(interval);
    }, [startTime]);

    // Calculate thresholds
    const warningThreshold = expectedPrepTime;
    const urgentThreshold = Math.ceil(expectedPrepTime * 1.67);

    // Status colors - light theme
    const getStatusClass = () => {
        if (elapsed < warningThreshold) return 'bg-emerald-100 text-emerald-700';
        if (elapsed < urgentThreshold) return 'bg-amber-100 text-amber-700';
        return 'bg-red-100 text-red-700';
    };

    const formatTime = (minutes: number): string => {
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h${mins}m`;
    };

    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${getStatusClass()}`}>
            <Clock className="w-3 h-3" />
            <span className="font-mono">{formatTime(elapsed)}</span>
        </div>
    );
};
