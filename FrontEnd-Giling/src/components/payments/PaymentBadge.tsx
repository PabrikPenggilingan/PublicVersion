import { cn } from '@/utils/helpers'

export default function PaymentBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        UNPAID: 'text-red-400',
        PARTIAL: 'text-amber-400',
        PAID: 'text-brand-light-green',
    }
    return (
        <span className={cn('flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest', styles[status])}>
            <div className={cn('w-1.5 h-1.5 rounded-full', status === 'PAID' ? 'bg-brand-light-green' : status === 'PARTIAL' ? 'bg-amber-400' : 'bg-red-400')} />
            {status}
        </span>
    )
}
