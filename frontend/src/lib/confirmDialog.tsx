/**
 * @fileoverview Promise-based confirmation dialog using sonner
 *
 * Replaces native window.confirm() with a non-blocking toast-based dialog.
 * Returns a Promise<boolean> that resolves to true if confirmed, false if cancelled.
 *
 * Usage:
 *   const confirmed = await confirmDialog('¿Eliminar este item?');
 *   if (confirmed) { ... }
 */

import { toast } from 'sonner';

interface ConfirmOptions {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

/**
 * Shows a confirmation dialog and returns a promise
 * @param message - The confirmation message to display
 * @param options - Optional configuration for the dialog
 * @returns Promise that resolves to true if confirmed, false if cancelled
 */
export function confirmDialog(
    message: string,
    options: ConfirmOptions = {}
): Promise<boolean> {
    const {
        title = 'Confirmar',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        type = 'warning'
    } = options;

    return new Promise((resolve) => {
        const toastId = toast(
            <div className="flex flex-col gap-3">
                <div>
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{message}</p>
                </div>
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={() => {
                            toast.dismiss(toastId);
                            resolve(false);
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            toast.dismiss(toastId);
                            resolve(true);
                        }}
                        className={`px-3 py-1.5 text-sm font-medium text-white rounded-md transition-colors ${
                            type === 'danger'
                                ? 'bg-red-600 hover:bg-red-700'
                                : type === 'warning'
                                    ? 'bg-amber-600 hover:bg-amber-700'
                                    : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>,
            {
                duration: Infinity,
                position: 'top-center',
                className: 'confirm-dialog-toast',
            }
        );
    });
}

/**
 * Convenience function for delete confirmations
 */
export function confirmDelete(itemName: string = 'este elemento'): Promise<boolean> {
    return confirmDialog(`¿Estás seguro de eliminar ${itemName}?`, {
        title: 'Confirmar eliminación',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
    });
}

/**
 * Convenience function for action confirmations
 */
export function confirmAction(message: string): Promise<boolean> {
    return confirmDialog(message, {
        title: 'Confirmar acción',
        confirmText: 'Sí, continuar',
        cancelText: 'No, cancelar',
        type: 'warning'
    });
}
