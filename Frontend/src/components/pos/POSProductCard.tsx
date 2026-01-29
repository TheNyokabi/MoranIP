'use client';

import { motion } from 'framer-motion';
import { Plus, Package, Camera, MoreHorizontal } from 'lucide-react';
import type { POSItem } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Unified type usage
interface POSProductCardProps {
    item: POSItem;
    onAdd: (item: POSItem) => void;
    onEdit?: (item: POSItem) => void;
}

export function POSProductCard({ item, onAdd, onEdit }: POSProductCardProps) {
    const hasImage = !!item.image;
    // Premium gradient backgrounds for placeholders
    const gradients = [
        'from-blue-950 to-slate-900',
        'from-emerald-950 to-slate-900',
        'from-purple-950 to-slate-900',
        'from-amber-950 to-slate-900',
        'from-rose-950 to-slate-900'
    ];
    // Deterministic gradient based on item code
    const gradientIndex = item.item_code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % gradients.length;

    const isOutOfStock = (item.stock_qty !== undefined && item.stock_qty <= 0);

    return (
        <motion.div
            layout
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.96 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`
                group relative flex flex-col rounded-3xl overflow-hidden border transition-all duration-300 cursor-pointer h-full min-h-[200px] shadow-lg
                ${isOutOfStock
                    ? 'bg-slate-900/50 border-slate-800 opacity-60 grayscale-[0.5]'
                    : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-900/20'
                }
            `}
            onClick={() => onAdd(item)}
        >
            {/* Image / Gradient Area */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950">
                {hasImage ? (
                    <img
                        src={item.image}
                        alt={item.item_name}
                        className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                    />
                ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${gradients[gradientIndex]} flex items-center justify-center`}>
                        <Package className="h-12 w-12 text-white/5 group-hover:text-white/10 transition-colors duration-500" />
                        <div className="absolute bottom-3 left-4 right-4">
                            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white/90 font-bold text-lg border border-white/10 shadow-inner ring-1 ring-white/5">
                                {item.item_name.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Overlay Gradient on Image */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

                {/* Stock Pill - Glassmorphism */}
                <div className="absolute top-3 right-3 z-10">
                    <div className={`
                       px-3 py-1 rounded-full text-[10px] font-bold shadow-lg backdrop-blur-xl border tracking-wide uppercase
                       ${isOutOfStock
                            ? 'bg-red-500/20 border-red-500/30 text-red-200'
                            : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                        }
                   `}>
                        {isOutOfStock ? 'No Stock' : `${item.stock_qty ?? '-'} In Stock`}
                    </div>
                </div>

                {/* Quick Edit Button (Visible on Hover or if no image) */}
                {onEdit && (
                    <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm border border-white/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(item);
                            }}
                        >
                            <Camera className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="p-4 flex-1 flex flex-col justify-between relative -mt-6">
                <div>
                    <h3 className="font-bold text-slate-100 text-sm leading-snug line-clamp-2 mb-1 group-hover:text-emerald-400 transition-colors">
                        {item.item_name}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono mb-2 uppercase tracking-wide opacity-70">
                        {item.item_code}
                    </p>
                </div>

                <div className="flex items-end justify-between mt-auto pt-3 border-t border-white/5">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Price</span>
                        <span className="font-bold text-emerald-400 font-mono text-lg tracking-tight">
                            {formatCurrency(item.standard_rate)}
                        </span>
                    </div>
                    <div className={`
                        h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg border border-white/5
                        ${isOutOfStock
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                            : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 hover:scale-110'
                        }
                    `}>
                        <Plus className="h-5 w-5 stroke-[3]" />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
