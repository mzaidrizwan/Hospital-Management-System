import { Loader2 } from "lucide-react";

export function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-4">
            <div className="relative">
                <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
                <Loader2 className="w-12 h-12 animate-spin text-primary absolute inset-0 [animation-duration:1.5s]" />
            </div>
            <p className="text-muted-foreground font-medium animate-pulse">{message}</p>
        </div>
    );
}
