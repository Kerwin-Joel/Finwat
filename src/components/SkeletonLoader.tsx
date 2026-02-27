import { Skeleton } from './ui/skeleton';

export const SkeletonAccountCard = () => (
    <div className="w-full h-48 rounded-2xl bg-card border border-border p-6 flex flex-col justify-between animate-pulse">
        <div className="flex justify-between items-start">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-12 rounded-full" />
        </div>
        <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-48" />
        </div>
        <div className="flex justify-between mt-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
        </div>
    </div>
);

export const SkeletonTransactionItem = () => (
    <div className="flex items-center justify-between py-3 border-b border-border/50 animate-pulse">
        <div className="flex items-center space-x-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
            </div>
        </div>
        <Skeleton className="h-5 w-20" />
    </div>
);

export const SkeletonServiceCard = () => (
    <div className="p-4 rounded-xl border border-border bg-card space-y-3 animate-pulse">
        <div className="flex justify-between items-start">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="pt-2">
            <Skeleton className="h-8 w-full rounded-md" />
        </div>
    </div>
);
