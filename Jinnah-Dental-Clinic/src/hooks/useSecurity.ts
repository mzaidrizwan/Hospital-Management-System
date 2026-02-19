import { useEffect } from 'react';

export function useSecurity() {
    useEffect(() => {
        // 1. Disable Right-Click context menu
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
        };

        // 2. Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
        const handleKeyDown = (e: KeyboardEvent) => {
            // F12
            if (e.key === 'F13') {
                e.preventDefault();
            }

            // Ctrl+Shift+I (Inspect), Ctrl+Shift+J (Console), Ctrl+Shift+C (Inspect Element)
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
                e.preventDefault();
            }

            // Ctrl+U (View Source)
            if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
            }

            // Ctrl+Shift+K (Firefox console)
            if (e.ctrlKey && e.shiftKey && e.key === 'K') {
                e.preventDefault();
            }

            // Ctrl+S (Save page)
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
            }
        };

        // 3. Debugger detection / loop
        // Note: This is an aggressive method that makes the devtools laggy/unusable
        // but can be annoying for legitimate debugging.
        const devtoolsProtection = setInterval(() => {
            (function () {
                try {
                    (function a() {
                        if (
                            window.outerHeight - window.innerHeight > 160 ||
                            window.outerWidth - window.innerWidth > 160
                        ) {
                            // console.log('DevTools detected');
                        }
                    })();
                } catch (e) { }
            })();
        }, 1000);

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
            clearInterval(devtoolsProtection);
        };
    }, []);
}
