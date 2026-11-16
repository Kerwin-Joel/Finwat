import { Skeleton } from './ui/skeleton';

export const SkeletonAccountCard = () => (
    <div className="hero-aurora h-[236px] w-full overflow-hidden rounded-[28px] p-5 opacity-80" aria-busy="true" aria-label="Cargando balance">
        <div className="flex justify-between">
            <div className="h-8 w-40 rounded-full bg-white/15" />
            <div className="h-10 w-10 rounded-full bg-white/15" />
        </div>
        <div className="mt-7 space-y-2">
            <div className="h-3 w-24 rounded-full bg-white/15" />
            <div className="h-11 w-56 rounded-xl bg-white/20" />
        </div>
        <div className="mt-7 grid grid-cols-2 gap-2.5">
            <div className="h-[60px] rounded-2xl bg-white/10" />
            <div className="h-[60px] rounded-2xl bg-white/10" />
        </div>
    </div>
);

export const SkeletonTransactionItem = () => (
    <div className="flex items-center justify-between px-2.5 py-3">
        <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
                <Skeleton className="h-3.5 w-32 rounded-full" />
                <Skeleton className="h-3 w-20 rounded-full" />
            </div>
        </div>
        <Skeleton className="h-4 w-16 rounded-full" />
    </div>
);

export const SkeletonServiceCard = () => (
    <div className="surface space-y-3 p-4">
        <div className="flex items-start justify-between">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="space-y-2">
            <Skeleton className="h-4 w-3/4 rounded-full" />
            <Skeleton className="h-3.5 w-full rounded-full" />
            <Skeleton className="h-3.5 w-2/3 rounded-full" />
        </div>
        <div className="pt-2">
            <Skeleton className="h-9 w-full rounded-full" />
        </div>
    </div>
);
